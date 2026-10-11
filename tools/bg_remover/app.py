#!/usr/bin/env python3
"""
Dino King - QuitaFondos Studio (Herramienta Web Independiente)
Miniaplicación visual e interactiva para eliminar y retocar fondos de imágenes y cartas.

- Servidor local en http://localhost:8085
- Selección en dos pasos: Carpeta/Categoría -> Imagen (ideal para cartas y dinos individuales)
- Soporte para edición manual completa (Pincel borrador, Pincel restaurador, Varita mágica, Deshacer/Rehacer)
- Guardado directo como PNG con soporte para actualizar izquierda/ y derecha/ automáticamente
"""

import os
import sys
import json
import glob
import mimetypes
import http.server
import socketserver
import urllib.parse
import base64
import io
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cli import remove_white_background

PORT = 8085
APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(APP_DIR, '..', '..'))
ASSETS_DINOS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'dinos')
STATIC_DIR = os.path.join(APP_DIR, 'static')
CACHE_DIR = os.path.join(APP_DIR, 'cache')

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(CACHE_DIR, exist_ok=True)

class BgRemoverHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path in ('/', '/index.html'):
            self.serve_file(os.path.join(STATIC_DIR, 'index.html'), 'text/html')
            return
        elif path == '/style.css':
            self.serve_file(os.path.join(STATIC_DIR, 'style.css'), 'text/css')
            return
        elif path == '/app.js':
            self.serve_file(os.path.join(STATIC_DIR, 'app.js'), 'application/javascript')
            return
        elif path == '/api/folders':
            self.handle_list_folders()
            return
        elif path == '/api/folder_images':
            folder_param = query.get('folder', [''])[0]
            self.handle_list_folder_images(folder_param)
            return
        elif path == '/api/image':
            img_path = query.get('path', [None])[0]
            if not img_path:
                self.send_error(400, "Falta parámetro 'path'")
                return
            
            full_path = os.path.abspath(img_path)
            user_home = os.path.expanduser('~')
            if not (full_path.startswith(PROJECT_ROOT) or full_path.startswith(CACHE_DIR) or full_path.startswith(user_home)):
                self.send_error(403, "Acceso no permitido")
                return

            if not os.path.exists(full_path):
                self.send_error(404, f"No encontrado: {img_path}")
                return

            mime, _ = mimetypes.guess_type(full_path)
            self.serve_file(full_path, mime or 'image/png')
            return
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)

        try:
            if path == '/api/process':
                data = json.loads(post_data.decode('utf-8'))
                self.handle_process(data)
            elif path == '/api/save':
                data = json.loads(post_data.decode('utf-8'))
                self.handle_save(data)
            elif path == '/api/batch':
                data = json.loads(post_data.decode('utf-8'))
                self.handle_batch(data)
            else:
                self.send_error(404, "Endpoint no encontrado")
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

    def serve_file(self, filepath, content_type):
        if not os.path.exists(filepath):
            self.send_error(404, f"Archivo no encontrado: {filepath}")
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.end_headers()
        with open(filepath, 'rb') as f:
            self.wfile.write(f.read())

    def handle_list_folders(self):
        """Lista todas las subcarpetas dentro de assets/dinos/ con imágenes."""
        folders = []
        
        # Recorrer todos los directorios dentro de ASSETS_DINOS_DIR
        for root, dirs, files in os.walk(ASSETS_DINOS_DIR):
            # Omitir carpetas 'izquierda' y 'derecha' de la lista principal de carpetas
            basename = os.path.basename(root)
            if basename in ('izquierda', 'derecha', 'cache', '.git'):
                continue
                
            img_files = [f for f in files if f.lower().endswith(('.jpeg', '.jpg', '.png')) and not f.startswith('.')]
            if img_files:
                rel = os.path.relpath(root, ASSETS_DINOS_DIR)
                label = rel.replace('/', ' ➔ ').upper()
                
                # Clasificar grupo
                group = "Cartas" if "cards" in rel else ("Grandes" if "grande" in rel else "Base")
                
                folders.append({
                    'id': rel,
                    'full_path': root,
                    'label': label,
                    'group': group,
                    'count': len(img_files)
                })

        folders.sort(key=lambda x: (
            0 if "cards" in x['id'] else (1 if "grande" in x['id'] else 2),
            x['id']
        ))

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'folders': folders}).encode('utf-8'))

    def handle_list_folder_images(self, folder_rel):
        """Lista las imágenes dentro de una carpeta seleccionada."""
        folder_clean = (folder_rel or '').strip()
        if not folder_clean:
            self.send_error(400, "Parámetro 'folder' vacío")
            return

        if os.path.isabs(folder_clean) and os.path.exists(folder_clean):
            full_dir = folder_clean
        elif os.path.exists(os.path.join(PROJECT_ROOT, folder_clean)):
            full_dir = os.path.join(PROJECT_ROOT, folder_clean)
        else:
            full_dir = os.path.join(ASSETS_DINOS_DIR, folder_clean)

        if not os.path.exists(full_dir):
            self.send_error(404, f"Carpeta no existe: {folder_rel}")
            return

        images = []
        extensions = ('*.jpeg', '*.jpg', '*.JPEG', '*.JPG')
        seen_names = set()

        for ext in extensions:
            for filepath in glob.glob(os.path.join(full_dir, ext)):
                fname = os.path.basename(filepath)
                if fname in seen_names or fname.startswith('.'):
                    continue
                seen_names.add(fname)

                base_name, fext = os.path.splitext(fname)
                png_sibling = os.path.join(full_dir, base_name + '.png')
                has_png = os.path.exists(png_sibling)

                images.append({
                    'name': fname,
                    'base_name': base_name,
                    'extension': fext.lower(),
                    'full_path': filepath,
                    'has_png': has_png,
                    'png_path': png_sibling if has_png else None
                })

        # Ordenar estrictamente por nombre de archivo de forma alfabética (case-insensitive)
        images.sort(key=lambda x: x['name'].lower())

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'images': images}).encode('utf-8'))

    def handle_process(self, data):
        img_path = data.get('image_path')
        if not img_path:
            raise ValueError("Falta 'image_path'")

        full_input = img_path
        if not (os.path.isabs(full_input) and os.path.exists(full_input)):
            if os.path.exists(os.path.join(PROJECT_ROOT, img_path)):
                full_input = os.path.join(PROJECT_ROOT, img_path)
            elif os.path.exists(os.path.join(ASSETS_DINOS_DIR, img_path)):
                full_input = os.path.join(ASSETS_DINOS_DIR, img_path)
            else:
                full_input = os.path.abspath(img_path)

        if not os.path.exists(full_input):
            raise FileNotFoundError(f"No existe: {full_input}")

        tolerance = float(data.get('tolerance', 25.0))
        mode = data.get('mode', 'smart')
        clean_pockets = bool(data.get('clean_pockets', True))
        min_pocket_size = int(data.get('min_pocket_size', 1000))
        choke = int(data.get('choke', 1))
        feather = float(data.get('feather', 0.8))
        trim = bool(data.get('trim', False))

        result_img = remove_white_background(
            full_input,
            tolerance=tolerance,
            mode=mode,
            clean_pockets=clean_pockets,
            min_pocket_size=min_pocket_size,
            choke=choke,
            feather=feather,
            trim=trim
        )

        cached_filename = "preview_current.png"
        cached_path = os.path.join(CACHE_DIR, cached_filename)
        result_img.save(cached_path, format="PNG")

        orig_img = Image.open(full_input)
        orig_w, orig_h = orig_img.size
        proc_w, proc_h = result_img.size

        import numpy as np
        alpha_arr = np.array(result_img)[:, :, 3]
        transparent_pct = float(np.mean(alpha_arr == 0) * 100.0)

        response_data = {
            'success': True,
            'preview_url': f'/api/image?path={urllib.parse.quote(cached_path)}',
            'orig_size': [orig_w, orig_h],
            'proc_size': [proc_w, proc_h],
            'transparent_percent': round(transparent_pct, 2)
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def handle_save(self, data):
        img_path = data.get('image_path')
        target_path = data.get('target_path')
        image_data = data.get('image_data') # base64 data url opcional si se editó en canvas
        update_directions = bool(data.get('update_directions', True))

        if not target_path:
            base, _ = os.path.splitext(img_path)
            target_path = base + ".png"

        target_full = os.path.abspath(target_path)
        os.makedirs(os.path.dirname(target_full), exist_ok=True)

        if image_data and image_data.startswith('data:image'):
            # Guardar directamente la imagen editada manualmente desde el canvas
            header, encoded = image_data.split(',', 1)
            raw_bytes = base64.b64decode(encoded)
            final_img = Image.open(io.BytesIO(raw_bytes))
            final_img.save(target_full, format="PNG")
        else:
            cached_path = os.path.join(CACHE_DIR, "preview_current.png")
            if not os.path.exists(cached_path):
                raise FileNotFoundError("Primero debes procesar o editar una imagen antes de guardar.")
            final_img = Image.open(cached_path)
            final_img.save(target_full, format="PNG")

        # Actualizar carpetas izquierda/ y derecha/ si existen en el mismo directorio
        parent_dir = os.path.dirname(target_full)
        izq_dir = os.path.join(parent_dir, 'izquierda')
        der_dir = os.path.join(parent_dir, 'derecha')

        if update_directions and os.path.isdir(izq_dir) and os.path.isdir(der_dir):
            import numpy as np
            fname = os.path.basename(target_full)
            arr = np.array(final_img)[:, :, 3] > 0
            h, w = arr.shape
            non_empty_y = np.where(np.any(arr, axis=1))[0]
            if len(non_empty_y) > 0:
                min_y = non_empty_y[0]
                max_y = non_empty_y[-1]
                head_band = arr[min_y : min_y + int((max_y - min_y) * 0.30), :]
                xs = np.where(head_band)[1]
                mean_x = np.mean(xs) / w if len(xs) > 0 else 0.5
            else:
                mean_x = 0.5

            is_facing_right = (mean_x >= 0.5)
            if 'carnotaurus' in fname.lower() or 'ceratosaurus' in fname.lower():
                is_facing_right = True

            if is_facing_right:
                img_der = final_img
                img_izq = final_img.transpose(Image.FLIP_LEFT_RIGHT)
            else:
                img_izq = final_img
                img_der = final_img.transpose(Image.FLIP_LEFT_RIGHT)

            img_izq.save(os.path.join(izq_dir, fname), format="PNG")
            img_der.save(os.path.join(der_dir, fname), format="PNG")

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': True,
            'saved_path': target_full,
            'rel_path': os.path.relpath(target_full, PROJECT_ROOT)
        }).encode('utf-8'))

    def handle_batch(self, data):
        folder_path = data.get('folder_path')
        if not folder_path:
            raise ValueError("Falta 'folder_path'")

        full_folder = os.path.abspath(folder_path)
        if not os.path.isdir(full_folder):
            raise NotADirectoryError(f"No es un directorio válido: {full_folder}")

        tolerance = float(data.get('tolerance', 25.0))
        mode = data.get('mode', 'smart')
        choke = int(data.get('choke', 1))
        feather = float(data.get('feather', 0.8))
        trim = bool(data.get('trim', False))

        processed_files = []
        for ext in ('*.jpeg', '*.jpg'):
            for img_file in glob.glob(os.path.join(full_folder, ext)):
                base, _ = os.path.splitext(img_file)
                out_png = base + ".png"
                res = remove_white_background(
                    img_file,
                    tolerance=tolerance,
                    mode=mode,
                    choke=choke,
                    feather=feather,
                    trim=trim
                )
                res.save(out_png, format="PNG")
                processed_files.append(os.path.basename(out_png))

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            'success': True,
            'processed_count': len(processed_files),
            'files': processed_files
        }).encode('utf-8'))

def run_server():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), BgRemoverHandler) as httpd:
        print(f"=================================================================")
        print(f"  🦖 DINO KING - QUITAFONDOS STUDIO (CON EDICIÓN MANUAL Y CARTAS)")
        print(f"=================================================================")
        print(f"  🚀 Activo en: http://localhost:{PORT}")
        print(f"  📁 Selector: Carpeta ➔ Imagen (soporta /cards/, /grande/, etc.)")
        print(f"  🖌️  Herramientas: Pincel Borrador, Pincel Restaurador, Varita Mágica")
        print(f"=================================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDeteniendo QuitaFondos Studio...")
            httpd.server_close()

if __name__ == '__main__':
    run_server()
