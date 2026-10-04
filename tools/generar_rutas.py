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
    P  pino suelto (ocupa 2x3, se marca en la esquina superior izquierda)
    r  roca             M  pared de roca / acantilado               D  entrada de cueva
    S  suelo de piedra   A  cancha de combate                       B  edificio del estadio (8x12, esquina sup. izq.)
Leyenda cueva (Caves.png):
    .  suelo            ,  suelo con dinos salvajes   #  pared de roca
    o  roca suelta      L  escalera de salida
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
    """3 ataques válidos para el nivel: los mejores de su elemento y uno normal (variados por posición)."""
    el = DINO_BY_ID[species]['element']
    learn = [a for a in DINOS['attacks'] if not a.get('moveCard') and a.get('level', 1) <= level and a['power'] > 0]
    own = [a['id'] for a in sorted([a for a in learn if a['element'] == el], key=lambda a: -a['power'])]
    nor = [a['id'] for a in sorted([a for a in learn if a['element'] == 'normal'], key=lambda a: -a['power'])]
    pick = [own[0], own[min(1 + i % 2, len(own) - 1)], nor[min(i % 2, len(nor) - 1)]] if own else nor[:3]
    out = []
    for a in pick + own + nor:
        if a not in out:
            out.append(a)
    if i == 1 and level >= 8 and 'grito_salvaje' not in out:
        out[2] = 'grito_salvaje'  # el segundo dino intimida
    return out[:3]


def trainer(npc_id, x, y, name, sprite, direction, team, move_card, dialog, defeat, sight=4, exp=80, ai='dificil'):
    """Entrenador con equipo de 3 dinos [(especie, nivel[, ataques])] y carta de movimiento."""
    full = []
    for i, entry in enumerate(team):
        species, level = entry[0], entry[1]
        attacks = entry[2] if len(entry) > 2 else auto_attacks(species, level, i)
        d = DINO_BY_ID[species]
        full.append({'species': species, 'name': d['name'], 'element': d['element'],
                     'image': d['image'], 'card': d['card'], 'level': level, 'attacks': attacks})
    return {'id': npc_id, 'x': x, 'y': y, 'name': name, 'sprite': sprite, 'direction': direction,
            'type': 'trainer', 'sightRange': sight, 'dialog': dialog, 'defeatDialog': defeat,
            'team': full, 'moveCard': move_card, 'rewardExp': exp, 'ai': ai}


def person(npc_id, x, y, name, sprite, direction, dialog):
    return {'id': npc_id, 'x': x, 'y': y, 'name': name, 'sprite': sprite, 'direction': direction,
            'type': 'npc', 'sightRange': 0, 'dialog': dialog, 'defeatDialog': '', 'team': [],
            'moveCard': None, 'rewardExp': 0}


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


def build_cave(map_id, name, layout, seed=2):
    rnd = random.Random(seed)
    grid = parse(layout)
    H, W = len(grid), len(grid[0])
    m = new_map(map_id, name, grid, {'Caves': 'Caves.png'})
    base, terrain, decor = (L['grid'] for L in m['layers'])
    put = lambda layer, r, c, t: layer[r].__setitem__(c, ['Caves', t[0], t[1], TS])
    floor = lambda rr, cc: 0 <= rr < H and 0 <= cc < W and grid[rr][cc] != '#'

    for r in range(H):
        for c in range(W):
            ch = grid[r][c]
            if ch == '#':
                row = 24 if floor(r + 1, c) else (21 if floor(r - 1, c) else 22)
                col = 0 if floor(r, c - 1) else (2 if floor(r, c + 1) else 1)
                put(base, r, c, (row, col))
                m['solid'][r][c] = 1
                continue
            put(base, r, c, rnd.choice(CAVE_DARK if ch == ',' else CAVE_FLOOR))
            if ch == ',':
                m['tallGrass'][r][c] = 1
            elif ch == 'o':
                put(decor, r, c, rnd.choice(CAVE_ROCKS))
                m['solid'][r][c] = 1
            elif ch == 'L':
                put(decor, r, c, CAVE_LADDER)
    return m, grid


# ============================================================
# MAPAS
# ============================================================
RUTA_1 = """
TTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTTTTTTTTTTTTTTTTTTTTTTT
TTTTMMMMMMMMMMMMMMMMMMTTTT
TTTTMMMMMMMMMMMMMMMMMMTTTT
TTTTMMMMMMMMMDMMMMMMMMTTTT
TTTT.......f===f......TTTT
TTTT,,,,......=......,TTTT
TTTT,,,,,.....=....,,,TTTT
TTTT,,,,,.....=....,,,TTTT
TTTT,,,,......=.....,,TTTT
TTTT........====......TTTT
TTTT..P.....=.....r...TTTT
TTTT........=.........TTTT
TTTT........=..WWWWW..TTTT
TTTT,,,.....=..WWWWW..TTTT
TTTT,,,,....=..WWWWW..TTTT
TTTT,,,,....=..WWWWW..TTTT
TTTT,,,.....=.........TTTT
TTTT........=......f..TTTT
TTTTTTTT....=....TTTTTTTTT
TTTTTTTT....=....TTTTTTTTT
TTTTTTTT....=....TTTTTTTTT
TTTT........=.........TTTT
TTTT..,,,,,,=,,,,,,...TTTT
TTTT..,,,,,,=,,,,,,...TTTT
TTTT..,,,,,,=,,,,,,...TTTT
TTTT..,,,,,,=,,,,,,...TTTT
TTTT........=.........TTTT
TTTT.f......=......P..TTTT
TTTT........========..TTTT
TTTT...............=..TTTT
TTTT..r............=..TTTT
TTTT,,,,,,.........=..TTTT
TTTT,,,,,,.........=..TTTT
TTTT,,,,,,.....=====..TTTT
TTTT,,,,,,.....=......TTTT
TTTT...........=......TTTT
TTTTTTTTTT.....=..TTTTTTTT
TTTTTTTTTT.....=..TTTTTTTT
TTTT...........=......TTTT
TTTT..f........=....f.TTTT
TTTT...........=......TTTT
TTTTTTTTTTTT===TTTTTTTTTTT
TTTTTTTTTTTT===TTTTTTTTTTT
"""

CUEVA = """
##############################
##############################
###....,,,,,,.....,,,,,,....##
###...,,,,,,,......,,,,,,...##
###...,,o,,,,..o...,,,,,,...##
###.......................o.##
#######....######....########
#######....######....########
###....,,,,......,,,,,,.....##
###...,,,,,,....,,,,,,,,....##
###o..,,,,,,....,,,o,,,,....##
###.........................##
#########....########....#####
#########....########....#####
###.....,,,,,,.....,,,,,,...##
###....,,,,,,,,....,,,,,,,..##
###....,,,,o,,,....,,,,,,,..##
###.........................##
#############.L.##############
##############################
"""


TORNEO = """
TTTTTTTTB.......TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTTTTTTT........TTTTTTTT
TTff..SSSSSSSSSSSSSS..ffTT
TT....SAAAAAAAAAAAAS....TT
TT....SAAAAAAAAAAAAS....TT
TT....SAAAAAAAAAAAAS....TT
TT....SAAAAAAAAAAAAS....TT
TT....SAAAAAAAAAAAAS....TT
TT....SAAAAAAAAAAAAS....TT
TT....SSSSSSSSSSSSSS....TT
TTf.........SS.........fTT
TT..P.......SS......P...TT
TT..........SS..........TT
TT..........SS..........TT
TTTTTTTTTTT.SS.TTTTTTTTTTT
TTTTTTTTTTT.SS.TTTTTTTTTTT
"""


def build_all():
    maps = []

    # ---------------- Ruta 1 ----------------
    ruta, grid = build_outside('ruta_1', 'Ruta 1', RUTA_1, seed=11)
    H = len(grid)
    door_x = grid[4].index('D')
    for x in (12, 13, 14):
        ruta['warps'].append({'x': x, 'y': H - 1, 'targetMap': 'world_map', 'targetX': 60, 'targetY': 2,
                              'desc': 'Pueblo Meteoro'})
    ruta['warps'].append({'x': door_x, 'y': 4, 'targetMap': 'cueva_meteoro', 'targetX': 14, 'targetY': 17,
                          'desc': 'Cueva Meteoro'})
    ruta['spawn'] = {'x': 13, 'y': H - 3}
    ruta['npcs'] = [
        person('ruta1_ruth', 16, H - 4, 'Ruth', 'Ruth.png', 'left',
               '¡Bienvenido a la Ruta 1!\nEn la hierba alta aparecen dinos salvajes. Si los derrotas, ¡los capturas!\nAl final del camino está la Cueva Meteoro... dicen que allí cayó el meteorito.'),
        trainer('ruta1_alvin', 7, 36, 'Alvin', 'Alvin.png', 'right',
                [('velociraptor', 10), ('saurolophus_verde', 10), ('baryonyx', 11)],
                'tag_team',
                '¡Eh! Acabo de empezar mi colección de cartas.\n¡Seguro que te gano!',
                '¡Vaya! Tengo que entrenar más en la hierba alta.', sight=5),
        trainer('ruta1_amelia', 21, 31, 'Amelia', 'Amelia.png', 'left',
                [('achelousaurus', 11), ('edmontonia', 11), ('ceratosaurus', 12)],
                'anhanguera_dive',
                '¡Mis dinos rayo y tierra son un equipo perfecto!\n¿Te atreves?',
                'Combinar elementos no bastó... ¡Bien jugado!', sight=4),
        trainer('ruta1_luter', 5, 18, 'Luter', 'Luter.png', 'right',
                [('torvosaurus', 12), ('shunosaurus', 11), ('fukuisaurus', 12)],
                'big_foot_assault',
                'Fuego, agua y planta: ¡tengo respuesta para todo!',
                '¡Me encontraste el punto débil!', sight=6),
        trainer('ruta1_maxwell', 17, 8, 'Maxwell', 'Maxwell.png', 'left',
                [('megaraptor', 13), ('pachyrhinosaurus', 13), ('stegosaurus', 13)],
                'metal_wing',
                'Nadie entra a la Cueva Meteoro sin pasar por mí.\n¡Demuéstrame que eres fuerte!',
                'Está bien, puedes pasar. Ten cuidado ahí dentro...', sight=5, exp=140),
    ]
    maps.append((ruta, grid, 'outside'))

    # ---------------- Cueva Meteoro ----------------
    cueva, cgrid = build_cave('cueva_meteoro', 'Cueva Meteoro', CUEVA, seed=7)
    ch = len(cgrid)
    lx = cgrid[18].index('L')
    cueva['warps'].append({'x': lx, 'y': 18, 'targetMap': 'ruta_1', 'targetX': door_x, 'targetY': 5,
                           'desc': 'Salida a la Ruta 1'})
    cueva['spawn'] = {'x': lx, 'y': 17}
    cueva['npcs'] = [
        trainer('cueva_ritza', 22, 15, 'Ritza', 'Ritza.png', 'left',
                [('pachycephalosaurus', 14), ('lexovisaurus', 14), ('suchomimus', 15)],
                'shockwave',
                'Exploro esta cueva buscando fragmentos del meteorito.\n¡No me distraigas... o combate!',
                'Tus dinos brillan más que el meteorito.', sight=5, ai='experto', exp=150),
        trainer('cueva_vivian', 6, 9, 'Vivian', 'Vivian.png', 'right',
                [('carcharodontosaurus', 15), ('utahraptor', 15), ('iguanodon', 15)],
                'super_impact',
                'La Banda Meteoro llegó antes que tú.\nYo los vi pasar... ¡pero primero, un combate!',
                'El comandante Helmep está al fondo de la cueva, al norte.', sight=6, ai='experto', exp=160),
        person('cueva_rose', 25, 3, 'Rose', 'Rose.png', 'left',
               'Me perdí buscando dinos raros...\nEn la tierra oscura de la cueva aparecen dinos salvajes, igual que en la hierba alta.'),
    ]
    maps.append((cueva, cgrid, 'cave'))

    # ---------------- Estadio del Gran Torneo Mesozoico ----------------
    torneo, tgrid = build_outside('torneo', 'Estadio del Gran Torneo Mesozoico', TORNEO, seed=5)
    th = len(tgrid)
    for x in (12, 13):
        torneo['warps'].append({'x': x, 'y': th - 1, 'targetMap': 'world_map', 'targetX': 60, 'targetY': 86,
                                'desc': 'Pueblo Meteoro'})
    torneo['spawn'] = {'x': 12, 'y': th - 4}
    referee = person('torneo_arbitro', 12, 12, 'Árbitro del Torneo', 'Roderick.png', 'down',
                     '¡Bienvenidos al Gran Torneo Mesozoico!')
    referee['tournament'] = True
    torneo['npcs'] = [
        referee,
        person('torneo_fan', 4, 15, 'Fan del torneo', 'Luter.png', 'right',
               '¡Dicen que en la Gran Final a veces aparece un Dinosaurio Alfa!\nAquí todos los dinos combaten a nivel 50: gana quien tenga mejor estrategia.'),
    ]
    maps.append((torneo, tgrid, 'outside'))
    return maps


def connect_world_map(ruta_entry):
    """Entrada a la Ruta 1 por el borde norte del Pueblo Meteoro (world_map y proyecto_actual)."""
    for name in ('world_map.json', 'proyecto_actual.json'):
        path = os.path.join(MAPS_DIR, name)
        if not os.path.exists(path):
            continue
        data = json.load(open(path, encoding='utf-8'))
        warps = [w for w in data.get('warps', []) if w.get('targetMap') != 'ruta_1']
        for x in (59, 60, 61):
            warps.append({'x': x, 'y': 1, 'targetMap': 'ruta_1', 'targetX': ruta_entry[0], 'targetY': ruta_entry[1], 'desc': 'Ruta 1'})
        warps = [w for w in warps if w.get('targetMap') != 'torneo']
        for x in (59, 60, 61):
            warps.append({'x': x, 'y': 88, 'targetMap': 'torneo', 'targetX': 12, 'targetY': 22, 'desc': 'Estadio del Gran Torneo'})
        data['warps'] = warps
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
    ruta_entry = (13, 0)
    for m, grid, kind in build_all():
        if m['_id'] == 'ruta_1':
            ruta_entry = (m['spawn']['x'], m['spawn']['y'])
        map_id = m.pop('_id')
        path = os.path.join(MAPS_DIR, f'{map_id}.json')
        json.dump(m, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'🗺️  {path} ({m["cols"]}x{m["rows"]}, {len(m["npcs"])} personajes)')
        if '--preview' in sys.argv:
            out_dir = os.path.join(ROOT, 'tools', 'vistas')
            os.makedirs(out_dir, exist_ok=True)
            preview(m, os.path.join(out_dir, f'{map_id}.png'))
    connect_world_map(ruta_entry)
    print('🚪 Entradas: Ruta 1 al norte del Pueblo Meteoro (x 59-61, y 1) y Estadio al sur (x 59-61, y 88).')
