#!/usr/bin/env python3
"""
Manifiestos estáticos para la versión en la nube (Firebase no puede listar carpetas):
  - assets/maps/mapas.json              -> mapas que puede abrir el editor
  - assets/characters/personajes.json   -> sprites para colocar personajes en el editor
Se ejecuta solo antes de cada "firebase deploy" (predeploy en firebase.json).
"""

import glob
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIDDEN_MAPS = {'proyecto_actual.json', 'world_map_antiguo_backup.json', 'mapas.json'}


def main():
    maps_dir = os.path.join(ROOT, 'assets', 'maps')
    maps = sorted(os.path.basename(f) for f in glob.glob(os.path.join(maps_dir, '*.json'))
                  if os.path.basename(f) not in HIDDEN_MAPS)
    maps.sort(key=lambda f: (f != 'world_map.json', f))
    with open(os.path.join(maps_dir, 'mapas.json'), 'w', encoding='utf-8') as fh:
        json.dump(maps, fh, ensure_ascii=False, indent=2)

    chars_dir = os.path.join(ROOT, 'assets', 'characters')
    sprites = sorted(os.path.basename(f) for f in glob.glob(os.path.join(chars_dir, '*.png')))
    with open(os.path.join(chars_dir, 'personajes.json'), 'w', encoding='utf-8') as fh:
        json.dump(sprites, fh, ensure_ascii=False, indent=2)

    print(f'📋 Manifiestos: {len(maps)} mapas, {len(sprites)} personajes')


if __name__ == '__main__':
    main()
