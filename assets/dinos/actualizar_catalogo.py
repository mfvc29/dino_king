#!/usr/bin/env python3
"""
Actualiza dinos.json a partir de las carpetas por tipo (agua/, fuego/, planta/, ...).

- cartas/<elemento>/: cada .jpg / .jpeg es una carta (frente | reverso). Aquí se ponen las cartas nuevas.
- TODAS las cartas son dinosaurios (también las de marco naranja, que antes eran
  cartas de movimiento: ahora el dino que aparece en ellas es una carta de dino).
- El nombre sale del archivo, limpiando "(games)", "- Dinosaur King", "Card", etc.
- Arte del dino (estilo Yu-Gi-Oh, sale sobre la carta en el almanaque y en los combates):
  grande/<elemento>/izquierda/*.png y grande/<elemento>/derecha/*.png (dino mirando a cada lado, con
  fondo transparente) se copian livianos a arte/<elemento>/<id>_izq.webp y _der.webp. Los originales de
  grande/ no se modifican (y grande/<elemento>/jpeg tampoco se usa).
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
import re
from collections import OrderedDict

from PIL import Image, ImageChops, ImageStat

DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(DIR, 'dinos.json')
CARDS_DIR = os.path.join(DIR, 'cards')
CARDS_SRC = os.path.join(DIR, 'cartas')   # cartas originales, una carpeta por elemento
THUMB_WIDTH = 360

# Nombres que no salen bien del nombre de archivo
NAME_OVERRIDES = {
    'tyrannosurus_rex': ('tyrannosaurus_rex', 'Tyrannosaurus Rex'),
    'torosaurus_dinosaur_king_by': ('torosaurus', 'Torosaurus'),
    'sauralophus_orange': ('saurolophus_naranja', 'Saurolophus Naranja'),
    'saurolophus_green': ('saurolophus_verde', 'Saurolophus Verde'),
    'maiasaura_with_baby': ('maiasaura', 'Maiasaura'),
}

# Cartas que antes eran de movimiento (o con nombre raro): el dino que aparece en la carta.
# Las que no tienen el nombre del dino en el archivo conservan el nombre de la carta hasta que se agregue aquí.
CARD_OVERRIDES = {
    'futabasaurus_super_cannon': ('futabasaurus', 'Futabasaurus'),
    'anhanguera_dive': ('anhanguera', 'Anhanguera'),
    'quetzalcoalt': ('quetzalcoatlus', 'Quetzalcoatlus'),
    'escolossauro': ('scolosaurus', 'Scolosaurus'),
}
# Palabras que sobran en los nombres de archivo nuevos
NAME_NOISE = [r'\(games?\)', r'\(\d+\)', r'-\s*dinosaur king', r'\bmove card\b', r'\bcard\b', r'\baquatic shot\b']
SKIP_FOLDERS = {'cards', 'chibis', 'grande', 'arte', '__pycache__'}

# Arte grande del dino (PNG transparente) -> versión liviana para el juego
ART_SRC = os.path.join(DIR, 'grande')
ART_OUT = os.path.join(DIR, 'arte')
ART_WIDTH = 520
ART_SIDES = {'izquierda': ('left', 'izq'), 'derecha': ('right', 'der')}
# Nombres de archivo del arte que no coinciden con el id del dino
ART_ALIASES = {
    'inndominus_rex': 'indominus_rex',
    'eionosaurus': 'einiosaurus',
    'sauralophus_green': 'saurolophus_verde',
    'saurolophus_green': 'saurolophus_verde',
}
IMAGE_EXT = ('.jpg', '.jpeg')

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
    clean = stem
    for pat in NAME_NOISE:
        clean = re.sub(pat, ' ', clean, flags=re.IGNORECASE)
    words = re.sub(r'[^0-9a-zA-ZáéíóúñÁÉÍÓÚÑ]+', ' ', clean).split()
    cid = '_'.join(w.lower() for w in words)
    if cid in CARD_OVERRIDES:
        return CARD_OVERRIDES[cid]
    return cid, ' '.join(w.capitalize() for w in words)


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


def build_art(dinos):
    """Copia liviana (webp, recortada al dino) del arte de grande/ y la anota en cada dino como "art"."""
    by_id = {d['id']: d for d in dinos}
    made, unmatched = 0, []
    for d in dinos:
        d.pop('art', None)
    if not os.path.isdir(ART_SRC):
        return made, unmatched
    for element in sorted(os.listdir(ART_SRC)):
        for side_dir, (side, suffix) in ART_SIDES.items():
            src_dir = os.path.join(ART_SRC, element, side_dir)
            if not os.path.isdir(src_dir):
                continue
            for fn in sorted(os.listdir(src_dir)):
                if not fn.lower().endswith('.png'):
                    continue
                cid, _ = id_and_name(fn)
                cid = ART_ALIASES.get(cid, cid)
                dino = by_id.get(cid)
                if not dino:
                    unmatched.append(f'{element}/{side_dir}/{fn}')
                    continue
                rel = f'arte/{element}/{cid}_{suffix}.webp'
                dest = os.path.join(DIR, rel)
                src = os.path.join(src_dir, fn)
                if not os.path.exists(dest) or os.path.getmtime(dest) < os.path.getmtime(src):
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with Image.open(src) as im:
                        im = im.convert('RGBA')
                        box = im.getchannel('A').getbbox()
                        if box:
                            im = im.crop(box)
                        if im.width > ART_WIDTH:
                            im = im.resize((ART_WIDTH, round(im.height * ART_WIDTH / im.width)), Image.LANCZOS)
                        im.save(dest, 'WEBP', quality=82, method=6)
                    made += 1
                dino.setdefault('art', OrderedDict())[side] = rel
    return made, unmatched


def main():
    with open(CATALOG, encoding='utf-8') as f:
        catalog = json.load(f, object_pairs_hook=OrderedDict)

    elements = list(catalog.get('elements', {}).keys())
    old_dinos = {os.path.basename(d.get('image', '')): d for d in catalog.get('dinos', [])}
    old_attacks = {a['id']: a for a in catalog.get('attacks', [])}

    dinos, moves, used_thumbs = [], [], set()
    new_thumbs = 0

    folders = [e for e in elements if os.path.isdir(os.path.join(CARDS_SRC, e))]
    folders += sorted(d for d in os.listdir(CARDS_SRC)
                      if os.path.isdir(os.path.join(CARDS_SRC, d)) and d not in folders and d not in SKIP_FOLDERS)

    all_paths = [os.path.join(CARDS_SRC, e, fn) for e in folders
                 for fn in sorted(os.listdir(os.path.join(CARDS_SRC, e))) if fn.lower().endswith(IMAGE_EXT)]
    sides = detect_front_sides(all_paths)
    old_sides = {os.path.basename(d.get('image', '')): d.get('frontSide', 'left') for d in catalog.get('dinos', [])}
    old_sides.update({os.path.basename(a.get('image', '')): a.get('frontSide', 'left') for a in catalog.get('attacks', []) if a.get('moveCard')})

    for element in folders:
        if element not in catalog['elements']:
            print(f'⚠️  Carpeta "{element}" no es un elemento de dinos.json; se registra igual.')
        for filename in sorted(os.listdir(os.path.join(CARDS_SRC, element))):
            if not filename.lower().endswith(IMAGE_EXT):
                continue
            rel = f'cartas/{element}/{filename}'
            card_rel = f'cards/{element}/{filename}'
            used_thumbs.add(card_rel)
            side = sides[os.path.join(DIR, rel)]
            thumb_path = os.path.join(DIR, card_rel)
            if old_sides.get(filename, 'left') != side and os.path.exists(thumb_path):
                os.remove(thumb_path)  # cambió el lado del frente: regenerar
            if make_thumb(os.path.join(DIR, rel), thumb_path, side):
                new_thumbs += 1

            cid, name = id_and_name(filename)
            if False:  # ya no hay cartas de movimiento: todas son dinos
                pass
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

    art_made, art_unmatched = build_art(dinos)

    stat_cfg = catalog.get('stats', {})
    new_stats = assign_stats(dinos, catalog['elements'], stat_cfg.get('min', 4), stat_cfg.get('max', 10))

    # Ataques normales (sin carta) se conservan; las cartas de movimiento ya no existen
    plain_attacks = [a for a in catalog.get('attacks', []) if not a.get('moveCard')]
    catalog['dinos'] = dinos
    catalog['attacks'] = plain_attacks

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

    print(f'✔ {len(dinos)} dinos en dinos.json')
    with_art = sum(1 for d in dinos if d.get('art'))
    print(f'✔ Arte: {with_art}/{len(dinos)} dinos con imagen grande ({art_made} imágenes nuevas en arte/)')
    if art_unmatched:
        print(f'⚠️  Arte sin dino en el catálogo (revisa el nombre): {art_unmatched}')
    sin_arte = [d['name'] for d in dinos if not d.get('art')]
    if sin_arte:
        print(f'   Dinos sin arte todavía: {", ".join(sin_arte)}')
    print(f'✔ {new_thumbs} miniaturas generadas, {removed} miniaturas antiguas borradas')
    print(f'✔ {new_stats} dinos con estadísticas nuevas o ampliadas (5 stats)')
    for el in folders:
        nd = sum(1 for d in dinos if d['element'] == el)
        nm = sum(1 for m in moves if m['element'] == el)
        print(f'   {el:9s} {nd:3d} dinos  {nm:2d} movimientos')


if __name__ == '__main__':
    main()
