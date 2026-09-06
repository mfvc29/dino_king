#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

if [ ! -d "$DIR/.venv" ]; then
    echo "Creando entorno virtual e instalando dependencias (solo la primera vez)..."
    python -m venv "$DIR/.venv"
    "$DIR/.venv/bin/pip" install playwright pillow
    "$DIR/.venv/bin/playwright" install chromium
fi

"$DIR/.venv/bin/python" "$DIR/bot_personajes.py"
