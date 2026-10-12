#!/usr/bin/env python3
"""
Generador de rutas de Dino Rey.

Cada mapa se dibuja como texto (una letra por losa) y este script lo convierte al formato
del juego / editor (assets/maps/<id>.json): capas de losas, colisiones (solid), hierba alta
(tallGrass), warps y personajes.  Elige automáticamente los bordes de caminos, agua y paredes.

Uso:
    python3 tools/generar_rutas.py            # genera todos los mapas
    python3 tools/generar_rutas.py --preview  # además guarda una vista previa PNG en tools/vistas/

Tilesets usados (losas de 32 px): assets/maps/Outside.png y assets/maps/Caves.png

Leyenda exterior (Outside.png):
    .  pasto            ,  hierba alta (aparecen dinos salvajes)   f  flores
    =  camino de tierra  W  agua (estanque)                        T  bosque (sólido)
    b  arbusto: atajo que sólo se abre cortándolo con un dino de Planta
    P  pino suelto (ocupa 2x3, se marca en la esquina superior izquierda)
    r  roca             M  pared de roca / acantilado               D  entrada de cueva
    S  suelo de piedra   A  cancha de combate                       B  edificio del estadio (8x12, esquina sup. izq.)
Leyenda cueva (Caves.png):
    .  suelo            ,  suelo con dinos salvajes   #  pared de roca
    o  roca suelta      L  escalera de salida

Encima del dibujo se colocan objetos del Constructor de Objetos (assets/maps/objetos/) con
place(mapa, 'casa_1', x, y): montañas, árboles, casas, estatuas, gemas... (ver build_all).
"""

import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPS_DIR = os.path.join(ROOT, 'assets', 'maps')
DINOS = json.load(open(os.path.join(ROOT, 'assets', 'dinos', 'dinos.json'), encoding='utf-8'))
DINO_BY_ID = {d['id']: d for d in DINOS['dinos']}

TS = 32  # tamaño de losa en el tileset y en el juego


# ============================================================
# Utilidades
# ============================================================
def auto_attacks(species, level, i=0):
    """Los 2 ataques del dino a su nivel: el más fuerte de su elemento (con recarga en combate) y el
    siguiente, o uno normal si todavía no sabe otro (igual que getDefaultAttacks en js/cards.js)."""
    el = DINO_BY_ID[species]['element']
    learn = [a for a in DINOS['attacks'] if not a.get('moveCard') and a.get('level', 1) <= level and a['power'] > 0]
    own = sorted([a for a in learn if a['element'] == el], key=lambda a: -a['power'])
    nor = sorted([a for a in learn if a['element'] == 'normal'], key=lambda a: -a['power'])
    picked = []
    for a in own[:2] + nor + own:
        if a not in picked:
            picked.append(a)
        if len(picked) == 2:
            break
    return [a['id'] for a in sorted(picked, key=lambda a: -a['power'])]


def normalize_attacks(species, attacks, level):
    """Cualquier lista de ataques -> 2: [el más fuerte, el siguiente]."""
    by_id = {a['id']: a for a in DINOS['attacks']}
    lst = [by_id[x] for x in dict.fromkeys(attacks or []) if x in by_id and by_id[x]['power'] > 0]
    if len(lst) < 2:
        return auto_attacks(species, level)
    return [a['id'] for a in sorted(lst, key=lambda a: -a['power'])[:2]]


def trainer(npc_id, x, y, name, sprite, direction, team, move_card, dialog, defeat, sight=4, exp=80, ai='dificil'):
    """Entrenador con equipo de 3 dinos [(especie, nivel[, ataques])] y carta de movimiento."""
    full = []
    for i, entry in enumerate(team):
        species, level = entry[0], entry[1]
        attacks = normalize_attacks(species, entry[2], level) if len(entry) > 2 else auto_attacks(species, level, i)
        d = DINO_BY_ID[species]
        full.append({'species': species, 'name': d['name'], 'element': d['element'],
                     'image': d['image'], 'card': d['card'], 'level': level, 'attacks': attacks})
    return {'id': npc_id, 'x': x, 'y': y, 'name': name, 'sprite': sprite, 'direction': direction,
            'type': 'trainer', 'sightRange': sight, 'dialog': dialog, 'defeatDialog': defeat,
            'team': full, 'rewardExp': exp, 'ai': ai}   # move_card: ya no se usa (no hay cartas de movimiento)


def person(npc_id, x, y, name, sprite, direction, dialog):
    return {'id': npc_id, 'x': x, 'y': y, 'name': name, 'sprite': sprite, 'direction': direction,
            'type': 'npc', 'sightRange': 0, 'dialog': dialog, 'defeatDialog': '', 'team': [],
            'rewardExp': 0}


_EMPTY_CACHE = {}


def is_empty_tile(sheet, r, c):
    """Losas vacías del tileset: transparentes o con la "X" roja de relleno."""
    key = (sheet, r, c)
    if key not in _EMPTY_CACHE:
        from PIL import Image
        if sheet not in _EMPTY_CACHE:
            _EMPTY_CACHE[sheet] = Image.open(os.path.join(MAPS_DIR, f'{sheet}.png')).convert('RGBA')
        tile = _EMPTY_CACHE[sheet].crop((c * TS, r * TS, c * TS + TS, r * TS + TS))
        px = tile.load()
        center = px[TS // 2, TS // 2]
        corner = px[2, TS // 2]
        red_x = center[0] > 200 and center[1] < 60 and center[2] < 60 and corner[3] > 0 and corner[0] > 200 and corner[1] > 200
        _EMPTY_CACHE[key] = red_x or tile.getextrema()[3][1] == 0
    return _EMPTY_CACHE[key]


def parse(layout):
    rows = [line for line in layout.strip('\n').split('\n')]
    width = max(len(r) for r in rows)
    return [r.ljust(width, rows[0][0]) for r in rows]


def edge_tile(grid, r, c, kinds, top, mid, bottom, left_col, mid_col, right_col):
    """Elige la losa de borde (3x3) según qué vecinos son del mismo tipo."""
    H, W = len(grid), len(grid[0])
    same = lambda rr, cc: not (0 <= rr < H and 0 <= cc < W) or grid[rr][cc] in kinds
    row = top if not same(r - 1, c) else (bottom if not same(r + 1, c) else mid)
    if not same(r - 1, c) and not same(r + 1, c):
        row = mid
    col = left_col if not same(r, c - 1) else (right_col if not same(r, c + 1) else mid_col)
    if not same(r, c - 1) and not same(r, c + 1):
        col = mid_col
    return row, col


def new_map(map_id, name, grid, tilesets):
    H, W = len(grid), len(grid[0])
    return {
        'version': 2, 'name': name, 'cols': W, 'rows': H, 'tileSize': TS, 'sourceTileSize': TS,
        'tilesets': tilesets, 'tilesetTileSizes': {k: TS for k in tilesets},
        'layers': [
            {'id': 'layer_0', 'name': 'Base', 'visible': True, 'grid': [[None] * W for _ in range(H)]},
            {'id': 'layer_1', 'name': 'Terreno', 'visible': True, 'grid': [[None] * W for _ in range(H)]},
            {'id': 'layer_2', 'name': 'Decoración', 'visible': True, 'grid': [[None] * W for _ in range(H)]},
        ],
        'warps': [], 'npcs': [],
        'solid': [[0] * W for _ in range(H)],
        'tallGrass': [[0] * W for _ in range(H)],
        '_id': map_id,
    }


# ============================================================
# Exterior (Outside.png)
# ============================================================
GRASS = [(0, 1), (0, 1), (0, 2), (0, 3), (0, 4), (0, 5)]
TALL_GRASS = (0, 6)
FLOWERS = (3, 7)
ROCK = (101, 7)


def build_outside(map_id, name, layout, seed=1):
    rnd = random.Random(seed)
    grid = parse(layout)
    H, W = len(grid), len(grid[0])
    m = new_map(map_id, name, grid, {'Outside': 'Outside.png'})
    base, terrain, decor = (L['grid'] for L in m['layers'])
    put = lambda layer, r, c, t: layer[r].__setitem__(c, ['Outside', t[0], t[1], TS])

    for r in range(H):
        for c in range(W):
            ch = grid[r][c]
            put(base, r, c, rnd.choice(GRASS))
            if ch == ',':
                put(decor, r, c, TALL_GRASS)
                m['tallGrass'][r][c] = 1
            elif ch == 'f':
                put(decor, r, c, FLOWERS)
            elif ch == '=':
                put(terrain, r, c, edge_tile(grid, r, c, '=D', 12, 13, 14, 1, 2, 3))
            elif ch == 'W':
                put(terrain, r, c, edge_tile(grid, r, c, 'W', 86, 87, 88, 5, 6, 7))
                m['solid'][r][c] = 1
            elif ch == 'T':
                # Bosque continuo: filas 52/53 alternas y 54 (troncos) en el borde inferior
                d = 0
                while r + d + 1 < H and grid[r + d + 1][c] == 'T':
                    d += 1
                if r + d + 1 >= H:
                    row = 52 + (r % 2)
                else:
                    row = 54 if d == 0 else (53 if d % 2 == 1 else 52)
                put(terrain, r, c, (row, c % 2))
                m['solid'][r][c] = 1
            elif ch == 'r':
                put(decor, r, c, ROCK)
                m['solid'][r][c] = 1
            elif ch == 'M':
                # Pared de roca: borde superior (98), cara (99) y base (100)
                up = r > 0 and grid[r - 1][c] in 'MD'
                down = r + 1 < H and grid[r + 1][c] in 'MD'
                row = 98 if not up else (100 if not down else 99)
                put(terrain, r, c, (row, 3 + (c % 2)))
                m['solid'][r][c] = 1
            elif ch == 'D':
                put(terrain, r, c, (100, 6))
            elif ch == 'S':
                put(terrain, r, c, (50, 1))
            elif ch == 'A':
                put(terrain, r, c, (50, 1))
                put(decor, r, c, edge_tile(grid, r, c, 'A', 49, 50, 51, 5, 6, 7))
            elif ch == 'B':
                # Edificio del estadio: 8 x 12 losas (filas 211-222 del tileset), sólido salvo la puerta
                for dr in range(12):
                    for dc in range(8):
                        if r + dr < H and c + dc < W and not is_empty_tile('Outside', 211 + dr, dc):
                            put(decor, r + dr, c + dc, (211 + dr, dc))
                            m['solid'][r + dr][c + dc] = 1
            elif ch == 'P':
                for dr in range(3):
                    for dc in range(2):
                        if r + dr < H and c + dc < W:
                            put(decor, r + dr, c + dc, (52 + dr, 4 + dc))
                for dc in range(2):
                    if r + 2 < H and c + dc < W:
                        m['solid'][r + 2][c + dc] = 1
                        m['solid'][r + 1][c + dc] = 1
    return m, grid


# ============================================================
# Cueva (Caves.png)
# ============================================================
CAVE_FLOOR = [(28, 5), (28, 5), (28, 6), (27, 5), (29, 5)]
CAVE_DARK = [(28, 1), (28, 2)]
CAVE_ROCKS = [(21, 5), (22, 6), (22, 7)]
CAVE_LADDER = (19, 4)

# Temas de Caves.png: paredes (fila de arriba, centro, base; columnas 0-2), suelo, suelo con dinos, rocas y escalera
CAVE_THEMES = {
    'brown': {'walls': (21, 22, 24), 'floor': CAVE_FLOOR, 'dark': CAVE_DARK, 'rocks': CAVE_ROCKS, 'ladder': CAVE_LADDER,
              'deco': [[(21, 7)], [(22, 7)]], 'boulder': 15},
    'snow': {'walls': (84, 85, 87), 'floor': [(100, 5), (100, 5), (100, 6), (101, 5)], 'dark': [(108, 5), (108, 6)],
             'rocks': [(85, 5)], 'ladder': (82, 4), 'deco': [[(84, 5)]], 'boulder': 78},
    'ice': {'walls': (92, 93, 95), 'floor': [(124, 5), (124, 5), (124, 6), (125, 5)], 'dark': [(108, 5), (108, 6)],
            'rocks': [(122, 6), (122, 7)], 'ladder': (118, 4), 'deco': [[(120, 7)], [(121, 7)]], 'boulder': 114},
}


def build_cave(map_id, name, layout, seed=2, theme='brown'):
    t = CAVE_THEMES[theme]
    rnd = random.Random(seed)
    grid = parse(layout)
    H, W = len(grid), len(grid[0])
    m = new_map(map_id, name, grid, {'Caves': 'Caves.png'})
    base, terrain, decor = (L['grid'] for L in m['layers'])
    put = lambda layer, r, c, tile: layer[r].__setitem__(c, ['Caves', tile[0], tile[1], TS])
    floor = lambda rr, cc: 0 <= rr < H and 0 <= cc < W and grid[rr][cc] != '#'
    top, mid, bottom = t['walls']

    for r in range(H):
        for c in range(W):
            ch = grid[r][c]
            if ch == '#':
                row = bottom if floor(r + 1, c) else (top if floor(r - 1, c) else mid)
                col = 0 if floor(r, c - 1) else (2 if floor(r, c + 1) else 1)
                put(base, r, c, (row, col))
                m['solid'][r][c] = 1
                continue
            put(base, r, c, rnd.choice(t['dark'] if ch == ',' else t['floor']))
            if ch == ',':
                m['tallGrass'][r][c] = 1
            elif ch == 'o':
                put(decor, r, c, rnd.choice(t['rocks']))
                m['solid'][r][c] = 1
            elif ch == 'L':
                put(decor, r, c, t['ladder'])
    return m, grid


def cave_floor_layout(w, h, seed, rooms=4, loops=0.06, dark=0.5):
    """Laberinto de túneles (2 de ancho, paredes de 2) con cámaras redondas y bordes irregulares,
    generado con una semilla fija. Devuelve (texto, callejones sin salida del más lejano al más cercano)."""
    from collections import deque
    rnd = random.Random(seed)
    cw, ch = (w - 2) // 4, (h - 4) // 4
    g = [['#'] * w for _ in range(h)]
    cell = lambda cx, cy: (2 + cx * 4, 2 + cy * 4)            # esquina sup. izq. del bloque 2x2

    def carve(x0, y0, x1, y1, c='.'):
        for y in range(max(2, y0), min(h - 3, y1) + 1):
            for x in range(max(2, x0), min(w - 3, x1) + 1):
                g[y][x] = c

    start = (cw // 2, ch - 1)
    links = {start: set()}
    stack, seen = [start], {start}
    while stack:
        cx, cy = stack[-1]
        nb = [(cx + dx, cy + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
              if 0 <= cx + dx < cw and 0 <= cy + dy < ch and (cx + dx, cy + dy) not in seen]
        if not nb:
            stack.pop()
            continue
        nx, ny = rnd.choice(nb)
        seen.add((nx, ny)); stack.append((nx, ny))
        links.setdefault((cx, cy), set()).add((nx, ny)); links.setdefault((nx, ny), set()).add((cx, cy))
    # algunos atajos para que no sea un solo camino
    for cx in range(cw):
        for cy in range(ch):
            for dx, dy in ((1, 0), (0, 1)):
                n = (cx + dx, cy + dy)
                if n[0] < cw and n[1] < ch and n not in links[(cx, cy)] and rnd.random() < loops:
                    links[(cx, cy)].add(n); links[n].add((cx, cy))
    for (cx, cy), ns in links.items():
        x, y = cell(cx, cy)
        carve(x, y, x + 1, y + 1)
        for nx, ny in ns:
            X, Y = cell(nx, ny)
            carve(min(x, X), min(y, Y), max(x, X) + 1, max(y, Y) + 1)
    # bordes irregulares: la roca se desgasta un poco junto a los túneles
    for y in range(3, h - 4):
        for x in range(3, w - 3):
            if g[y][x] == '#' and rnd.random() < 0.22 and sum(g[y + dy][x + dx] == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) == 1:
                g[y][x] = 'e'
    for y in range(h):
        for x in range(w):
            if g[y][x] == 'e':
                g[y][x] = '.'
    # cámaras redondas (algunas con suelo donde aparecen dinos salvajes)
    room_cells = set()
    for _ in range(rooms):
        rx, ry = rnd.randint(1, cw - 2), rnd.randint(0, ch - 2)
        X, Y = cell(rx, ry)
        a, b = rnd.uniform(3.5, 5.5), rnd.uniform(2.6, 3.8)
        is_dark = rnd.random() < dark
        for y in range(2, h - 3):
            for x in range(2, w - 2):
                d = ((x - X - 0.5) / a) ** 2 + ((y - Y - 0.5) / b) ** 2
                if d <= 1:
                    g[y][x] = ',' if is_dark and d <= 0.55 else '.'
                    room_cells.add((x, y))
    # tramos de túnel con dinos salvajes
    for (cx, cy) in links:
        if rnd.random() < dark * 0.3:
            x, y = cell(cx, cy)
            carve(x, y, x + 1, y + 1, ',')
    # escalera de subida debajo de la entrada
    sx, sy = cell(*start)
    carve(sx, sy, sx, h - 3)
    g[h - 2][sx] = 'L'
    # callejones sin salida (1 sola conexión), del más lejano al más cercano a la entrada
    dist = {start: 0}; q = deque([start])
    while q:
        c0 = q.popleft()
        for n in links[c0]:
            if n not in dist:
                dist[n] = dist[c0] + 1; q.append(n)
    ends = [c0 for c0, ns in links.items() if len(ns) == 1 and c0 != start and cell(*c0) not in room_cells
            and dist.get(c0, 0) >= 4]
    ends.sort(key=lambda c0: -dist.get(c0, 0))
    return '\n'.join(''.join(r) for r in g), [cell(*c0) for c0 in ends]


# ============================================================
# Objetos armados en el Constructor de Objetos (assets/maps/objetos/<nombre>.json + .png)
# ============================================================
OBJ_DIR = os.path.join(MAPS_DIR, 'objetos')
OBJ_SHEETS = {'Outside.png': 'Outside', 'Caves.png': 'Caves', 'charcos.png': 'charcos'}
sheet_key = lambda f: OBJ_SHEETS.get(f, f[:-4] if f.lower().endswith('.png') else f)  # 'objetos_para_casa.png' -> 'objetos_para_casa'
_OBJ_CACHE = {}


def load_object(name):
    """Celdas del objeto con su cobertura (fracción de píxeles visibles) para decidir colisiones."""
    if name not in _OBJ_CACHE:
        from PIL import Image
        data = json.load(open(os.path.join(OBJ_DIR, f'{name}.json'), encoding='utf-8'))
        alpha = Image.open(os.path.join(OBJ_DIR, f'{name}.png')).convert('RGBA').getchannel('A')
        t = data['tileSize']
        cells = []
        for r, row in enumerate(data['cells']):
            out = []
            for c, ref in enumerate(row):
                hist = alpha.crop((c * t, r * t, c * t + t, r * t + t)).histogram()
                cov = 1 - hist[0] / (t * t)
                out.append((sheet_key(ref[0]), ref[1], ref[2], ref[3], cov) if ref and cov > 0 else None)
            cells.append(out)
        _OBJ_CACHE[name] = cells
    return _OBJ_CACHE[name]


def put_top(m, r, c, cell):
    """Pone la losa en la primera capa libre desde 'Decoración' (crea capas nuevas si hace falta)."""
    for layer in m['layers'][2:]:
        if layer['grid'][r][c] is None:
            layer['grid'][r][c] = cell
            return
    grid = [[None] * m['cols'] for _ in range(m['rows'])]
    grid[r][c] = cell
    m['layers'].append({'id': f'layer_{len(m["layers"])}', 'name': f'Objetos {len(m["layers"]) - 2}',
                        'visible': True, 'grid': grid})


def use_sheet(m, sheet):
    if sheet not in m['tilesets']:
        m['tilesets'][sheet] = {'Outside': 'Outside.png', 'Caves': 'Caves.png', 'charcos': 'charcos.png'}.get(sheet, f'{sheet}.png')
        m['tilesetTileSizes'][sheet] = TS


def place(m, name, x, y, solid='auto', walk=()):
    """Coloca un objeto (esquina superior izquierda en x, y).
    solid: 'auto' (lo que se ve bloquea), 'all' o 'none'. walk: celdas (dx, dy) que se pueden pisar."""
    for dy, row in enumerate(load_object(name)):
        for dx, cell in enumerate(row):
            r, c = y + dy, x + dx
            if not cell or not (0 <= r < m['rows'] and 0 <= c < m['cols']):
                continue
            use_sheet(m, cell[0])
            put_top(m, r, c, [cell[0], cell[1], cell[2], cell[3]])
            if solid == 'all' or (solid == 'auto' and cell[4] > 0.3):
                m['solid'][r][c] = 1
    for dx, dy in walk:
        m['solid'][y + dy][x + dx] = 0


def place_tiles(m, sheet, tiles, x, y, solid=True):
    """Losas sueltas de un tileset: tiles = filas de (fila, columna) del tileset."""
    use_sheet(m, sheet)
    for dy, row in enumerate(tiles):
        for dx, t in enumerate(row):
            put_top(m, y + dy, x + dx, [sheet, t[0], t[1], TS])
            if solid:
                m['solid'][y + dy][x + dx] = 1


# ============================================================
# MAPAS
# ============================================================
RUTA_1 = """
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTTT........................TTTTTT
TTTT........................TTTTTT
TTTT........................TTTTTT
TTTT........................TTTTTT
TTTT........................TTTTTT
TTTT........................TTTTTT
TTTT........==................TTTT
TTTTP.....f.==..f..r...f.r....TTTT
TTTT..r.....==................TTTT
TTTT........================..TTTT
TTTT....f...================..TTTT
TTTT.....r............r.......TTTT
TTTTTTTT.TTTTTTTTTTTTTTTTT...TTTTT
TTTTTTTT.TTTTTTTTTTTTTTTTT...TTTTT
TTTTTTTTbTTTTTTTTTTTTTTTTT...TTTTT
TTTT,,,,......................TTTT
TTTT,,,,..........,,,,,,,,,,,,TTTT
TTTT,,,,.WWWWWWWW.,,,,,,,,,,,,TTTT
TTTT,,,,.WWWWWWWW.,,,,,,,,,,,,TTTT
TTTT.....WWW..WWW.,,,,,,,,,,,,TTTT
TTTT.....WWWWWWWW.,,,,,,,,,,,,TTTT
TTTTf....WWWWWWWW.,,,,,,,,,,,,TTTT
TTTT..............,,,,,,,,,,,,TTTT
TTTTT...TTTTTTTTTTTTTTTTT.TTTTTTTT
TTTTT...TTTTTTTTTTTTTTTTT.TTTTTTTT
TTTTT...TTTTTTTTTTTTTTTTTbTTTTTTTT
TTTTP................P........TTTT
TTTT........................f.TTTT
TTTT..WWWWWWW.,,,,,,,,,,,.....TTTT
TTTT..WWWWWWW.,,,,,,,,,,,.....TTTT
TTTT..WW...WW.,,,,,,,,,,,.,,,,TTTT
TTTT..WW...WW.,,,,,,,,,,,.,,,,TTTT
TTTT..WWWWWWWf,,,,,,,,,,,.,,,,TTTT
TTTT..WWWWWWW.,,,,,,,,,,,.,,,,TTTT
TTTT..........,,,,,,,,,,,.,,,,TTTT
TTTTTTTT.TTTTTTTTTTTTTTTT...TTTTTT
TTTTTTTT.TTTTTTTTTTTTTTTT...TTTTTT
TTTTTTTTbTTTTTTTTTTTTTTTT...TTTTTT
TTTT.......................P..TTTT
TTTT.f....WWWWWWWWWWWf..P.....TTTT
TTTT,,,,,.WWWWWWWWWWW.........TTTT
TTTT,,,,,.WWWW...WWWW.,,,,,,,,TTTT
TTTT,,,,,.WWWW...WWWW.,,,,,,,,TTTT
TTTT,,,,,.WWWWWWWWWWW.,,,,,,,,TTTT
TTTT,,,,,.WWWWWWWWWWW.,,,,,,,,TTTT
TTTT,,,,,.............,,,,,,,,TTTT
TTTTT...TTTTTTTTTTTTTTTT.TTTTTTTTT
TTTTT...TTTTTTTTTTTTTTTT.TTTTTTTTT
TTTTT...TTTTTTTTTTTTTTTTbTTTTTTTTT
TTTT..============..,,,,,,,,,,TTTT
TTTT..============..,,,,,,,,,,TTTT
TTTT,,,,,,,,,..===..,,,,,,,,,,TTTT
TTTT,,,,,,,,,..===..,,,,,,,,,,TTTT
TTTT,,,,,,,,,..===..,,,,,,,,,,TTTT
TTTTTTTTTTTTTTT===TTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTT===TTTTTTTTTTTTTTTT
"""

CUEVA = """
####################################
####################################
####################################
############.............###########
#########..,.............,..########
#######.,,,,,,,.......,,,,,,,.######
######.,,,,,,,,,.....,,,,,,,,,.#####
#######.,,,,,,,.......,,,,,,,.######
######.....,.............,.....#####
######...###.............###...#####
######...#######....########...#####
######...#######....########...#####
######...#######....########...#####
######.....#####....######.....#####
####.........###....####..,,,,,..###
####.........###....####.,,,,,,,.###
###...,,,,,...##....###..,,,,,,,..##
###..,,,,,,,..##.....##..,,,,,,,..##
###..,,,,,,,..............,,,,,...##
####.,,,,,,,.....................###
####..,,,,,..#.........#.........###
######.....###.........###.....#####
###############.......##############
################.....###############
#################..#################
#################LL#################
####################################
"""

TORNEO = """
TTTTTTTTTT................TTTTTTTTTT
TTTTTTTTTT................TTTTTTTTTT
TTTTTTTTTT................TTTTTTTTTT
TTTTTTTTTT................TTTTTTTTTT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT................................TT
TT.ff..........................ff.TT
TT.ff..........SSSSSS..........ff.TT
TT.......SSSSSSSSSSSSSSSSSS.......TT
TT.......SAAAAAAAAAAAAAAAAS.......TT
TT.......SAAAAAAAAAAAAAAAAS.......TT
TT.......SAAAAAAAAAAAAAAAAS.......TT
TT.......SAAAAAAAAAAAAAAAAS.......TT
TT.......SAAAAAAAAAAAAAAAAS.......TT
TT.ff....SAAAAAAAAAAAAAAAAS....ff.TT
TT.ff....SAAAAAAAAAAAAAAAAS....ff.TT
TT.......SSSSSSSSSSSSSSSSSS.......TT
TT..P............SS..........P....TT
TT...............SS...............TT
TT...............SS...............TT
TT...............SS...............TT
TT...............SS...............TT
TTTTTTTTTTTTTTTTTSSTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTSSTTTTTTTTTTTTTTTTT
"""


def build_all():
    maps = []
    # ---------------- Cueva Meteoro ----------------
    cueva, cgrid = build_cave('cueva_meteoro', 'Cueva Meteoro', CUEVA, seed=7)
    ch = len(cgrid)
    lx = cgrid[ch - 2].index('L')
    cueva_spawn = (lx, ch - 3)
    # Decoración: fósil de amonite, cristales del meteorito, rocas grandes y estalagmitas
    place_tiles(cueva, 'Caves', [[(19, 6), (19, 7)], [(20, 6), (20, 7)]], 21, 4)
    place_tiles(cueva, 'Caves', [[(19, 6), (19, 7)], [(20, 6), (20, 7)]], 5, 20)
    place_tiles(cueva, 'Caves', [[(15, 0), (15, 1), (15, 2)], [(16, 0), (16, 1), (16, 2)], [(17, 0), (17, 1), (17, 2)]], 9, 4)
    place_tiles(cueva, 'Caves', [[(15, 0), (15, 1), (15, 2)], [(16, 0), (16, 1), (16, 2)], [(17, 0), (17, 1), (17, 2)]], 25, 4)
    for x, y in [(7, 14), (29, 14), (14, 20), (22, 20), (19, 11), (6, 6), (30, 6), (23, 13)]:
        place_tiles(cueva, 'Caves', [[(21, 7)], [(22, 7)]], x, y - 1)
    for x, y in [(11, 18), (25, 16), (16, 21), (20, 22), (4, 15), (32, 19)]:
        place_tiles(cueva, 'Caves', [[(22, 5 + (x + y) % 2)]], x, y)
    cueva['spawn'] = {'x': cueva_spawn[0], 'y': cueva_spawn[1]}
    # Exploración (js/mine.js): rocas que se rompen con el pico, escalera escondida y gemas ocultas
    cueva['mine'] = {'floor': 1, 'theme': 'brown', 'darkness': 0, 'rocks': 16, 'hard': 0,
                     'hiddenGems': [{'id': 'cueva_meteoro_g1', 'x': 4, 'y': 15, 'item': 'rubi'},
                                    {'id': 'cueva_meteoro_g2', 'x': 30, 'y': 9, 'item': 'topacio'}]}
    cueva['npcs'] = [
        trainer('cueva_ritza', 31, 17, 'Ritza', 'Ritza.png', 'left',
                [('pachycephalosaurus', 14), ('lexovisaurus', 14), ('suchomimus', 15)],
                'shockwave',
                'Exploro esta cueva buscando fragmentos del meteorito.\n¡No me distraigas... o combate!',
                'Tus dinos brillan más que el meteorito.', sight=5, ai='experto', exp=150),
        trainer('cueva_vivian', 12, 15, 'Vivian', 'Vivian.png', 'down',
                [('carcharodontosaurus', 15), ('utahraptor', 15), ('iguanodon', 15)],
                'super_impact',
                'La Banda Meteoro llegó antes que tú.\nYo los vi pasar... ¡pero primero, un combate!',
                'El comandante Helmep está al fondo de la cueva, al norte.', sight=6, ai='experto', exp=160),
        dict(person('cueva_rose', 20, 23, 'Rose', 'Rose.png', 'left',
                    'Soy Rose, exploradora de cuevas.\nEn la tierra oscura de la cueva aparecen dinos salvajes, igual que en la hierba alta.'),
             mineGuide=True),
    ]
    maps.append((cueva, cgrid, 'cave'))

    # ---------------- Pisos profundos de la Cueva Meteoro ----------------
    # (piso, nombre, tema, ancho, alto, semilla, oscuridad, rocas, % rocas duras, gemas ocultas)
    FLOORS = [
        (2, 'Galerías', 'brown', 46, 36, 21, 0.35, 24, 0.0, ['esmeralda', 'rubi', 'ambar']),
        (3, 'Profundidades', 'brown', 50, 40, 33, 0.7, 28, 0.15, ['topacio', 'esmeralda', 'ambar']),
        (4, 'Gruta Nevada', 'snow', 50, 40, 47, 0.6, 30, 0.3, ['aguamarina', 'opalo', 'topacio']),
        (5, 'Gruta de Hielo', 'ice', 54, 40, 58, 0.85, 32, 0.45, ['aguamarina', 'amatista', 'opalo', 'amatista']),
        (6, 'Corazón del Meteorito', 'ice', 42, 32, 64, 0.9, 24, 0.5, ['nucleo', 'amatista', 'aguamarina']),
    ]
    floor_maps = [cueva]
    for n, title, theme, w, h, seed, darkness, rocks, hard, gems in FLOORS:
        layout, ends = cave_floor_layout(w, h, seed, rooms=3 + n // 2)
        fm, fgrid = build_cave(f'cueva_meteoro_{n}', f'Cueva Meteoro · Piso {n} · {title}', layout, seed=seed, theme=theme)
        fh = len(fgrid)
        lx2 = fgrid[fh - 2].index('L')
        fm['spawn'] = {'x': lx2, 'y': fh - 3}
        fm['warps'].append({'x': lx2, 'y': fh - 2, 'targetMap': 'cueva_meteoro', 'targetX': cueva_spawn[0],
                            'targetY': cueva_spawn[1], 'desc': 'Entrada de la Cueva Meteoro'})
        # Estalagmitas y rocas grandes sólo en el centro de las cámaras (nunca tapan un túnel)
        trnd = random.Random(seed + 1)
        open_cells = [(x, y) for y in range(2, fh - 3) for x in range(2, w - 2)
                      if all(fgrid[y + dy][x + dx] in '.,' for dy in (-1, 0, 1) for dx in (-1, 0, 1))]
        for x, y in trnd.sample(open_cells, min(len(open_cells), 6 + n)):
            if all(not fm['solid'][y + dy][x + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)):
                deco = CAVE_THEMES[theme]['deco']
                place_tiles(fm, 'Caves', deco, x, y - len(deco) + 1)
        # Gemas ocultas en los callejones más lejanos (difíciles de encontrar)
        fm['mine'] = {'floor': n, 'theme': theme, 'darkness': darkness, 'rocks': rocks, 'hard': hard,
                      'hiddenGems': [{'id': f'cueva_meteoro_{n}_g{i + 1}', 'x': ex + (i % 2), 'y': ey + (i // 2) % 2,
                                      'item': item} for i, (item, (ex, ey)) in enumerate(zip(gems, ends))]}
        floor_maps.append(fm)
        maps.append((fm, fgrid, 'cave'))
    # Cada piso sabe a dónde lleva su escalera escondida
    for upper, lower in zip(floor_maps, floor_maps[1:]):
        upper['mine']['next'] = lower['_id']
        upper['mine']['nextArrival'] = [lower['spawn']['x'], lower['spawn']['y']]

    # ---------------- Ruta 1 ----------------
    ruta, grid = build_outside('ruta_1', 'Ruta 1', RUTA_1, seed=11)
    H = len(grid)
    # Cordillera al norte con la entrada a la Cueva Meteoro (la boca está en las columnas 2-3 de la montaña)
    place(ruta, 'tierra_sobre_monta_a_co_fondo', 4, 2, solid='all')
    place(ruta, 'tierra_monta_a__sobre_monta_a_con_entrada_1', 10, 2, solid='all', walk=[(2, 5), (3, 5)])
    place(ruta, 'tierra_sobre_monta_a_co_fondo', 16, 2, solid='all')
    place(ruta, 'tierra_sobre_monta_a_co_fondo', 22, 2, solid='all')
    door = (12, 7)
    # Atajos tapados por arbustos (se cortan con un dino de Planta) y tesoros en las islas (se llega nadando)
    ruta['fieldObjects'] = [{'kind': 'bush', 'x': x, 'y': y} for y, row in enumerate(grid) for x, ch in enumerate(row) if ch == 'b']
    ruta['treasures'] = [
        {'id': 'ruta1_isla_1', 'x': 15, 'y': 43, 'item': 'tonico_jurasico', 'n': 1},
        {'id': 'ruta1_isla_2', 'x': 9, 'y': 32, 'item': 'baya_vigor', 'n': 3},
        {'id': 'ruta1_isla_3', 'x': 12, 'y': 21, 'item': 'elixir_meteoro', 'n': 1},
    ]
    # Ruta en zigzag: muros de bosque con aberturas alternadas, estanques y hierba alta
    place(ruta, 'maceta_1', 14, 55)                      # letrero "Ruta 1"
    for x in (12, 13):
        ruta['warps'].append({'x': x, 'y': door[1], 'targetMap': 'cueva_meteoro',
                              'targetX': cueva_spawn[0], 'targetY': cueva_spawn[1], 'desc': 'Cueva Meteoro'})
    for x in (15, 16, 17):
        ruta['warps'].append({'x': x, 'y': H - 1, 'targetMap': 'world_map', 'targetX': 65, 'targetY': 2,
                              'desc': 'Pueblo Meteoro'})
    ruta['spawn'] = {'x': 16, 'y': H - 3}
    ruta['npcs'] = [
        person('ruta1_ruth', 19, H - 4, 'Ruth', 'Ruth.png', 'left',
               '¡Bienvenido a la Ruta 1!\nEn la hierba alta aparecen dinos salvajes. Si los derrotas, ¡los capturas!\nAl final del camino está la Cueva Meteoro... dicen que allí cayó el meteorito.'),
        trainer('ruta1_alvin', 11, 47, 'Alvin', 'Alvin.png', 'left',
                [('velociraptor', 10), ('saurolophus_verde', 10), ('baryonyx', 11)],
                'tag_team',
                '¡Eh! Acabo de empezar mi colección de cartas.\n¡Seguro que te gano!',
                '¡Vaya! Tengo que entrenar más en la hierba alta.', sight=5),
        trainer('ruta1_amelia', 23, 40, 'Amelia', 'Amelia.png', 'right',
                [('achelousaurus', 11), ('edmontonia', 11), ('ceratosaurus', 12)],
                'anhanguera_dive',
                '¡Mis dinos rayo y tierra son un equipo perfecto!\n¿Te atreves?',
                'Combinar elementos no bastó... ¡Bien jugado!', sight=4),
        trainer('ruta1_luter', 14, 28, 'Luter', 'Luter.png', 'left',
                [('torvosaurus', 12), ('shunosaurus', 11), ('fukuisaurus', 12)],
                'big_foot_assault',
                'Fuego, agua y planta: ¡tengo respuesta para todo!',
                '¡Me encontraste el punto débil!', sight=6),
        trainer('ruta1_blanche', 24, 17, 'Blanche', 'Blanche.png', 'left',
                [('saltasaurus', 12), ('mapusaurus', 13), ('pentaceratops', 13)],
                'ocean_panic',
                'Este bosque es un laberinto... ¡y yo soy su guardiana!\nSi quieres llegar a la cueva, tendrás que vencerme.',
                'Bien jugado. La cueva está al norte, cruzando el último claro.', sight=6, exp=130),
        trainer('ruta1_maxwell', 17, 10, 'Maxwell', 'Maxwell.png', 'left',
                [('megaraptor', 13), ('pachyrhinosaurus', 13), ('stegosaurus', 13)],
                'metal_wing',
                'Nadie entra a la Cueva Meteoro sin pasar por mí.\n¡Demuéstrame que eres fuerte!',
                'Está bien, puedes pasar. Ten cuidado ahí dentro...', sight=5, exp=140),
    ]
    maps.append((ruta, grid, 'outside'))

    # Cuerda de Escape: lleva a la boca de la cueva en la Ruta 1; Rose ofrece atajos a los pisos 3 y 5
    for fm in floor_maps:
        fm['mine']['exit'] = {'map': 'ruta_1', 'x': door[0], 'y': door[1] + 1}
    cueva['mine']['shortcuts'] = {str(fm['mine']['floor']): [fm['spawn']['x'], fm['spawn']['y']]
                                  for fm in floor_maps if fm['mine']['floor'] in (3, 5)}

    # Salida de la cueva: justo frente a la boca de la montaña
    for x in (lx, lx + 1):
        if cgrid[ch - 2][x] == 'L':
            cueva['warps'].append({'x': x, 'y': ch - 2, 'targetMap': 'ruta_1', 'targetX': door[0], 'targetY': door[1] + 1,
                                   'desc': 'Salida a la Ruta 1'})

    # ---------------- Estadio del Gran Torneo Mesozoico ----------------
    torneo, tgrid = build_outside('torneo', 'Estadio del Gran Torneo Mesozoico', TORNEO, seed=5)
    th = len(tgrid)
    place(torneo, 'museo_plateada_1', 10, 0, walk=[(x, y) for x in range(16) for y in (13, 14)])  # estadio
    place(torneo, 'tienda_pokemon_techo_amarillo_1', 2, 4)
    place(torneo, 'tienda_pokemon_techo_verde_2', 26, 4)
    place(torneo, 'estatua_1', 14, 25)
    place(torneo, 'estatua_1', 20, 25)
    place(torneo, 'jardinera_flores_1', 10, 26)
    place(torneo, 'jardinera_flores_1', 23, 26)
    place(torneo, 'estatua_peque_a_1', 9, 14)
    place(torneo, 'estatua_peque_a_1', 26, 14)
    place(torneo, 'bicileta_1', 28, 20)
    place(torneo, 'bicileta_2', 4, 18)
    place(torneo, 'maceta_1', 16, 29)
    for x in (17, 18):
        torneo['warps'].append({'x': x, 'y': th - 1, 'targetMap': 'world_map', 'targetX': 65, 'targetY': 106,
                                'desc': 'Pueblo Meteoro'})
    torneo['spawn'] = {'x': 17, 'y': th - 3}
    referee = person('torneo_arbitro', 18, 15, 'Árbitro del Torneo', 'Roderick.png', 'down',
                     '¡Bienvenidos al Gran Torneo Mesozoico!')
    referee['tournament'] = True
    torneo['npcs'] = [
        referee,
        person('torneo_fan', 6, 20, 'Fan del torneo', 'Luter.png', 'right',
               '¡Dicen que en la Gran Final a veces aparece un Dinosaurio Alfa!\nAquí todos los dinos combaten a nivel 50: gana quien tenga mejor estrategia.'),
    ]
    maps.append((torneo, tgrid, 'outside'))
    return maps


def connect_world_map(ruta_entry, torneo_entry):
    """Entrada a la Ruta 1 por el borde norte del Pueblo Meteoro (world_map y proyecto_actual)."""
    for name in ('world_map.json', 'proyecto_actual.json'):
        path = os.path.join(MAPS_DIR, name)
        if not os.path.exists(path):
            continue
        data = json.load(open(path, encoding='utf-8'))
        warps = [w for w in data.get('warps', []) if w.get('targetMap') != 'ruta_1']
        for x in (64, 65, 66):
            warps.append({'x': x, 'y': 1, 'targetMap': 'ruta_1', 'targetX': ruta_entry[0], 'targetY': ruta_entry[1], 'desc': 'Ruta 1'})
        warps = [w for w in warps if w.get('targetMap') != 'torneo']
        for x in (64, 65, 66):
            warps.append({'x': x, 'y': data['rows'] - 2, 'targetMap': 'torneo', 'targetX': torneo_entry[0], 'targetY': torneo_entry[1], 'desc': 'Estadio del Gran Torneo'})
        data['warps'] = warps
        # Tesoros en el agua: sólo se alcanzan nadando con un dino de Agua
        data['treasures'] = [
            {'id': 'pueblo_lago_cristal', 'x': 120, 'y': 46, 'item': 'elixir_meteoro', 'n': 1},
            {'id': 'pueblo_estanque_bosque', 'x': 11, 'y': 35, 'item': 'tonico_jurasico', 'n': 1},
        ]
        json.dump(data, open(path, 'w', encoding='utf-8'))


def preview(m, out_path):
    from PIL import Image
    sheets = {}
    W, H = m['cols'], m['rows']
    img = Image.new('RGBA', (W * TS, H * TS), (0, 0, 0, 255))
    for layer in m['layers']:
        for r in range(H):
            for c in range(W):
                cell = layer['grid'][r][c]
                if not cell:
                    continue
                key = cell[0]
                if key not in sheets:
                    sheets[key] = Image.open(os.path.join(MAPS_DIR, m['tilesets'][key])).convert('RGBA')
                tile = sheets[key].crop((cell[2] * TS, cell[1] * TS, cell[2] * TS + TS, cell[1] * TS + TS))
                img.paste(tile, (c * TS, r * TS), tile)
    for n in m['npcs']:
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        x, y = n['x'] * TS, n['y'] * TS
        d.rectangle((x + 6, y + 6, x + 26, y + 26), outline=(255, 0, 0) if n['type'] == 'trainer' else (0, 120, 255), width=3)
    for w in m['warps']:
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        x, y = w['x'] * TS, w['y'] * TS
        d.rectangle((x + 2, y + 2, x + 30, y + 30), outline=(255, 255, 0), width=2)
    img.save(out_path)


if __name__ == '__main__':
    os.chdir(ROOT)
    ruta_entry, torneo_entry = (16, 55), (17, 29)
    for m, grid, kind in build_all():
        if m['_id'] == 'ruta_1':
            ruta_entry = (m['spawn']['x'], m['spawn']['y'])
        if m['_id'] == 'torneo':
            torneo_entry = (m['spawn']['x'], m['spawn']['y'])
        map_id = m.pop('_id')
        for n in m['npcs']:  # nadie se para sobre hierba alta (ahí también aparecen objetos)
            m['tallGrass'][n['y']][n['x']] = 0
        path = os.path.join(MAPS_DIR, f'{map_id}.json')
        json.dump(m, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'🗺️  {path} ({m["cols"]}x{m["rows"]}, {len(m["npcs"])} personajes)')
        if '--preview' in sys.argv:
            out_dir = os.path.join(ROOT, 'tools', 'vistas')
            os.makedirs(out_dir, exist_ok=True)
            preview(m, os.path.join(out_dir, f'{map_id}.png'))
    connect_world_map(ruta_entry, torneo_entry)
    print('🚪 Entradas: Ruta 1 al norte del Pueblo Meteoro (x 64-66, y 1) y Estadio al sur (x 64-66, y 108).')
