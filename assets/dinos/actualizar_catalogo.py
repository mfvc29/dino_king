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
- Asigna "speed" (velocidad base 1-10, según el elemento) a los dinos que no la tengan.
- Asigna "size" (tamaño 1-6, según su tamaño real; tabla SIZES) y "pose" (vuela / nada) a los dinos.
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


# Velocidad base (decide quién ataca primero en el equipo rival). Rango por elemento: los de viento son
# los más rápidos y los de tierra los más lentos. Se puede editar a mano en dinos.json ("speed").
SPEED_RANGES = {'viento': (6, 10), 'rayo': (5, 9), 'fuego': (5, 9), 'especial': (5, 10),
                'normal': (5, 9), 'agua': (4, 8), 'planta': (4, 8), 'tierra': (4, 7)}


def assign_speed(dinos):
    added = 0
    for d in dinos:
        lo, hi = SPEED_RANGES.get(d['element'], (4, 9))
        if isinstance(d.get('speed'), int) and 1 <= d['speed'] <= 10:
            continue
        rng = random.Random(int(hashlib.md5((d['id'] + ':speed').encode()).hexdigest(), 16))
        d['speed'] = rng.randint(lo, hi)
        added += 1
    return added


# Tamaño del dino (1-6) según su tamaño real: en los combates y en el almanaque el arte se dibuja a esa escala.
#   1 pequeño (< 3 m) · 2 mediano (3-5 m) · 3 grande (5-8 m) · 4 muy grande (8-11 m) · 5 gigante (11-15 m)
#   6 colosal (> 15 m). Las versiones jefe de Dinosaur King (Alpha, Black, Gigas, Maximus, Armatus) van un
#   punto por encima de su especie. Se puede editar a mano en dinos.json ("size"); los dinos nuevos que no
#   estén en esta tabla reciben 3.
SIZES = {
    # agua
    'bajadasaurus': 5, 'camarasaurus': 6, 'elasmosaurus': 5, 'irritator': 3, 'ophthalmosaurus': 3,
    'amargasaurus': 4, 'ampelosaurus': 5, 'baryonyx': 4, 'futabasaurus': 4, 'isisaurus': 6, 'jobaria': 6,
    'saltasaurus': 4, 'shunosaurus': 4, 'spinosaurus_atacando': 6, 'spinosaurus': 6, 'suchomimus': 4,
    # especial
    'indoraptor': 3, 'brontosaurus': 6, 'cryolophosaurus': 3, 'deinonychus': 2, 'indominus_rex': 5,
    'megalosaurus': 3, 'pachycephalosaurus': 2, 'therizinosaurus': 4,
    # fuego
    'alioramus': 3, 'alpha_acrocanthosaurus': 6, 'black_tyrannosaurus_rex': 6, 'eocarcharia': 3,
    'giganotosaurus': 5, 'acrocanthosaurus': 5, 'carcharodontosaurus': 5, 'daspletosaurus': 4, 'gigas': 6,
    'mapusaurus': 5, 'rajasaurus': 3, 'saurophaganax': 5, 'torvosaurus': 4, 'tyrannosaurus_rex': 5,
    'yangchuanosaurus': 4,
    # normal
    'pawpawsaurus': 2, 'piatnitzkysaurus': 2, 'quetzalcoatlus': 4, 'anhanguera': 2, 'velociraptor': 1,
    # planta
    'charonosaurus': 5, 'corythosaurus': 4, 'olorotitan': 4, 'pteranodon': 3, 'seismosaurus': 6,
    'supersaurus': 6, 'tupandactylus': 2, 'tupuxuara': 2, 'altirhinus': 3, 'fukuisaurus': 2, 'iguanodon': 4,
    'lanzhousaurus': 4, 'maiasaura': 4, 'parasaurolophus': 4, 'saurolophus_naranja': 4,
    'saurolophus_verde': 4, 'shantungosaurus': 6,
    # rayo
    'centrosaurus': 3, 'chasmosaurus': 3, 'einiosaurus': 2, 'machairoceratops': 3, 'monoclonius': 3,
    'zuniceratops': 2, 'achelousaurus': 3, 'anchiceratops': 3, 'maximus': 5, 'nedoceratops': 4,
    'pachyrhinosaurus': 4, 'pentaceratops': 3, 'styracosaurus': 3, 'torosaurus': 4, 'triceratops': 4,
    # tierra
    'dacentrurus': 4, 'gigantspinosaurus': 2, 'kentrosaurus': 2, 'pinacosaurus': 2, 'polacanthus': 2,
    'sauropelta': 3, 'ankylosaurus': 3, 'armatus': 4, 'edmontonia': 3, 'scolosaurus': 3, 'euoplocephalus': 3,
    'lexovisaurus': 3, 'saichania': 3, 'stegosaurus': 4, 'tuojiangosaurus': 3,
    # viento
    'dilophosaurus': 3, 'liliensternus': 2, 'neovenator': 3, 'sinraptor': 3, 'szechuanosaurus': 3,
    'afrovenator': 3, 'allosaurus': 4, 'carnotaurus': 4, 'ceratosaurus': 3, 'deltadromeus': 4,
    'gojirasaurus': 3, 'majungasaurus': 3, 'megaraptor': 4, 'utahraptor': 3,
}

# Pose en combate: los pterosaurios vuelan sobre su carta y los reptiles marinos flotan como en el agua.
POSES = {
    'pteranodon': 'vuela', 'quetzalcoatlus': 'vuela', 'anhanguera': 'vuela', 'tupandactylus': 'vuela',
    'tupuxuara': 'vuela',
    'elasmosaurus': 'nada', 'futabasaurus': 'nada', 'ophthalmosaurus': 'nada',
}


def assign_size(dinos):
    """Pone "size" (1-6) a los dinos que no lo tengan y "pose" a los que vuelan o nadan."""
    added = 0
    for d in dinos:
        if not (isinstance(d.get('size'), int) and 1 <= d['size'] <= 6):
            d['size'] = SIZES.get(d['id'], 3)
            added += 1
        if 'pose' not in d and d['id'] in POSES:
            d['pose'] = POSES[d['id']]
    return added


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
                for key in ('speed', 'size', 'pose'):
                    if key in prev:
                        entry[key] = prev[key]
                dinos.append(entry)

    art_made, art_unmatched = build_art(dinos)
    new_speed = assign_speed(dinos)
    new_size = assign_size(dinos)

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

    print(f'✔ {len(dinos)} dinos en dinos.json ({new_speed} con velocidad nueva, {new_size} con tamaño nuevo)')
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
