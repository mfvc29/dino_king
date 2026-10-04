#!/usr/bin/env python3
"""
Minimapa de Dino Rey: dibuja todos los mapas de assets/maps/ en una sola imagen
(assets/maps/minimapa.png) para ver las rutas sin entrar al juego.

- Parte del Pueblo Meteoro (world_map) y coloca cada mapa conectado por warps:
  si la salida está en un borde (norte/sur/este/oeste) el mapa se dibuja pegado a ese lado;
  si es una puerta interior (casas, cuevas a mitad de mapa) se dibuja aparte y se une con una línea.
- Losas: se pintan con su tileset; si el PNG del tileset no existe se usa un color según el terreno
  (pared, hierba alta, suelo).
- Marcas: 🔴 entrenador · 🔵 personaje · 🟡 personaje de la historia · 🟨 warp (puerta / salida).

Uso:  python3 tools/generar_minimapa.py [--escala 8]
"""

import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(ROOT, 'assets', 'maps')
OUT = os.path.join(MAPS_DIR, 'minimapa.png')
START = 'world_map'
SKIP = {'proyecto_actual', 'world_map_antiguo_backup'}  # copias del mismo mapa

SCALE = int(sys.argv[sys.argv.index('--escala') + 1]) if '--escala' in sys.argv else 8
GAP = 3 * SCALE          # separación entre mapas pegados
PANEL_GAP = 12 * SCALE   # separación de los mapas interiores
TITLE_H = 26
MARGIN = 40

COLORS = {
    'bg': (14, 17, 28), 'frame': (255, 190, 11), 'text': (240, 240, 235), 'muted': (150, 160, 180),
    'solid': (46, 82, 52), 'grass': (96, 170, 96), 'tall': (54, 128, 64), 'missing': (79, 162, 45),
    'trainer': (232, 17, 45), 'npc': (56, 140, 255), 'story': (255, 214, 10), 'warp': (255, 236, 64),
}


def font(size):
    for path in ('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                 '/usr/share/fonts/noto/NotoSans-Bold.ttf'):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def find_file(name):
    """Busca un archivo en assets/maps sin distinguir mayúsculas (como hace el servidor)."""
    if not name.lower().endswith('.png'):
        name += '.png'
    exact = os.path.join(MAPS_DIR, name)
    if os.path.exists(exact):
        return exact
    for f in os.listdir(MAPS_DIR):
        if f.lower() == name.lower():
            return os.path.join(MAPS_DIR, f)
    return None


_sheets = {}


def sheet(name):
    if name not in _sheets:
        path = find_file(name)
        _sheets[name] = Image.open(path).convert('RGBA') if path else None
    return _sheets[name]


def load_maps():
    maps = {}
    for f in sorted(os.listdir(MAPS_DIR)):
        if f.endswith('.json') and f[:-5] not in SKIP:
            try:
                maps[f[:-5]] = json.load(open(os.path.join(MAPS_DIR, f), encoding='utf-8'))
            except ValueError:
                pass
    return maps


def story_npcs():
    path = os.path.join(ROOT, 'assets', 'story', 'historia.json')
    try:
        return json.load(open(path, encoding='utf-8')).get('npcs', [])
    except (OSError, ValueError):
        return []


def map_name(map_id, data):
    try:
        names = json.load(open(os.path.join(ROOT, 'assets', 'story', 'historia.json'), encoding='utf-8')).get('mapNames', {})
    except (OSError, ValueError):
        names = {}
    name = names.get(map_id) or data.get('name') or map_id
    return name.replace('{player}', 'Fer').replace('{rival}', 'Ander')


def render_map(data):
    """Dibuja un mapa a 32 px por losa y lo reduce a SCALE px por losa."""
    cols, rows = data['cols'], data['rows']
    ts = data.get('tileSize', 32)
    sizes = {k.lower().replace('.png', ''): v for k, v in (data.get('tilesetTileSizes') or {}).items()}
    default_src = data.get('sourceTileSize', 16)
    img = Image.new('RGBA', (cols * ts, rows * ts), COLORS['grass'] + (255,))
    draw = ImageDraw.Draw(img)
    solid = data.get('solid') or []
    tall = data.get('tallGrass') or []

    # Color de respaldo según el terreno (por si faltan tilesets)
    for r in range(rows):
        for c in range(cols):
            if solid and solid[r][c]:
                color = COLORS['solid']
            elif tall and tall[r][c]:
                color = COLORS['tall']
            else:
                continue
            draw.rectangle((c * ts, r * ts, c * ts + ts - 1, r * ts + ts - 1), fill=color + (255,))

    for layer in data.get('layers') or []:
        if layer.get('visible') is False:
            continue
        for r, line in enumerate(layer.get('grid') or []):
            for c, cell in enumerate(line):
                if not cell:
                    continue
                name = str(cell[0])
                sh = sheet(name)
                if sh is None:
                    continue
                src = cell[3] if len(cell) > 3 and cell[3] else sizes.get(name.lower().replace('.png', ''), default_src)
                tile = sh.crop((cell[2] * src, cell[1] * src, cell[2] * src + src, cell[1] * src + src))
                if src != ts:
                    tile = tile.resize((ts, ts), Image.NEAREST)
                img.paste(tile, (c * ts, r * ts), tile)
    return img.resize((cols * SCALE, rows * SCALE), Image.BOX)


def edge_of(warp, data):
    """Lado del mapa donde está un warp ('n','s','e','o') o None si es una puerta interior."""
    x, y = warp['x'], warp['y']
    margin = 2
    if y <= margin:
        return 'n'
    if y >= data['rows'] - 1 - margin:
        return 's'
    if x <= margin:
        return 'o'
    if x >= data['cols'] - 1 - margin:
        return 'e'
    return None


def layout(maps):
    """Posición (en losas de minimapa) de cada mapa alcanzable desde START."""
    pos = {START: (0, 0)}
    links = []        # (mapaA, warpA, mapaB, (tx, ty)) para dibujar conexiones
    interiors = []    # mapas que van en el panel lateral
    queue = [START]
    while queue:
        a = queue.pop(0)
        da = maps[a]
        ax0, ay0 = pos[a]
        for w in da.get('warps') or []:
            b = str(w.get('targetMap', '')).replace('.json', '')
            if b not in maps:
                continue
            links.append((a, w, b))
            if b in pos or b in interiors:
                continue
            db = maps[b]
            tx, ty = int(w.get('targetX', 0)), int(w.get('targetY', 0))
            side = edge_of(w, da)
            if side == 'n':
                pos[b] = (ax0 + w['x'] - tx, ay0 - db['rows'] - GAP // SCALE - TITLE_H // SCALE - 1)
            elif side == 's':
                pos[b] = (ax0 + w['x'] - tx, ay0 + da['rows'] + GAP // SCALE + TITLE_H // SCALE + 1)
            elif side == 'o':
                pos[b] = (ax0 - db['cols'] - GAP // SCALE, ay0 + w['y'] - ty)
            elif side == 'e':
                pos[b] = (ax0 + da['cols'] + GAP // SCALE, ay0 + w['y'] - ty)
            else:
                # Puerta interior que lleva hacia "arriba" (p. ej. cueva al fondo de una ruta)
                if w['y'] < da['rows'] * 0.25 and ty >= db['rows'] * 0.6:
                    pos[b] = (ax0 + w['x'] - tx, ay0 - db['rows'] - GAP // SCALE - TITLE_H // SCALE - 1)
                else:
                    interiors.append(b)
                    continue
            queue.append(b)

    # Mapas interiores: columna a la derecha de todo lo demás
    right = max(x + maps[m]['cols'] for m, (x, y) in pos.items())
    top = min(y for x, y in pos.values())
    cy = top
    for m in interiors:
        pos[m] = (right + PANEL_GAP // SCALE, cy)
        cy += maps[m]['rows'] + (TITLE_H + PANEL_GAP) // SCALE + 2
        # lo que cuelga de un interior también se coloca en la columna
        for w in maps[m].get('warps') or []:
            b = str(w.get('targetMap', '')).replace('.json', '')
            if b in maps and b not in pos and b not in interiors:
                interiors.append(b)
    # Mapas sueltos (sin conexión): debajo de la columna lateral
    loose = [m for m in maps if m not in pos]
    for m in loose:
        pos[m] = (right + PANEL_GAP // SCALE, cy)
        cy += maps[m]['rows'] + (TITLE_H + PANEL_GAP) // SCALE + 2
    return pos, links, loose


def main():
    maps = load_maps()
    if START not in maps:
        sys.exit('No se encontró world_map.json')
    pos, links, loose = layout(maps)
    snpcs = story_npcs()

    minx = min(x for x, y in pos.values())
    miny = min(y for x, y in pos.values())
    maxx = max(x + maps[m]['cols'] for m, (x, y) in pos.items())
    maxy = max(y + maps[m]['rows'] for m, (x, y) in pos.items())
    legend_h = 70
    W = (maxx - minx) * SCALE + MARGIN * 2 + 160  # espacio extra para títulos y nombres del borde derecho
    H = (maxy - miny) * SCALE + MARGIN * 2 + TITLE_H + legend_h
    canvas = Image.new('RGBA', (W, H), COLORS['bg'] + (255,))
    d = ImageDraw.Draw(canvas)
    f_title, f_small, f_big = font(15), font(11), font(22)

    def px(m, tx, ty):
        x, y = pos[m]
        return MARGIN + (x - minx) * SCALE + tx * SCALE + SCALE // 2, MARGIN + TITLE_H + legend_h + (y - miny) * SCALE + ty * SCALE + SCALE // 2

    # Título y leyenda
    d.text((MARGIN, 12), 'DINO REY · Minimapa de rutas', font=f_big, fill=COLORS['frame'])
    lx = MARGIN
    for label, color in (('Entrenador', COLORS['trainer']), ('Personaje', COLORS['npc']),
                         ('Historia', COLORS['story']), ('Puerta / salida', COLORS['warp'])):
        d.ellipse((lx, 50, lx + 12, 62), fill=color, outline=(0, 0, 0))
        d.text((lx + 18, 48), label, font=f_small, fill=COLORS['text'])
        lx += 130

    # Mapas
    for m, (x, y) in pos.items():
        data = maps[m]
        ox, oy = px(m, 0, 0)
        ox -= SCALE // 2
        oy -= SCALE // 2
        canvas.paste(render_map(data), (ox, oy))
        d.rectangle((ox - 2, oy - 2, ox + data['cols'] * SCALE + 1, oy + data['rows'] * SCALE + 1), outline=COLORS['frame'], width=2)
        title = f"{map_name(m, data)}  ({data['cols']}x{data['rows']})" + ('  · sin conexión' if m in loose else '')
        d.text((ox, oy - 20), title, font=f_title, fill=COLORS['text'])

    # Conexiones entre warps
    for a, w, b in links:
        x1, y1 = px(a, w['x'], w['y'])
        x2, y2 = px(b, int(w.get('targetX', 0)), int(w.get('targetY', 0)))
        if abs(x1 - x2) + abs(y1 - y2) > SCALE * 6:
            d.line((x1, y1, x2, y2), fill=COLORS['warp'] + (160,), width=2)

    # Warps y personajes
    for m, data in maps.items():
        for w in data.get('warps') or []:
            x, y = px(m, w['x'], w['y'])
            d.rectangle((x - SCALE // 2, y - SCALE // 2, x + SCALE // 2, y + SCALE // 2), outline=COLORS['warp'], width=2)
        npcs = [(n, False) for n in data.get('npcs') or []] + [(n, True) for n in snpcs if n.get('map') == m]
        for n, is_story in npcs:
            x, y = px(m, int(n['x']), int(n['y']))
            color = COLORS['story'] if is_story else (COLORS['trainer'] if n.get('type', 'trainer') == 'trainer' else COLORS['npc'])
            rad = max(4, SCALE // 2 + 1)
            d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=color, outline=(0, 0, 0), width=1)
            name = str(n.get('name', '')).replace('{rival}', 'Ander').split(',')[0]
            d.text((x + rad + 2, y - 7), name, font=f_small, fill=COLORS['text'], stroke_width=2, stroke_fill=(0, 0, 0))

    canvas.convert('RGB').save(OUT, optimize=True)
    print(f'🗺️  Minimapa guardado en {OUT} ({W}x{H}, {len(pos)} mapas)')
    missing = sorted(n for n, s in _sheets.items() if s is None)
    if missing:
        print('⚠️  Tilesets que no existen (se pintan con colores de terreno):', ', '.join(missing))


if __name__ == '__main__':
    main()
