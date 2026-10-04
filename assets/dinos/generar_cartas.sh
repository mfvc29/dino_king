#!/bin/bash
# Regenera miniaturas (cards/<tipo>/) y actualiza dinos.json a partir de las carpetas por tipo.
# Uso: ./generar_cartas.sh
cd "$(dirname "$0")"
PY=../../.venv/bin/python
[ -x "$PY" ] || PY=python3
"$PY" actualizar_catalogo.py
