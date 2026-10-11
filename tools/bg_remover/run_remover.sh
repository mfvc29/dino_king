#!/bin/bash
# Dino King - Lanzador de la herramienta QuitaFondos Studio
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROJECT_ROOT="$( cd "$DIR/../.." >/dev/null 2>&1 && pwd )"

# Seleccionar el intérprete que tenga numpy, scipy y PIL instalados
if python3 -c "import numpy, scipy, PIL" 2>/dev/null; then
    PYTHON_CMD="python3"
elif [ -f "$PROJECT_ROOT/.venv/bin/python" ] && "$PROJECT_ROOT/.venv/bin/python" -c "import numpy, scipy, PIL" 2>/dev/null; then
    PYTHON_CMD="$PROJECT_ROOT/.venv/bin/python"
else
    PYTHON_CMD="python3"
fi

echo "Iniciando Dino King - QuitaFondos Studio..."
"$PYTHON_CMD" "$DIR/app.py"

