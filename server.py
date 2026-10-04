#!/usr/bin/env python3
"""
Dino King - Servidor Integrado HTTP + WebSocket Multijugador
- Sirve los archivos web y tilesets en http://localhost:8000
- Proporciona endpoint /api/characters con los personajes disponibles
- Servidor WebSocket en ws://localhost:8001 para que cada jugador sea independiente en el mapa compartido
"""

import http.server
import socketserver
import os
import sys
import json
import glob
import asyncio
import threading
import urllib.parse
import websockets

HTTP_PORT = int(os.environ.get('HTTP_PORT', 8000))
WS_PORT = int(os.environ.get('WS_PORT', 8001))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


SAVES_DIR = os.path.join(DIRECTORY, 'saves')
SAVE_SLOTS = 3


def save_slot_path(query):
    """Ruta del archivo de una ranura de guardado (1..3) o None si no es válida."""
    try:
        slot = int(query.get('slot', ['0'])[0])
    except ValueError:
        return None
    if not 1 <= slot <= SAVE_SLOTS:
        return None
    return os.path.join(SAVES_DIR, f'slot{slot}.json')

# ============================================================
# 1. SERVIDOR HTTP CON SOPORTE PARA /api/characters
# ============================================================
class GameHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Endpoint para listar dinámicamente los personajes en assets/characters/
        if path == '/api/characters':
            chars_dir = os.path.join(DIRECTORY, 'assets', 'characters')
            pngs = sorted([os.path.basename(f) for f in glob.glob(os.path.join(chars_dir, '*.png'))])
            
            data = json.dumps(pngs).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Partidas guardadas en saves/ (copia de seguridad de las ranuras del navegador)
        elif path == '/api/saves':
            saves = {}
            for slot in range(1, SAVE_SLOTS + 1):
                f = os.path.join(SAVES_DIR, f'slot{slot}.json')
                if os.path.exists(f):
                    try:
                        with open(f, 'r', encoding='utf-8') as fh:
                            saves[str(slot)] = json.load(fh)
                    except (OSError, ValueError):
                        pass
            self.send_json(200, saves)
            return

        # Endpoint para listar dinámicamente tilesets en assets/maps/
        elif path == '/api/tilesets':
            maps_dir = os.path.join(DIRECTORY, 'assets', 'maps')
            pngs = sorted([os.path.basename(f) for f in glob.glob(os.path.join(maps_dir, '*.png'))])
            data = json.dumps(pngs).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Endpoint para listar todos los mapas disponibles en assets/maps/
        elif path == '/api/maps':
            maps_dir = os.path.join(DIRECTORY, 'assets', 'maps')
            json_files = sorted([os.path.basename(f) for f in glob.glob(os.path.join(maps_dir, '*.json'))])
            data = json.dumps(json_files).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Endpoint para obtener un mapa específico (ej: /api/map?id=world_map o /api/map?id=casa_jugador)
        elif path == '/api/map':
            map_id = query.get('id', ['world_map'])[0]
            if not map_id.endswith('.json'):
                map_id += '.json'
            
            map_path = os.path.join(DIRECTORY, 'assets', 'maps', map_id)
            if not os.path.exists(map_path) and map_id != 'world_map.json':
                # Fallback
                map_path = os.path.join(DIRECTORY, 'assets', 'maps', 'world_map.json')

            if os.path.exists(map_path):
                with open(map_path, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            else:
                self.send_error(404, "Mapa no encontrado")
                return

        # Servir tilesets y mapas con resolución insensible a mayúsculas/minúsculas
        elif path.startswith('/assets/maps/'):
            filename = os.path.basename(path)
            maps_dir = os.path.join(DIRECTORY, 'assets', 'maps')
            target_path = os.path.join(maps_dir, filename)

            if not os.path.exists(target_path):
                fn_lower = filename.lower()
                for f in os.listdir(maps_dir):
                    if f.lower() == fn_lower:
                        target_path = os.path.join(maps_dir, f)
                        break

            if os.path.exists(target_path) and os.path.isfile(target_path):
                content_type = 'image/png' if target_path.endswith('.png') else ('application/json' if target_path.endswith('.json') else 'application/octet-stream')
                with open(target_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # Guardar una partida (ranura 1..3)
        if path == '/api/save':
            save_path = save_slot_path(query)
            if not save_path:
                self.send_json(400, {"status": "error", "message": "Ranura no válida"})
                return
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(content_length).decode('utf-8'))
                os.makedirs(SAVES_DIR, exist_ok=True)
                with open(save_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False)
                self.send_json(200, {"status": "ok"})
            except Exception as e:
                self.send_json(500, {"status": "error", "message": str(e)})
            return

        # Endpoint para guardar mapa desde el Editor de Mapas
        if path == '/api/map':
            try:
                map_id = query.get('id', ['world_map'])[0]
                if not map_id.endswith('.json'):
                    map_id += '.json'

                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                map_json = json.loads(body.decode('utf-8'))

                map_path = os.path.join(DIRECTORY, 'assets', 'maps', map_id)
                with open(map_path, 'w', encoding='utf-8') as f:
                    json.dump(map_json, f)

                # Si es proyecto_actual o world_map, sincronizar ambos
                if map_id in ('proyecto_actual.json', 'world_map.json'):
                    other_id = 'world_map.json' if map_id == 'proyecto_actual.json' else 'proyecto_actual.json'
                    other_path = os.path.join(DIRECTORY, 'assets', 'maps', other_id)
                    with open(other_path, 'w', encoding='utf-8') as f:
                        json.dump(map_json, f)

                resp = json.dumps({"status": "ok", "message": f"¡Mapa '{map_id}' guardado exitosamente!"}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                print(f"  🗺️ ¡Mapa '{map_id}' guardado y sincronizado desde el Editor!")
                return
            except Exception as e:
                err_resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(err_resp)))
                self.end_headers()
                self.wfile.write(err_resp)
                return

        super().do_POST()

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/save':
            save_path = save_slot_path(urllib.parse.parse_qs(parsed.query))
            if not save_path:
                self.send_json(400, {"status": "error", "message": "Ranura no válida"})
                return
            if os.path.exists(save_path):
                os.remove(save_path)
            self.send_json(200, {"status": "ok"})
            return
        self.send_error(405)

    def send_json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

def run_http_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", HTTP_PORT), GameHTTPRequestHandler) as httpd:
        print(f"  🌐 Servidor HTTP activo en: http://localhost:{HTTP_PORT}")
        httpd.serve_forever()


# ============================================================
# 2. SERVIDOR WEBSOCKET MULTIJUGADOR INDEPENDIENTE
# ============================================================
connected_clients = {} # websocket -> player_id
players_state = {}     # player_id -> dict con datos del jugador
player_counter = 0

async def broadcast(message, exclude_ws=None):
    if not connected_clients:
        return
    data = json.dumps(message)
    dead_sockets = []
    for ws in list(connected_clients.keys()):
        if ws != exclude_ws:
            try:
                await ws.send(data)
            except Exception:
                dead_sockets.append(ws)
    for ws in dead_sockets:
        await handle_disconnect(ws)

async def handle_disconnect(websocket):
    if websocket in connected_clients:
        pid = connected_clients.pop(websocket)
        if pid in players_state:
            p_data = players_state.pop(pid)
            print(f"  👋 Jugador desconectado: {p_data.get('name', pid)} ({pid})")
            await broadcast({'type': 'player_left', 'id': pid})

async def ws_handler(websocket):
    global player_counter
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except Exception:
                continue

            msg_type = data.get('type')

            # 1. Un nuevo jugador entra al mundo
            if msg_type == 'join':
                player_counter += 1
                pid = f"player_{player_counter}"
                connected_clients[websocket] = pid

                # Datos del jugador
                p_info = {
                    'id': pid,
                    'name': data.get('name', f'Jugador {player_counter}'),
                    'sprite': data.get('sprite', 'character_3.png'),
                    'x': data.get('x', 700 + (player_counter * 30) % 200),
                    'y': data.get('y', 650 + (player_counter * 25) % 150),
                    'direction': data.get('direction', 'down'),
                    'state': 'idle',
                    'isRunning': False,
                    'map': data.get('map', 'world_map')
                }
                players_state[pid] = p_info
                print(f"  🎮 ¡Jugador conectado!: {p_info['name']} ({pid}) con sprite: {p_info['sprite']} en mapa: {p_info['map']}")

                # Enviar bienvenida con su ID y la lista de todos los jugadores actuales
                welcome_msg = {
                    'type': 'welcome',
                    'yourId': pid,
                    'you': p_info,
                    'players': players_state
                }
                await websocket.send(json.dumps(welcome_msg))

                # Notificar a todos los demás jugadores que se unió alguien nuevo
                await broadcast({'type': 'player_joined', 'player': p_info}, exclude_ws=websocket)

            # 2. El jugador se mueve por el mapa
            elif msg_type == 'move':
                pid = connected_clients.get(websocket)
                if pid and pid in players_state:
                    p = players_state[pid]
                    p['x'] = data.get('x', p['x'])
                    p['y'] = data.get('y', p['y'])
                    p['direction'] = data.get('direction', p['direction'])
                    p['state'] = data.get('state', p['state'])
                    p['isRunning'] = data.get('isRunning', False)
                    if 'map' in data:
                        p['map'] = data['map']

                    # Reenviar posición a los demás clientes
                    await broadcast({
                        'type': 'player_moved',
                        'id': pid,
                        'x': p['x'],
                        'y': p['y'],
                        'direction': p['direction'],
                        'state': p['state'],
                        'isRunning': p['isRunning'],
                        'map': p.get('map', 'world_map')
                    }, exclude_ws=websocket)

            # 2.5 Cambio de mapa (Warp)
            elif msg_type == 'change_map':
                pid = connected_clients.get(websocket)
                if pid and pid in players_state:
                    p = players_state[pid]
                    p['map'] = data.get('map', 'world_map')
                    p['x'] = data.get('x', p['x'])
                    p['y'] = data.get('y', p['y'])
                    p['direction'] = data.get('direction', 'down')
                    await broadcast({
                        'type': 'player_changed_map',
                        'id': pid,
                        'map': p['map'],
                        'x': p['x'],
                        'y': p['y'],
                        'direction': p['direction']
                    }, exclude_ws=websocket)

            # 3. Interacción / Emote / Mensaje
            elif msg_type == 'action':
                pid = connected_clients.get(websocket)
                if pid:
                    await broadcast({
                        'type': 'player_action',
                        'id': pid,
                        'action': data.get('action')
                    }, exclude_ws=websocket)

            # 4. Cambio de Sprite en tiempo real desde el Menú
            elif msg_type == 'change_sprite':
                pid = connected_clients.get(websocket)
                if pid and pid in players_state:
                    new_sprite = data.get('sprite', 'character_3.png')
                    players_state[pid]['sprite'] = new_sprite
                    await broadcast({
                        'type': 'player_sprite_changed',
                        'id': pid,
                        'sprite': new_sprite
                    }, exclude_ws=websocket)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        await handle_disconnect(websocket)

async def run_ws_server():
    async with websockets.serve(ws_handler, "0.0.0.0", WS_PORT):
        print(f"  ⚡ Servidor WebSocket multijugador activo en: ws://localhost:{WS_PORT}")
        await asyncio.Future()

def start_ws_loop():
    asyncio.run(run_ws_server())

# ============================================================
# 3. EJECUCIÓN PRINCIPAL
# ============================================================
def start_map_editor():
    """Editor de mapas en su puerto (8080); si ya está abierto en otra terminal, no hace nada."""
    try:
        sys.path.insert(0, os.path.join(DIRECTORY, 'tools', 'map_editor'))
        import app as map_editor
        socketserver.TCPServer.allow_reuse_address = True
        with socketserver.TCPServer(("", map_editor.PORT), map_editor.AdvanceMapRequestHandler) as httpd:
            print(f"  🗺️  Editor de mapas en: http://localhost:{map_editor.PORT}")
            httpd.serve_forever()
    except OSError:
        print("  🗺️  El editor de mapas ya está abierto (puerto 8080).")
    except Exception as e:
        print(f"  ⚠️  No se pudo iniciar el editor de mapas: {e}")


if __name__ == "__main__":
    print("==================================================")
    print("  🦖 DINO KING - Servidor Multijugador & Mundo Real")
    print("==================================================")

    # Iniciar servidor WebSocket en un hilo separado
    ws_thread = threading.Thread(target=start_ws_loop, daemon=True)
    ws_thread.start()

    # Iniciar también el editor de mapas (tools/map_editor) en http://localhost:8080
    if "--sin-editor" not in sys.argv and not os.environ.get("RENDER"):
        threading.Thread(target=start_map_editor, daemon=True).start()

    # Abrir navegador si no se pasa --no-browser
    if "--no-browser" not in sys.argv:
        try:
            webbrowser.open(f"http://localhost:{HTTP_PORT}")
        except Exception:
            pass

    # Iniciar servidor HTTP en el hilo principal
    run_http_server()
