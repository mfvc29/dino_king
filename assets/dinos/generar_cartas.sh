#!/bin/bash
# Genera las miniaturas (cards/), el arte del dino (arte/) y dinos.json a partir de cartas/ y grande/.
# Uso: ./generar_cartas.sh
cd "$(dirname "$0")"
PY=../../.venv/bin/python
[ -x "$PY" ] || PY=python3
"$PY" actualizar_catalogo.py
