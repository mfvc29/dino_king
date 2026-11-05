#!/usr/bin/env python3
"""
Dino King - 3D Mesh Architect (Clay + Wireframe Studio)
Servidor ligero para generación y diseño de mallas 3D asistido por IA sin Blender.
"""

import os
import sys
import json
import mimetypes
import http.server
import socketserver
import urllib.parse

PORT = int(os.environ.get('PORT', 8086))
# Modo público (despliegue del juego en Render): solo se juega; no hay editor ni se puede guardar nada en el servidor
JUEGO_PUBLICO = os.environ.get('JUEGO_PUBLICO') == '1'
APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(APP_DIR, '..'))
SCENES_DIR = os.path.join(APP_DIR, 'scenes')
STATIC_DIR = os.path.join(APP_DIR, 'static')
MALLAS_DIR = os.path.join(APP_DIR, 'mallas')
LIVE_MESH_FILE = os.path.join(SCENES_DIR, 'live_ai_mesh.json')
WORLD_STATE_FILE = os.path.join(SCENES_DIR, 'mundo_actual.json')

os.makedirs(SCENES_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)


class MeshStudioHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silenciar logs repetitivos de polling si los hubiera
        if '/api/live-check' in str(args[0]):
            return
        super().log_message(format, *args)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == '/healthz':
            self.send_json({'ok': True})
            return
        if path == '/api/modo':
            self.send_json({'publico': JUEGO_PUBLICO})
            return
        if JUEGO_PUBLICO and path in ('/editor', '/editor/', '/index.html', '/api/live-mesh', '/api/load', '/api/scenes'):
            self.send_response(302)
            self.send_header('Location', '/')
            self.end_headers()
            return

        # API: Verificar si hay actualización en vivo de la malla generada por IA
        if path == '/api/live-check':
            mtime = 0
            if os.path.exists(LIVE_MESH_FILE):
                mtime = os.path.getmtime(LIVE_MESH_FILE)
            self.send_json({'success': True, 'mtime': mtime})
            return

        # API: Obtener la malla viva actual
        if path == '/api/live-mesh':
            if os.path.exists(LIVE_MESH_FILE):
                with open(LIVE_MESH_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.send_json({'success': True, 'data': data})
            else:
                self.send_json({'success': True, 'data': None})
            return

        # API: Obtener el estado completo del mundo y rutas guardado en disco (world_builder/scenes/)
        if path == '/api/world-state':
            target_file = None
            if os.path.exists(WORLD_STATE_FILE):
                target_file = WORLD_STATE_FILE
            elif os.path.exists(SCENES_DIR):
                # Buscar el archivo .json más reciente en scenes/ que contenga rutas
                candidates = []
                for fname in os.listdir(SCENES_DIR):
                    if fname.endswith('.json') and fname != 'live_ai_mesh.json':
                        fpath = os.path.join(SCENES_DIR, fname)
                        candidates.append((os.path.getmtime(fpath), fpath))
                candidates.sort(reverse=True)
                for _, fpath in candidates:
                    try:
                        with open(fpath, 'r', encoding='utf-8') as f:
                            d = json.load(f)
                        if isinstance(d, dict) and isinstance(d.get('routes'), list) and len(d['routes']) > 0:
                            target_file = fpath
                            break
                    except Exception:
                        pass

            if target_file and os.path.exists(target_file):
                try:
                    with open(target_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    self.send_json({'success': True, 'file': os.path.basename(target_file), 'data': data})
                    return
                except Exception as e:
                    self.send_json({'success': False, 'error': str(e)}, 500)
                    return

            self.send_json({'success': True, 'file': None, 'data': None})
            return

        # API: Listar mallas guardadas
        if path == '/api/scenes':
            scenes = []
            if os.path.exists(SCENES_DIR):
                for f in sorted(os.listdir(SCENES_DIR)):
                    if f.endswith('.json') and f != 'live_ai_mesh.json':
                        scenes.append(f[:-5])
            self.send_json({'success': True, 'scenes': scenes})
            return

        # API: Cargar malla guardada
        if path == '/api/load':
            name = query.get('name', ['default'])[0]
            safe_name = "".join(c for c in name if c.isalnum() or c in ('_', '-'))
            file_path = os.path.join(SCENES_DIR, f"{safe_name}.json")
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self.send_json({'success': True, 'name': safe_name, 'data': data})
            else:
                self.send_json({'success': False, 'error': 'Malla no encontrada'}, 404)
            return

        # Pantalla de inicio del juego (Dino Rey) en la raíz; el editor del mundo está en /editor
        if path == '/' or path == '/inicio' or path == '/inicio.html':
            inicio_path = os.path.join(APP_DIR, 'inicio.html')
            if os.path.exists(inicio_path):
                self.serve_file(inicio_path)
                return

        if path in ('/editor', '/editor/', '/index.html', '/jugar', '/jugar/'):
            index_path = os.path.join(APP_DIR, 'index.html')
            if os.path.exists(index_path):
                self.serve_file(index_path)
                return

        if path.startswith('/static/'):
            relative = path[len('/static/'):]
            full_path = os.path.normpath(os.path.join(STATIC_DIR, relative))
            if full_path.startswith(STATIC_DIR) and os.path.exists(full_path) and os.path.isfile(full_path):
                self.serve_file(full_path)
                return

        # Biblioteca de mallas (world_builder/mallas) con autodescubrimiento de nuevas mallas
        if path == '/mallas/catalogo.json':
            cat_data = self.build_dynamic_mallas_catalog()
            self.send_json(cat_data)
            return

        if path.startswith('/mallas/'):
            relative = urllib.parse.unquote(path[len('/mallas/'):])
            full_path = os.path.normpath(os.path.join(MALLAS_DIR, relative))
            if full_path.startswith(MALLAS_DIR + os.sep) and os.path.isfile(full_path):
                self.serve_file(full_path)
                return

        # Servir assets del proyecto principal (/assets/...)
        if path.startswith('/assets/'):
            relative = urllib.parse.unquote(path[len('/assets/'):])
            assets_dir = os.path.join(PROJECT_ROOT, 'assets')
            full_path = os.path.normpath(os.path.join(assets_dir, relative))
            if full_path.startswith(assets_dir) and os.path.exists(full_path) and os.path.isfile(full_path):
                self.serve_file(full_path)
                return

        # Servir el Dino Lector (Pokédex interactivo)
        if path == '/dino_lector' or path == '/dino_lector/':
            dl_index = os.path.join(PROJECT_ROOT, 'dino_lector', 'index.html')
            if os.path.exists(dl_index):
                self.serve_file(dl_index)
                return

        if path.startswith('/dino_lector/'):
            relative = urllib.parse.unquote(path[len('/dino_lector/'):])
            dl_dir = os.path.join(PROJECT_ROOT, 'dino_lector')
            full_path = os.path.normpath(os.path.join(dl_dir, relative))
            if full_path.startswith(dl_dir) and os.path.exists(full_path) and os.path.isfile(full_path):
                self.serve_file(full_path)
                return

        super().do_GET()

    def do_HEAD(self):
        self.do_GET()

    def build_dynamic_mallas_catalog(self):
        cat_path = os.path.join(MALLAS_DIR, 'catalogo.json')
        data = {
            "version": 1,
            "escala": "1 unidad = 1 metro",
            "categorias": {
                "arboles": "🌳 Árboles",
                "piedras": "🪨 Piedras y Cuevas",
                "troncos": "🪵 Troncos",
                "plantas": "🌿 Plantas",
                "estructuras": "🏠 Estructuras",
                "personajes": "🧍 Personajes",
                "terrenos": "⛰️ Terrenos"
            },
            "mallas": []
        }
        if os.path.exists(cat_path):
            try:
                with open(cat_path, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    data.update(loaded)
            except Exception:
                pass

        known_files = {m.get('archivo') for m in data.get('mallas', []) if isinstance(m, dict)}
        known_ids = {m.get('id') for m in data.get('mallas', []) if isinstance(m, dict)}

        if os.path.exists(MALLAS_DIR):
            for entry in sorted(os.listdir(MALLAS_DIR)):
                sub_dir = os.path.join(MALLAS_DIR, entry)
                if os.path.isdir(sub_dir) and not entry.startswith('.') and not entry.startswith('_'):
                    if entry not in data.get('categorias', {}):
                        data.setdefault('categorias', {})[entry] = f"📦 {entry.capitalize()}"
                    for fname in sorted(os.listdir(sub_dir)):
                        if fname.endswith('.js') and not fname.startswith('_'):
                            rel_file = f"{entry}/{fname}"
                            mesh_id = fname[:-3]
                            if rel_file not in known_files and mesh_id not in known_ids:
                                data.setdefault('mallas', []).append({
                                    "id": mesh_id,
                                    "categoria": entry,
                                    "archivo": rel_file,
                                    "imagen": ""
                                })
                                known_files.add(rel_file)
                                known_ids.add(mesh_id)
        return data

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if JUEGO_PUBLICO:
            self.send_json({'success': False, 'error': 'Guardado desactivado en el juego publicado'}, 403)
            return

        if path == '/api/save':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length).decode('utf-8')
                payload = json.loads(body)
                name = payload.get('name', 'mundo_actual')
                safe_name = "".join(c for c in name if c.isalnum() or c in ('_', '-')) or 'mundo_actual'
                scene_data = payload.get('data', {})

                # 1. Guardar en el archivo solicitado dentro de world_builder/scenes/
                file_path = os.path.join(SCENES_DIR, f"{safe_name}.json")
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(scene_data, f, indent=2, ensure_ascii=False)

                # 2. Actualizar siempre mundo_actual.json para que al refrescar (F5) nunca se pierda nada
                with open(WORLD_STATE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(scene_data, f, indent=2, ensure_ascii=False)

                self.send_json({
                    'success': True,
                    'name': safe_name,
                    'savedPath': f"world_builder/scenes/{safe_name}.json"
                })
            except Exception as e:
                self.send_json({'success': False, 'error': str(e)}, 500)
            return

        self.send_error(404, "Endpoint no encontrado")

    def send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_file(self, full_path):
        mime, _ = mimetypes.guess_type(full_path)
        if not mime:
            mime = 'application/octet-stream'
        try:
            with open(full_path, 'rb') as f:
                data = f.read()
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(data)))
            # Siempre la versión actual de los archivos (sin copias viejas en la caché del navegador)
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_error(500, f"Error al leer archivo: {e}")


def run_server():
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    # Varios hilos: el juego publicado atiende a varios jugadores (y a las muchas peticiones de cada carga) a la vez
    with socketserver.ThreadingTCPServer(("", PORT), MeshStudioHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"\n=======================================================")
        print(f"🕸️ DINO KING - AI 3D MESH ARCHITECT (CLAY + WIREFRAME)")
        print(f"=======================================================")
        print(f" Servidor activo en: {url}")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")


if __name__ == '__main__':
    run_server()
