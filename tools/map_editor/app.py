#!/usr/bin/env python3
"""
Dino King - Advance Map Studio (Herramienta Externa e Independiente)
Editor visual de mapas y permisos de paso para desarrollo y diseño de niveles.

- Corre en su propio puerto dedicado (http://localhost:8080)
- Trabaja con proyectos y borradores independientes en tools/map_editor/projects/
- Permite subir nuevos tilesets (.png) sin tocar los archivos del juego
- Botón "Publicar al Juego" para aplicar los cambios a Dino King solo cuando estés listo
"""

import http.server
import socketserver
import os
import sys
import json
import glob
import shutil
import urllib.parse
import webbrowser
import base64
import re

PORT = 8080
EDITOR_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(EDITOR_DIR, '..', '..'))
PROJECTS_DIR = os.path.join(EDITOR_DIR, 'projects')
CUSTOM_ASSETS_DIR = os.path.join(EDITOR_DIR, 'custom_assets')
GAME_MAPS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'maps')
GAME_CHARACTERS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'characters')
GAME_DINOS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'dinos')

# Tilesets que se ofrecen para pintar (los que usa el juego por ahora)
PALETTE_TILESETS = ['Outside.png', 'Caves.png', 'charcos.png',
                    'objetos_para_casa.png', 'objetos_para_casa_2.png', 'objetos_para_casa_3.png']
# Copias del mapa principal que no se muestran en la lista
HIDDEN_MAPS = {'proyecto_actual.json', 'world_map_antiguo_backup.json'}

# Objetos armados tile por tile (casas, árboles...): cada uno es un PNG + JSON que el juego
# puede usar como tileset con la clave "objetos/<nombre>"
GAME_OBJECTS_DIR = os.path.join(GAME_MAPS_DIR, 'objetos')


def safe_object_name(raw):
    """Nombre de archivo en minúsculas y sin caracteres raros (el juego busca los tilesets en minúsculas)."""
    name = re.sub(r'[^a-z0-9_-]+', '_', (raw or '').strip().lower()).strip('_')
    return name[:60]


os.makedirs(PROJECTS_DIR, exist_ok=True)
os.makedirs(CUSTOM_ASSETS_DIR, exist_ok=True)
os.makedirs(GAME_MAPS_DIR, exist_ok=True)

class AdvanceMapRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=EDITOR_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Listar tilesets disponibles
        if path == '/api/tilesets':
            # Solo los tilesets del juego que se usan por ahora (PALETTE_TILESETS)
            all_tilesets = [n for n in PALETTE_TILESETS if os.path.exists(os.path.join(GAME_MAPS_DIR, n))]
            
            data = json.dumps(all_tilesets).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 1b. API: Listar sprites de personajes (para colocar NPCs / entrenadores)
        elif path == '/api/characters':
            pngs = sorted([os.path.basename(f) for f in glob.glob(os.path.join(GAME_CHARACTERS_DIR, '*.png'))])
            data = json.dumps(pngs).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 1c. Servir sprites de personajes del juego
        elif path.startswith('/assets/characters/'):
            filename = os.path.basename(urllib.parse.unquote(path))
            target_path = os.path.join(GAME_CHARACTERS_DIR, filename)
            if filename.lower().endswith('.png') and os.path.isfile(target_path):
                with open(target_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Personaje no encontrado")
            return

        # 1d. API: Catálogo de dinos y ataques (assets/dinos/dinos.json)
        #     Cualquier tarjeta .jpg de las carpetas por tipo (agua/, fuego/, ...) que no esté
        #     en el catálogo se agrega automáticamente con el elemento de su carpeta.
        elif path == '/api/dinos':
            catalog = {"elements": {}, "dinos": [], "attacks": []}
            catalog_path = os.path.join(GAME_DINOS_DIR, 'dinos.json')
            if os.path.exists(catalog_path):
                with open(catalog_path, 'r', encoding='utf-8') as f:
                    catalog.update(json.load(f))
            known_images = {d.get('image') for d in catalog['dinos'] + catalog['attacks']}
            card_files = glob.glob(os.path.join(GAME_DINOS_DIR, 'cartas', '*', '*.jpg')) + \
                glob.glob(os.path.join(GAME_DINOS_DIR, 'cartas', '*', '*.jpeg'))
            for img_path in sorted(card_files):
                element = os.path.basename(os.path.dirname(img_path))
                img = f"cartas/{element}/{os.path.basename(img_path)}"
                if img not in known_images:
                    dino_id = os.path.basename(img_path).rsplit('.', 1)[0].replace('_dinosaur_king', '')
                    catalog['dinos'].append({
                        "id": dino_id,
                        "name": dino_id.replace('_', ' ').title(),
                        "image": img,
                        "element": element if element in catalog['elements'] else "normal"
                    })
            data = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 1e. Servir tarjetas de dinos (assets/dinos/*.jpg y assets/dinos/cards/*.jpg)
        elif path.startswith('/assets/dinos/'):
            rel = urllib.parse.unquote(path[len('/assets/dinos/'):])
            target_path = os.path.normpath(os.path.join(GAME_DINOS_DIR, rel))
            if target_path.startswith(GAME_DINOS_DIR + os.sep) and os.path.isfile(target_path):
                with open(target_path, 'rb') as f:
                    content = f.read()
                ctype = 'image/png' if target_path.lower().endswith('.png') else 'image/jpeg'
                self.send_response(200)
                self.send_header('Content-Type', ctype)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Tarjeta no encontrada")
            return

        # 2. API: Listar proyectos y borradores guardados
        elif path == '/api/projects':
            # Los mapas que tiene el juego (assets/maps), sin las copias del mapa principal
            game_files = [os.path.basename(f) for f in glob.glob(os.path.join(GAME_MAPS_DIR, '*.json'))]
            all_maps = sorted(f for f in set(game_files + ['world_map.json']) if f not in HIDDEN_MAPS)
            all_maps.sort(key=lambda f: (f != 'world_map.json', f))
            data = json.dumps(all_maps).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        # 3. API: Cargar un proyecto específico
        elif path == '/api/project':
            proj_name = query.get('name', ['world_map.json'])[0]
            if not proj_name.endswith('.json'):
                proj_name += '.json'
            
            proj_path = os.path.join(PROJECTS_DIR, proj_name)
            game_path = os.path.join(GAME_MAPS_DIR, proj_name)

            # Siempre la versión del juego, salvo que haya un borrador guardado después
            target_path = game_path if os.path.exists(game_path) else None
            if os.path.exists(proj_path) and (not target_path or os.path.getmtime(proj_path) > os.path.getmtime(game_path)):
                target_path = proj_path

            if target_path and os.path.exists(target_path):
                with open(target_path, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_error(404, "Proyecto no encontrado")
            return

        # 3b. API: Tilesets para el Constructor de Objetos (los del juego + los PNG añadidos)
        elif path == '/api/builder_tilesets':
            game = [{"name": n, "url": f"/assets/maps/{n}"} for n in PALETTE_TILESETS
                    if os.path.exists(os.path.join(GAME_MAPS_DIR, n))]
            custom = [{"name": os.path.basename(f), "url": f"/custom_assets/{urllib.parse.quote(os.path.basename(f))}"}
                      for f in sorted(glob.glob(os.path.join(CUSTOM_ASSETS_DIR, '*.png')))]
            self._send_json({"game": game, "custom": custom})
            return

        # 3c. API: Listar objetos armados (assets/maps/objetos/*.json)
        elif path == '/api/objects':
            names = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(GAME_OBJECTS_DIR, '*.json')))
            self._send_json(names)
            return

        # 3d. API: Cargar un objeto para seguir editándolo
        elif path == '/api/object':
            name = safe_object_name(query.get('name', [''])[0])
            obj_path = os.path.join(GAME_OBJECTS_DIR, f"{name}.json")
            if name and os.path.exists(obj_path):
                with open(obj_path, 'r', encoding='utf-8') as f:
                    self._send_json(json.load(f))
            else:
                self.send_error(404, "Objeto no encontrado")
            return

        # 4a. Servir los PNG de objetos (assets/maps/objetos/<nombre>.png)
        elif urllib.parse.unquote(path).startswith('/assets/maps/objetos/'):
            filename = os.path.basename(urllib.parse.unquote(path))
            target_path = os.path.join(GAME_OBJECTS_DIR, filename)
            if filename.lower().endswith('.png') and os.path.isfile(target_path):
                with open(target_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            else:
                self.send_error(404, "Objeto no encontrado")
            return

        # 4. Servir imágenes de tilesets (desde el juego o desde custom_assets)
        elif path.startswith('/assets/maps/'):
            filename = os.path.basename(path)
            custom_path = os.path.join(CUSTOM_ASSETS_DIR, filename)
            game_path = os.path.join(GAME_MAPS_DIR, filename)

            # Solo los tilesets del juego, para que el editor se vea igual que el juego
            target_path = game_path if os.path.exists(game_path) else None
            
            # Fallback insensible a mayúsculas/minúsculas
            if not target_path or not os.path.exists(target_path):
                fn_lower = filename.lower()
                for d in [GAME_MAPS_DIR]:
                    for f in os.listdir(d):
                        if f.lower() == fn_lower:
                            target_path = os.path.join(d, f)
                            break
                    if target_path and os.path.exists(target_path):
                        break

            if target_path and os.path.exists(target_path):
                with open(target_path, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/png')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # 1. API: Guardar borrador / proyecto (sin tocar el juego)
        if path == '/api/project':
            try:
                proj_name = query.get('name', ['world_map.json'])[0]
                if not proj_name.endswith('.json'):
                    proj_name += '.json'

                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body.decode('utf-8'))

                save_path = os.path.join(PROJECTS_DIR, proj_name)
                with open(save_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)

                # Si es proyecto_actual o world_map, sincronizar ambos en projects/
                if proj_name in ('proyecto_actual.json', 'world_map.json'):
                    other_name = 'world_map.json' if proj_name == 'proyecto_actual.json' else 'proyecto_actual.json'
                    with open(os.path.join(PROJECTS_DIR, other_name), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)

                resp = json.dumps({"status": "ok", "message": f"Proyecto '{proj_name}' guardado en borrador."}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                print(f"  💾 Borrador guardado independientemente: {proj_name}")
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        # 2. API: Publicar al juego (Deploy)
        elif path == '/api/deploy':
            try:
                map_name = query.get('name', ['world_map.json'])[0]
                if not map_name.endswith('.json'):
                    map_name += '.json'

                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body.decode('utf-8'))

                # Guardar en assets/maps/<map_name> del juego
                game_map_file = os.path.join(GAME_MAPS_DIR, map_name)
                with open(game_map_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f)

                # Si es proyecto_actual o world_map, asegurar que world_map.json del juego reciba el nuevo diseño
                if map_name in ('proyecto_actual.json', 'world_map.json'):
                    world_map_file = os.path.join(GAME_MAPS_DIR, 'world_map.json')
                    with open(world_map_file, 'w', encoding='utf-8') as f:
                        json.dump(data, f)
                    proj_actual_file = os.path.join(GAME_MAPS_DIR, 'proyecto_actual.json')
                    with open(proj_actual_file, 'w', encoding='utf-8') as f:
                        json.dump(data, f)

                    # Mantener sincronizados ambos en projects/
                    with open(os.path.join(PROJECTS_DIR, 'world_map.json'), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                    with open(os.path.join(PROJECTS_DIR, 'proyecto_actual.json'), 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)

                # También guardar en projects/ para que quede respaldado
                proj_file = os.path.join(PROJECTS_DIR, map_name)
                with open(proj_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)

                # (Ya no se copian tilesets de custom_assets: el juego usa solo PALETTE_TILESETS)

                resp = json.dumps({"status": "ok", "message": f"¡Mapa '{map_name}' y assets publicados exitosamente al juego!"}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                print(f"  🚀 ¡MAPA '{map_name}' PUBLICADO Y SINCRONIZADO AL JUEGO PRINCIPAL!")
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        # 3. API: Subir un nuevo tileset PNG
        elif path == '/api/upload_tileset':
            try:
                filename = query.get('filename', ['nuevo_tileset.png'])[0]
                if not filename.endswith('.png'):
                    filename += '.png'

                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)

                target_file = os.path.join(CUSTOM_ASSETS_DIR, filename)
                with open(target_file, 'wb') as f:
                    f.write(body)

                resp = json.dumps({"status": "ok", "message": f"Tileset '{filename}' importado con éxito.", "filename": filename}).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                print(f"  🎨 Nuevo tileset importado al editor: {filename}")
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        # 4. API: Guardar un objeto armado tile por tile (PNG + JSON en assets/maps/objetos/)
        elif path == '/api/object':
            try:
                name = safe_object_name(query.get('name', [''])[0])
                if not name:
                    self.send_error(400, "Nombre de objeto inválido")
                    return

                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length).decode('utf-8'))
                png_b64 = data.pop('pngData', '').split(',', 1)[-1]

                os.makedirs(GAME_OBJECTS_DIR, exist_ok=True)
                with open(os.path.join(GAME_OBJECTS_DIR, f"{name}.png"), 'wb') as f:
                    f.write(base64.b64decode(png_b64))
                data['name'] = name
                data['png'] = f"objetos/{name}.png"
                data['tilesetKey'] = f"objetos/{name}"
                with open(os.path.join(GAME_OBJECTS_DIR, f"{name}.json"), 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2, ensure_ascii=False)

                self._send_json({"status": "ok", "name": name,
                                 "message": f"Objeto '{name}' guardado en assets/maps/objetos/{name}.png"})
                print(f"  🏠 Objeto guardado: assets/maps/objetos/{name}.png")
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        super().do_POST()

    def _send_json(self, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
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

def run():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), AdvanceMapRequestHandler) as httpd:
        print("=" * 65)
        print("  🗺️  DINO KING - ADVANCE MAP STUDIO (HERRAMIENTA INDEPENDIENTE)")
        print("=" * 65)
        print(f"  🚀 Editor activo en: http://localhost:{PORT}")
        print("  📁 Proyectos en: tools/map_editor/projects/")
        print("  🎨 Agrega nuevos tilesets en: tools/map_editor/custom_assets/")
        print("  🎮 Juego principal en: http://localhost:8000 (sin interferencias)")
        print("=" * 65)
        httpd.serve_forever()

if __name__ == '__main__':
    run()
