#!/usr/bin/env python3
"""
Actualiza dinos.json a partir de las carpetas por tipo (agua/, fuego/, planta/, ...).

- Cada carpeta es un elemento; cada .jpg dentro es una carta (frente | reverso).
- Cartas con marco NARANJA = cartas de movimiento -> se registran como ataques
  ("moveCard": true). El resto son dinosaurios.
- Detecta qué mitad es el frente: el reverso es casi idéntico al de otras cartas,
  la ilustración no (las cartas especiales traen el frente a la derecha).
- Genera la miniatura del frente en cards/<elemento>/<archivo>.jpg y borra las
  miniaturas que ya no correspondan a ninguna carta.
- Conserva ids, nombres, poderes y estadísticas que ya estuvieran en dinos.json.
- Asigna estadísticas base [salud, ataque físico, defensa física, ataque especial,
  defensa especial] a cada dino: entre el mínimo
  (stats.min) y el máximo de su elemento (statCaps), sin repetir combinación
  entre dos dinos.

Uso:  ../../.venv/bin/python actualizar_catalogo.py
"""

import hashlib
import itertools
import json
import os
import random
from collections import OrderedDict

from PIL import Image, ImageChops, ImageStat

DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(DIR, 'dinos.json')
CARDS_DIR = os.path.join(DIR, 'cards')
THUMB_WIDTH = 360

# Nombres que no salen bien del nombre de archivo
NAME_OVERRIDES = {
    'tyrannosurus_rex': ('tyrannosaurus_rex', 'Tyrannosaurus Rex'),
    'torosaurus_dinosaur_king_by': ('torosaurus', 'Torosaurus'),
    'sauralophus_orange': ('saurolophus_naranja', 'Saurolophus Naranja'),
    'saurolophus_green': ('saurolophus_verde', 'Saurolophus Verde'),
    'maiasaura_with_baby': ('maiasaura', 'Maiasaura'),
}

# Dinos protagonistas: reciben las combinaciones más fuertes de su tipo
STAR_DINOS = [
    'tyrannosaurus_rex', 'spinosaurus', 'triceratops', 'parasaurolophus', 'saichania',
    'carnotaurus', 'saltasaurus', 'gigas', 'maximus', 'armatus', 'utahraptor', 'styracosaurus',
]

# Poder por defecto de las cartas de movimiento
MOVE_POWER = {'normal': 50}
MOVE_POWER_DEFAULT = 70


def stem_of(filename):
    base = os.path.splitext(filename)[0]
    return base[:-len('_dinosaur_king')] if base.endswith('_dinosaur_king') else base


def id_and_name(filename):
    stem = stem_of(filename)
    if stem in NAME_OVERRIDES:
        return NAME_OVERRIDES[stem]
    return stem, ' '.join(w.capitalize() for w in stem.split('_'))


def small_halves(path):
    with Image.open(path) as im:
        im = im.convert('RGB')
        w, h = im.size
        return [im.crop((0, 0, w // 2, h)).resize((48, 68)), im.crop((w // 2, 0, w, h)).resize((48, 68))]


def detect_front_sides(paths):
    """Devuelve {ruta: 'left'|'right'}. El reverso se parece mucho al de alguna otra carta."""
    halves = {p: small_halves(p) for p in paths}

    def dist(a, b):
        return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

    sides = {}
    for p, (left, right) in halves.items():
        others = [h for q, hs in halves.items() if q != p for h in hs]
        if not others:
            sides[p] = 'left'
            continue
        dl = min(dist(left, o) for o in others)
        dr = min(dist(right, o) for o in others)
        sides[p] = 'right' if dl < dr else 'left'
    return sides


def is_move_card(path, side='left'):
    """Las cartas de movimiento tienen el marco naranja (se mira el borde del frente)."""
    with Image.open(path) as im:
        im = im.convert('RGB')
        w, h = im.size
        x = int(w * 0.012) if side == 'left' else w // 2 + int(w * 0.012)
        r, g, b = im.getpixel((x, h // 2))
    return r > 200 and 100 < g < 190 and b < 80


def make_thumb(src, dest, side='left'):
    if os.path.exists(dest) and os.path.getmtime(dest) >= os.path.getmtime(src):
        return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with Image.open(src) as im:
        im = im.convert('RGB')
        w, h = im.size
        front = im.crop((0, 0, w // 2, h)) if side == 'left' else im.crop((w // 2, 0, w, h))
        ratio = THUMB_WIDTH / front.width
        front = front.resize((THUMB_WIDTH, round(front.height * ratio)), Image.LANCZOS)
        front.save(dest, quality=85)
    return True


STAT_COUNT = 5  # [salud, ataque físico, defensa física, ataque especial, defensa especial]


def assign_stats(dinos, elements, stat_min, stat_max):
    """Estadísticas base únicas por dino dentro de los límites de su elemento."""
    def caps_for(el):
        caps = list(elements.get(el, {}).get('statCaps', [stat_max] * STAT_COUNT))
        if len(caps) == 3:  # formato antiguo [salud, ataque, defensa]
            caps = [caps[0], caps[1], caps[2], caps[1], caps[2]]
        return [max(stat_min, min(stat_max, c)) for c in caps]

    def in_range(stats, el):
        caps = caps_for(el)
        return (isinstance(stats, list) and len(stats) in (3, STAT_COUNT) and
                all(isinstance(v, int) and stat_min <= v <= c for v, c in zip(stats, caps)))

    def rng_for(d):
        # Semilla por id: el mismo dino recibe siempre el mismo resultado
        return random.Random(int(hashlib.md5(d['id'].encode()).hexdigest(), 16))

    used = set()
    pending = []
    changed = 0
    for d in dinos:
        st = d.get('stats')
        if in_range(st, d['element']) and len(st) == 3:
            # Migración: conservar salud/ataque/defensa como físicos y añadir los especiales
            caps = caps_for(d['element'])
            rng = rng_for(d)
            options = [(a, b) for a in range(stat_min, caps[3] + 1) for b in range(stat_min, caps[4] + 1)
                       if tuple(st) + (a, b) not in used]
            if d['id'] in STAR_DINOS:
                best = max(a + b for a, b in options)
                options = [o for o in options if sum(o) == best]
            st = list(st) + list(rng.choice(options))
            d['stats'] = st
            changed += 1
        if in_range(st, d['element']) and len(st) == STAT_COUNT and tuple(st) not in used:
            used.add(tuple(st))
        else:
            pending.append(d)

    # Protagonistas primero para que tomen las combinaciones más altas
    pending.sort(key=lambda d: (d['id'] not in STAR_DINOS, STAR_DINOS.index(d['id']) if d['id'] in STAR_DINOS else 0))
    for d in pending:
        caps = caps_for(d['element'])
        combos = [c for c in itertools.product(*[range(stat_min, m + 1) for m in caps]) if c not in used]
        if not combos:
            raise SystemExit(f'❌ No quedan combinaciones de estadísticas libres para {d["id"]} ({d["element"]})')
        if d['id'] in STAR_DINOS:
            best = max(sum(c) for c in combos)
            combos = [c for c in combos if sum(c) == best]
        pick = rng_for(d).choice(combos)
        used.add(pick)
        d['stats'] = list(pick)
    return changed + len(pending)


def main():
    with open(CATALOG, encoding='utf-8') as f:
        catalog = json.load(f, object_pairs_hook=OrderedDict)

    elements = list(catalog.get('elements', {}).keys())
    old_dinos = {os.path.basename(d.get('image', '')): d for d in catalog.get('dinos', [])}
    old_attacks = {a['id']: a for a in catalog.get('attacks', [])}

    dinos, moves, used_thumbs = [], [], set()
    new_thumbs = 0

    folders = [e for e in elements if os.path.isdir(os.path.join(DIR, e))]
    folders += sorted(d for d in os.listdir(DIR)
                      if os.path.isdir(os.path.join(DIR, d)) and d not in folders and d not in ('cards', 'chibis'))

    all_paths = [os.path.join(DIR, e, fn) for e in folders
                 for fn in sorted(os.listdir(os.path.join(DIR, e))) if fn.lower().endswith('.jpg')]
    sides = detect_front_sides(all_paths)
    old_sides = {os.path.basename(d.get('image', '')): d.get('frontSide', 'left') for d in catalog.get('dinos', [])}
    old_sides.update({os.path.basename(a.get('image', '')): a.get('frontSide', 'left') for a in catalog.get('attacks', []) if a.get('moveCard')})

    for element in folders:
        if element not in catalog['elements']:
            print(f'⚠️  Carpeta "{element}" no es un elemento de dinos.json; se registra igual.')
        for filename in sorted(os.listdir(os.path.join(DIR, element))):
            if not filename.lower().endswith('.jpg'):
                continue
            rel = f'{element}/{filename}'
            card_rel = f'cards/{element}/{filename}'
            used_thumbs.add(card_rel)
            side = sides[os.path.join(DIR, rel)]
            thumb_path = os.path.join(DIR, card_rel)
            if old_sides.get(filename, 'left') != side and os.path.exists(thumb_path):
                os.remove(thumb_path)  # cambió el lado del frente: regenerar
            if make_thumb(os.path.join(DIR, rel), thumb_path, side):
                new_thumbs += 1

            cid, name = id_and_name(filename)
            if is_move_card(os.path.join(DIR, rel), side):
                prev = old_attacks.get(cid, {})
                moves.append(OrderedDict([
                    ('id', cid),
                    ('name', prev.get('name', name)),
                    ('element', element),
                    ('power', prev.get('power', MOVE_POWER.get(element, MOVE_POWER_DEFAULT))),
                    ('category', prev.get('category', 'fisico')),
                    ('level', prev.get('level', 1)),
                    ('moveCard', True),
                    ('image', rel),
                    ('card', card_rel),
                ]))
                if side == 'right':
                    moves[-1]['frontSide'] = 'right'
            else:
                prev = old_dinos.get(filename, {})
                entry = OrderedDict([
                    ('id', prev.get('id', cid)),
                    ('name', prev.get('name', name)),
                    ('image', rel),
                    ('element', element),
                    ('card', card_rel),
                ])
                if side == 'right':
                    entry['frontSide'] = 'right'
                # Solo conservar las stats si el dino sigue en el mismo elemento
                if 'stats' in prev and prev.get('element') == element:
                    entry['stats'] = prev['stats']
                dinos.append(entry)

    stat_cfg = catalog.get('stats', {})
    new_stats = assign_stats(dinos, catalog['elements'], stat_cfg.get('min', 4), stat_cfg.get('max', 10))

    # Ataques normales (sin carta) se conservan; las cartas de movimiento se regeneran
    plain_attacks = [a for a in catalog.get('attacks', []) if not a.get('moveCard')]
    catalog['dinos'] = dinos
    catalog['attacks'] = plain_attacks + moves

    with open(CATALOG, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write('\n')

    # Borrar miniaturas huérfanas
    removed = 0
    for root, _, files in os.walk(CARDS_DIR):
        for fn in files:
            rel = os.path.relpath(os.path.join(root, fn), DIR).replace(os.sep, '/')
            if rel not in used_thumbs:
                os.remove(os.path.join(root, fn))
                removed += 1
    for root, dirs, _ in os.walk(CARDS_DIR, topdown=False):
        for d in dirs:
            p = os.path.join(root, d)
            if not os.listdir(p):
                os.rmdir(p)

    print(f'✔ {len(dinos)} dinos y {len(moves)} cartas de movimiento en dinos.json')
    print(f'✔ {new_thumbs} miniaturas generadas, {removed} miniaturas antiguas borradas')
    print(f'✔ {new_stats} dinos con estadísticas nuevas o ampliadas (5 stats)')
    for el in folders:
        nd = sum(1 for d in dinos if d['element'] == el)
        nm = sum(1 for m in moves if m['element'] == el)
        print(f'   {el:9s} {nd:3d} dinos  {nm:2d} movimientos')


if __name__ == '__main__':
    main()
