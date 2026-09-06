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
import webbrowser
import websockets

HTTP_PORT = 8000
WS_PORT = 8001
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 1. SERVIDOR HTTP CON SOPORTE PARA /api/characters
# ============================================================
class GameHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Endpoint para listar dinámicamente los personajes en assets/characters/
        if self.path == '/api/characters':
            chars_dir = os.path.join(DIRECTORY, 'assets', 'characters')
            pngs = sorted([os.path.basename(f) for f in glob.glob(os.path.join(chars_dir, '*.png'))])
            
            data = json.dumps(pngs).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Endpoint para listar dinámicamente tilesets en assets/maps/
        elif self.path == '/api/tilesets':
            maps_dir = os.path.join(DIRECTORY, 'assets', 'maps')
            pngs = sorted([os.path.basename(f) for f in glob.glob(os.path.join(maps_dir, '*.png'))])
            data = json.dumps(pngs).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # Endpoint para obtener el mapa guardado world_map.json
        elif self.path == '/api/map':
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

        super().do_GET()

    def do_POST(self):
        # Endpoint para guardar mapa desde el Editor de Mapas estilo Advance Map
        if self.path == '/api/map':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length)
                map_json = json.loads(body.decode('utf-8'))

                map_path = os.path.join(DIRECTORY, 'assets', 'maps', 'world_map.json')
                with open(map_path, 'w', encoding='utf-8') as f:
                    json.dump(map_json, f)

                resp = json.dumps({"status": "ok", "message": "¡Mapa guardado exitosamente en world_map.json!"}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                print("  🗺️ ¡Mapa guardado y sincronizado desde el Editor de Mapas!")
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
                    'isRunning': False
                }
                players_state[pid] = p_info
                print(f"  🎮 ¡Jugador conectado!: {p_info['name']} ({pid}) con sprite: {p_info['sprite']}")

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

                    # Reenviar posición a los demás clientes
                    await broadcast({
                        'type': 'player_moved',
                        'id': pid,
                        'x': p['x'],
                        'y': p['y'],
                        'direction': p['direction'],
                        'state': p['state'],
                        'isRunning': p['isRunning']
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
if __name__ == "__main__":
    print("==================================================")
    print("  🦖 DINO KING - Servidor Multijugador & Mundo Real")
    print("==================================================")

    # Iniciar servidor WebSocket en un hilo separado
    ws_thread = threading.Thread(target=start_ws_loop, daemon=True)
    ws_thread.start()

    # Abrir navegador si no se pasa --no-browser
    if "--no-browser" not in sys.argv:
        try:
            webbrowser.open(f"http://localhost:{HTTP_PORT}")
        except Exception:
            pass

    # Iniciar servidor HTTP en el hilo principal
    run_http_server()
