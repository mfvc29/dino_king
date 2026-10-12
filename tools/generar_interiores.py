#!/usr/bin/env python3
"""
Interiores de las casas y edificios del Pueblo Meteoro, amueblados con los objetos del
Constructor de Objetos (assets/maps/objetos/, tilesets objetos_para_casa*.png).

Cada interior es una habitación: paredes arriba (2 filas + zócalo), suelo, y la puerta abajo.
El script también conecta cada puerta del pueblo (world_map y proyecto_actual) con su interior.

Uso:
    python3 tools/generar_interiores.py            # genera los interiores y conecta las puertas
    python3 tools/generar_interiores.py --preview  # además guarda vistas previas en tools/vistas/
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generar_rutas import MAPS_DIR, ROOT, TS, load_object, person, place, preview, trainer  # noqa: E402


def blank(map_id, name, w, h):
    return {
        'version': 2, 'name': name, 'cols': w, 'rows': h, 'tileSize': TS, 'sourceTileSize': TS,
        'tilesets': {}, 'tilesetTileSizes': {},
        'layers': [{'id': f'layer_{i}', 'name': n, 'visible': True, 'grid': [[None] * w for _ in range(h)]}
                   for i, n in enumerate(['Suelo', 'Paredes', 'Muebles'])],
        'warps': [], 'npcs': [],
        'solid': [[0] * w for _ in range(h)],
        'tallGrass': [[0] * w for _ in range(h)],
    }


def fill(m, layer, name, x0, y0, x1, y1, solid=False):
    """Repite un objeto (de 1x1 o 1x2) sobre un rectángulo, en una capa fija."""
    cells = load_object(name)
    oh, ow = len(cells), len(cells[0])
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            cell = cells[(y - y0) % oh][(x - x0) % ow]
            if not cell:
                continue
            sheet = cell[0]
            m['tilesets'].setdefault(sheet, f'{sheet}.png' if sheet not in ('Outside', 'Caves', 'charcos') else
                                     {'Outside': 'Outside.png', 'Caves': 'Caves.png', 'charcos': 'charcos.png'}[sheet])
            m['tilesetTileSizes'].setdefault(sheet, TS)
            m['layers'][layer]['grid'][y][x] = [sheet, cell[1], cell[2], cell[3]]
            if solid:
                m['solid'][y][x] = 1


def room(map_id, name, w, h, floor, wall, base, door_x, side_wall=None):
    """Habitación de w x h: filas 0-1 pared, fila 2 zócalo, suelo, y la puerta (2 losas) en la fila de abajo."""
    m = blank(map_id, name, w, h)
    fill(m, 0, floor, 0, 0, w - 1, h - 1)
    fill(m, 1, wall, 0, 0, w - 1, 1, solid=True)
    fill(m, 1, base, 0, 2, w - 1, 2, solid=True)
    side = side_wall or wall
    fill(m, 1, side, 0, 3, 0, h - 1, solid=True)              # paredes laterales
    fill(m, 1, side, w - 1, 3, w - 1, h - 1, solid=True)
    for x in range(1, w - 1):                                    # pared de abajo (salvo la puerta)
        if x not in (door_x, door_x + 1):
            fill(m, 1, base, x, h - 1, x, h - 1, solid=True)
    m['spawn'] = {'x': door_x, 'y': h - 2}
    m['_id'], m['_door'] = map_id, door_x
    return m


def resident(m, npc_id, name, sprite, tint, x, y, direction, dialog):
    """Vecino que vive en la casa (sólo habla). tint = giro de color de la ropa para reutilizar sprites."""
    n = person(npc_id, x, y, name, sprite, direction, dialog)
    if tint:
        n['tint'] = tint
    m['npcs'].append(n)


def furnish(m, items):
    """items: (objeto, x, y[, 'none' para que se pueda pisar]). Lo que va en la pared no cambia colisiones."""
    for it in items:
        name, x, y = it[:3]
        place(m, name, x, y, solid=it[3] if len(it) > 3 else 'auto')


# ============================================================
# Interiores: (id, nombre, edificio del pueblo, puerta en el pueblo (x, y), ancho, alto, estilo, muebles)
# La puerta del pueblo son 2 losas: (x, y) y (x + 1, y). Al salir apareces una losa más abajo.
# ============================================================
def build():
    out = []

    # ---------- Casa de Martín (aquí empieza la partida) ----------
    m = room('casa_martin', 'Casa de Martín', 16, 12, 'piso_6', 'pared_3', 'base_pared_3', 7)
    furnish(m, [
        ('ventana', 3, 0), ('ventana', 11, 0), ('cuadro', 7, 0), ('reloj', 6, 1), ('calendario', 10, 1),
        ('cama', 1, 3), ('cama', 4, 3),                          # Martín y su hermano
        ('stand_libros', 13, 3), ('libros_de_pie', 12, 3),
        ('mesa', 11, 6), ('laptop', 11, 6), ('silla_de_frente', 11, 8), ('silla_2', 13, 6),
        ('alfombra_2_2', 7, 5, 'none'), ('alfombra', 7, 9, 'none'),
        ('bonzai', 1, 9), ('maceta_cactus', 14, 9), ('pesas', 4, 8), ('vasija_2', 1, 7),
    ])
    resident(m, 'casa_martin_mama', 'Mamá', 'Irena.png', -35, 10, 4, 'down',
             '¡Hola, cariño! Se nota que tus dinos están cansados de tanto combatir.\nDescansen un rato aquí en casa... ¡Listo! Todos están como nuevos. Y vuelve a la hora de la cena, ¿eh?')
    m['npcs'][-1]['restHome'] = True   # hablar con Mamá quita el cansancio de todos tus dinos
    out.append((m, (52, 63)))

    # ---------- Casa del pintor (casa_1, norte del pueblo) ----------
    m = room('casa_pintor', 'Casa del Pintor', 14, 10, 'piso_madera_dise_p', 'pared_1', 'base_pared_2', 6)
    furnish(m, [
        ('cuadro', 2, 0), ('cuadro_1', 6, 1), ('cuadro_2', 9, 1), ('ventana_1', 12, 1),
        ('stand_pintura', 2, 3), ('stand_pintura_2', 4, 3), ('stand_pintura_3', 9, 3), ('stand_pintura_4', 11, 3),
        ('stand_pintura_5', 1, 6),
        ('mesa_madera', 6, 4), ('silla', 5, 5), ('sillin', 8, 5),
        ('alfombra_2_2', 6, 6, 'none'), ('bonzai_2', 12, 7), ('vasija_2', 1, 8),
    ])
    resident(m, 'casa_pintor_clara', 'Pintora Clara', 'Vivian.png', 30, 3, 6, 'right',
             '¡Bienvenido a mi taller! Pinto dinos de memoria... aunque los legendarios nunca posan.\nDicen que en lo más hondo de la Cueva Meteoro hay cristales de todos los colores. ¡Me encantaría pintarlos!')
    out.append((m, (40, 50)))

    # ---------- Casa de la biblioteca (casa_3) ----------
    m = room('casa_lectora', 'Casa de la Lectora', 14, 10, 'piso_5', 'pared_madera', 'base_pared_2', 6)
    furnish(m, [
        ('cuadro_3', 6, 1), ('reloj', 9, 1), ('ventana_1', 1, 1),
        ('stand_libros', 1, 3), ('stand_libros', 3, 3), ('stand_libros', 9, 3), ('stand_libros', 11, 3),
        ('libros_de_pie', 5, 3), ('libros_de_pie', 8, 3),
        ('mesa', 6, 5), ('libros', 6, 5), ('libros_2', 7, 5), ('silla_de_frente', 6, 7), ('silla_2', 8, 5),
        ('alfombra', 3, 6, 'none'), ('estatua_para_casa', 12, 6), ('maceta_cactus', 1, 7),
    ])
    resident(m, 'casa_lectora_elsa', 'Lectora Elsa', 'Ritza.png', -30, 9, 6, 'left',
             'Según mis libros, hay siete Piedras Elementales, una por cada Guardián del pueblo.\nTambién leí que los dinos más fuertes se esconden en lo profundo de las cuevas. Cuanto más bajas, más raros son.')
    out.append((m, (40, 62)))

    # ---------- Casa del deportista (casa_4) ----------
    m = room('casa_deportista', 'Casa del Deportista', 14, 10, 'piso_5', 'pared_tronco', 'base_pared_2', 6)
    furnish(m, [
        ('ventana', 2, 0), ('ventana', 10, 0), ('calendario', 6, 1), ('reloj', 7, 1),
        ('saco_boxeo', 1, 3), ('pesas', 6, 4), ('pesas', 7, 4),
        ('cama_2', 10, 3), ('mesa_madera', 10, 6), ('sillin', 9, 7), ('laptop_2', 11, 6),
        ('alfombra_2_2', 6, 6, 'none'), ('bonzai', 12, 8),
    ])
    resident(m, 'casa_deportista_bruno', 'Deportista Bruno', 'Maxwell.png', 35, 7, 5, 'down',
             '¡Cien flexiones antes del desayuno! Mis dinos y yo entrenamos juntos.\nUn consejo: equipa un objeto del elemento de tu dino. Los amuletos del Taller dan todavía más poder.')
    out.append((m, (87, 62)))

    # ---------- Casa de los abuelos (casa_chimenea_2) ----------
    m = room('casa_abuelos', 'Casa de los Abuelos', 16, 11, 'piso_patron_2', 'pared', 'base_pared_3', 7)
    furnish(m, [
        ('cuadro', 3, 0), ('cuadro', 11, 0), ('ventana_1', 7, 1), ('reloj', 9, 1), ('calendario', 6, 1),
        ('cama_2', 1, 3), ('cama_2', 12, 3),
        ('mesa_madera', 7, 5), ('silla', 6, 5), ('silla_2', 9, 5), ('silla_de_frente', 7, 7), ('silla_de_frente', 8, 7),
        ('estatua_para_casa', 14, 6), ('bonzai', 1, 7), ('bonzai_2', 2, 7), ('maceta_cactus', 14, 8),
        ('vasija_2', 4, 3), ('alfombra', 7, 8, 'none'), ('stand_libros', 1, 8),
    ])
    resident(m, 'casa_abuelos_tomas', 'Abuelo Tomás', 'Eldon.png', -25, 6, 6, 'right',
             'Cuando yo era joven también cayó un meteorito por aquí... ¡y con él aparecieron las primeras cartas de dinos!\nLa cueva al norte, pasando la Ruta 1, guarda muchos secretos de esa época.')
    resident(m, 'casa_abuelos_rosa', 'Abuela Marta', 'Ruth.png', 25, 9, 6, 'left',
             '¿Quieres un té, cariño? Toma asiento.\nSi entras a la cueva, lleva siempre una Cuerda de Escape. Mi Tomás se perdió allí una vez... ¡tres días!')
    out.append((m, (97, 63)))

    # ---------- Laboratorio del Dr. Cretácico ----------
    m = room('laboratorio', 'Laboratorio del Dr. Cretácico', 20, 12, 'piso_patron', 'pared_3', 'base_pared_2', 9)
    furnish(m, [
        ('ventana', 2, 0), ('ventana', 16, 0), ('cuadro_1', 6, 1), ('calendario', 9, 1), ('reloj', 11, 1), ('cuadro_3', 13, 1),
        ('stand_libros', 1, 3), ('stand_libros', 3, 3), ('libros_de_pie', 5, 3),
        ('mesa', 8, 4), ('laptop', 8, 4), ('laptop_2', 9, 4),
        ('mesa', 12, 4), ('porta_tubos', 12, 4), ('porta_tubos_1', 13, 4),
        ('mesa', 15, 4), ('pocion', 15, 4), ('pocion', 16, 4),
        ('silla_de_frente', 8, 6), ('silla_de_frente', 12, 6), ('sillin', 15, 6),
        ('mesa', 3, 7), ('libros_3', 3, 7), ('libros_2', 4, 7),
        ('estatua_para_casa', 18, 7), ('maceta_cactus', 1, 9), ('bonzai_2', 18, 9),
        ('alfombra_2_2', 9, 8, 'none'),
    ])
    resident(m, 'laboratorio_nico', 'Ayudante Nico', 'Luter.png', -40, 16, 7, 'left',
             '¡Hola! Ayudo al Dr. Cretácico con sus investigaciones. Él suele estar afuera, junto a la puerta.\nEstamos estudiando la rareza de los dinos: comunes, raros y legendarios. ¡Los legendarios casi nunca salen a la superficie!')
    out.append((m, (79, 50)))

    # ---------- Gimnasios (líder al fondo, entrenadores y guía, estilo Pokémon) ----------
    out += build_gyms()
    return out


# ============================================================
# Gimnasios
# ============================================================
# Los líderes (guardianes) se mudan del pueblo a su gimnasio. Conservan su id, equipo y diálogos, y su
# "eventKey" de antes para que las partidas donde ya los venciste los sigan contando como vencidos.
GYMS = [
    {'id': 'gimnasio_ciudad', 'name': 'Gimnasio de la Ciudad', 'leader': 'npc_mukpypqr', 'door': (90, 83),
     'rules': {'maxLevel': 9, 'bannedElement': 'rayo'},
     'floor': 'piso_patron', 'wall': 'pared_cuadrada', 'base': 'base_pared_2', 'barrier': 'base_pared_2',
     'tip': 'Cross entrena dinos de Agua. Los de Rayo y Planta le pegan con todo.\nY ojo: sus aprendices te van a desafiar antes de llegar a él.',
     'decor': [('ventana', 3, 0), ('ventana', 13, 0), ('reloj', 8, 1), ('calendario', 9, 1),
               ('porta_tubos', 2, 3), ('laptop', 15, 3), ('laptop_2', 16, 3), ('pesas', 1, 9), ('pesas', 15, 9),
               ('bonzai', 1, 17), ('maceta_cactus', 16, 17), ('estatua_para_casa', 5, 3), ('estatua_para_casa', 12, 3)],
     'trainers': [
         ('gym_ciudad_teo', 'Nadador Teo', 'Luter.png', 40, [('ampelosaurus', 4), ('isisaurus', 4)], 'tag_team',
          '¡El agua de este gimnasio no es para nadar, es para combatir!', '¡Glub! Me hundiste...'),
         ('gym_ciudad_marco', 'Buzo Marco', 'Maxwell.png', -35, [('suchomimus', 5), ('jobaria', 5)], 'ocean_panic',
          'Cross nos entrena bajo la lluvia todos los días. ¿Y tú?', 'Tienes lo necesario para enfrentar a Cross.')]},
    {'id': 'gimnasio_viento', 'name': 'Gimnasio del Viento', 'leader': 'npc_mukm1r5x', 'door': (14, 19),
     'rules': {'maxLevel': 13, 'bannedElement': 'tierra'},
     'floor': 'piso_patron_2', 'wall': 'pared_3', 'base': 'base_pared_3', 'barrier': 'musgo_2',
     'tip': 'Tiberius manda con dinos de Viento. Los de Tierra y Rayo le pegan con todo.\nSigue el camino entre los arbustos: el viento aquí sopla en zigzag.',
     'decor': [('ventana', 3, 0), ('ventana', 13, 0), ('cuadro', 7, 0), ('ventana_1', 10, 1),
               ('bonzai', 2, 3), ('bonzai_2', 15, 3), ('maceta_cactus', 1, 8), ('maceta_cactus', 16, 9),
               ('bonzai', 1, 17), ('bonzai_2', 16, 17), ('estatua_para_casa', 5, 3), ('estatua_para_casa', 12, 3)],
     'trainers': [
         ('gym_viento_ana', 'Piloto Ana', 'Amelia.png', 35, [('afrovenator', 7), ('ceratosaurus', 7)], 'metal_wing',
          '¡Siente la corriente! Nadie llega a Tiberius sin pasar por mí.', 'Me llevaste como una hoja al viento...'),
         ('gym_viento_leo', 'Aviador Leo', 'Alvin.png', -30, [('gojirasaurus', 8), ('deltadromeus', 7), ('allosaurus', 8)],
          'anhanguera_dive', 'Desde aquí arriba se ve todo el pueblo... ¡y tu derrota!', 'Ve. Tiberius te espera al fondo.')]},
    {'id': 'gimnasio_fuego', 'name': 'Gimnasio del Fuego', 'leader': 'npc_mukpuhmt', 'door': (14, 84),
     'rules': {'maxLevel': 12, 'bannedElement': 'agua'},
     'floor': 'piso_piedra', 'wall': 'pared_tronco', 'base': 'base_pared_2', 'barrier': 'bloque_piedra_1',
     'tip': 'Beatrice quema todo con dinos de Fuego. Los de Agua y Viento son tu mejor defensa.\nAquí hace calor... cruza entre las rocas con cuidado.',
     'decor': [('ventana', 3, 0), ('ventana', 13, 0), ('cuadro_2', 7, 1), ('reloj', 10, 1),
               ('vasija_2', 2, 3), ('vasija_2', 15, 3), ('vacija_1', 1, 9), ('vasija_2', 16, 8),
               ('maceta_cactus', 1, 17), ('maceta_cactus', 16, 17), ('estatua_para_casa', 5, 3), ('estatua_para_casa', 12, 3)],
     'trainers': [
         ('gym_fuego_sol', 'Bombera Sol', 'Ruth.png', -25, [('torvosaurus', 6), ('rajasaurus', 7)], 'super_impact',
          '¡Yo apago incendios... pero hoy vengo a encenderlos!', 'Uf... me quemé yo sola.'),
         ('gym_fuego_ivan', 'Herrero Iván', 'Roderick.png', 30, [('carcharodontosaurus', 7), ('mapusaurus', 7)],
          'big_foot_assault', 'Forjo mis dinos al rojo vivo. ¡A ver si aguantas el calor!',
          'Bien templado. Beatrice está al fondo, junto al fuego.')]},
]
LEGACY_IDS = {'gimnasio_rayo'}
ELEMENT_NAMES = {'fuego': 'Fuego', 'agua': 'Agua', 'rayo': 'Rayo', 'tierra': 'Tierra', 'planta': 'Planta',
                 'viento': 'Viento', 'especial': 'Especial'}  # interior anterior, ya reemplazado por gimnasio_ciudad


def find_leader(npc_id, gym_id):
    """Busca al líder en el pueblo; si ya se mudó, en su gimnasio (así el script se puede repetir)."""
    for path in (os.path.join(MAPS_DIR, 'world_map.json'), os.path.join(MAPS_DIR, f'{gym_id}.json')):
        if os.path.exists(path):
            for n in json.load(open(path, encoding='utf-8')).get('npcs', []):
                if n.get('id') == npc_id:
                    return dict(n)
    raise SystemExit(f'No encuentro al líder {npc_id}')


def build_gyms():
    """Sala de 18 x 20: entrada abajo, tres hileras de obstáculos con el paso alternado (zigzag),
    dos entrenadores vigilando los pasillos y el líder al fondo sobre una alfombra."""
    out = []
    W, H, door = 18, 20, 8
    for g in GYMS:
        m = room(g['id'], g['name'], W, H, g['floor'], g['wall'], g['base'], door)
        # Hileras de obstáculos: (fila, columnas del paso)
        for y, gap in ((15, range(13, 16)), (11, range(2, 5)), (7, range(13, 16))):
            for x in range(1, W - 1):
                if x not in gap:
                    place(m, g['barrier'], x, y, solid='all')
        furnish(m, g['decor'] + [('alfombra_2_2', 8, 3, 'none'), ('alfombra', 8, 5, 'none'),
                                 ('estatua_peque_a_1', 6, 16), ('estatua_peque_a_1', 11, 16)])
        leader = find_leader(g['leader'], g['id'])
        leader.update({'x': 8, 'y': 4, 'direction': 'down', 'sightRange': 3,
                       'eventKey': leader.get('eventKey', f'world_map:{g["leader"]}')})
        (t1, t2) = g['trainers']
        npcs = [leader]
        for (tid, name, sprite, tint, team, move, dialog, defeat), (x, y, d) in zip((t1, t2), ((6, 13, 'right'), (11, 9, 'left'))):
            t = trainer(tid, x, y, name, sprite, d, team, move, dialog, defeat, sight=6, exp=90)
            t['tint'] = tint
            npcs.append(t)
        r = g['rules']
        rule = (f'\nREGLA DEL GIMNASIO: sólo se combate con dinos de nivel {r["maxLevel"]} o menos, '
                f'y están prohibidos los de {ELEMENT_NAMES[r["bannedElement"]]}. ¡Prepara un equipo distinto!')
        guide = person(f'{g["id"]}_guia', 5, 18, 'Guía del Gimnasio', 'Eldon.png', 'right',
                       '¡Hola, futuro Dino Rey! Soy el guía de este gimnasio.\n' + g['tip'] + rule)
        guide['tint'] = -20
        npcs.append(guide)
        m['npcs'] = npcs
        m['gymRules'] = g['rules']   # se comprueban en el juego antes de cada combate del gimnasio
        out.append((m, g['door']))
    return out


def connect(interiors):
    """Puertas del pueblo -> interiores, y salidas de los interiores -> una losa debajo de la puerta."""
    ids = {m['_id'] for m, _ in interiors}
    for name in ('world_map.json', 'proyecto_actual.json'):
        path = os.path.join(MAPS_DIR, name)
        if not os.path.exists(path):
            continue
        world = json.load(open(path, encoding='utf-8'))
        warps = [w for w in world.get('warps', []) if w.get('targetMap') not in ids | LEGACY_IDS]
        # Los líderes de gimnasio ya no están en el pueblo
        leaders = {g['leader'] for g in GYMS}
        world['npcs'] = [n for n in world.get('npcs', []) if n.get('id') not in leaders]
        for m, (dx, dy) in interiors:
            for i in range(2):
                world['solid'][dy][dx + i] = 0
                warps.append({'x': dx + i, 'y': dy, 'targetMap': m['_id'], 'targetX': m['spawn']['x'] + i,
                              'targetY': m['spawn']['y'], 'desc': m['name']})
            if world['solid'][dy + 1][dx]:
                print(f'⚠️  La losa frente a la puerta de {m["_id"]} ({dx}, {dy + 1}) está bloqueada en el pueblo')
        world['warps'] = warps
        json.dump(world, open(path, 'w', encoding='utf-8'))
    for m, (dx, dy) in interiors:
        d = m.pop('_door')
        for i in range(2):
            m['warps'].append({'x': d + i, 'y': m['rows'] - 1, 'targetMap': 'world_map', 'targetX': dx + i,
                               'targetY': dy + 1, 'desc': 'Pueblo Meteoro'})


if __name__ == '__main__':
    interiors = build()
    connect(interiors)
    for old in LEGACY_IDS:
        if os.path.exists(os.path.join(MAPS_DIR, f'{old}.json')):
            os.remove(os.path.join(MAPS_DIR, f'{old}.json'))
    for m, _ in interiors:
        map_id = m.pop('_id')
        path = os.path.join(MAPS_DIR, f'{map_id}.json')
        json.dump(m, open(path, 'w', encoding='utf-8'), ensure_ascii=False)
        print(f'🏠 {path} ({m["cols"]}x{m["rows"]})')
        if '--preview' in sys.argv:
            out_dir = os.path.join(ROOT, 'tools', 'vistas')
            os.makedirs(out_dir, exist_ok=True)
            preview(m, os.path.join(out_dir, f'{map_id}.png'))
