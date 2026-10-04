#!/usr/bin/env bash
# ============================================================
# 🗺️  Dino Rey · Generador de mapa
# ------------------------------------------------------------
#   ./generador_de_mapa.sh            Abre el editor de mapas (http://localhost:8080).
#                                     Al cerrarlo (Ctrl+C) pregunta si quieres publicar.
#   ./generador_de_mapa.sh publicar   Publica los mapas guardados: valida, actualiza el
#                                     minimapa, sube a GitHub y despliega en Firebase.
#   ./generador_de_mapa.sh estado     Muestra qué mapas cambiaron y aún no se publicaron.
#
# Guía completa: generador_de_mapa/README.md
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -x "$ROOT/.venv/bin/python" ]; then PY="$ROOT/.venv/bin/python"; else PY="python3"; fi
EDITOR_URL="http://localhost:8080/"
GAME_URL="https://dino-king-game-mfvc29.web.app"
MAP_FILES=(assets/maps assets/characters/personajes.json)

mapas_cambiados() {
    git status --porcelain -- "${MAP_FILES[@]}"
}

estado() {
    local cambios
    cambios="$(mapas_cambiados)"
    if [ -z "$cambios" ]; then
        echo "✅ No hay cambios de mapas pendientes de publicar."
    else
        echo "📝 Cambios sin publicar:"
        echo "$cambios"
    fi
}

publicar() {
    echo "🔎 1/5 Validando mapas..."
    "$PY" - <<'EOF'
import glob, json, sys
errores = 0
for f in sorted(glob.glob('assets/maps/*.json')):
    try:
        data = json.load(open(f, encoding='utf-8'))
        if isinstance(data, dict) and 'cols' in data and 'layers' not in data and 'ground' not in data:
            print(f'   ⚠️  {f}: no tiene capas'); errores += 1
    except ValueError as e:
        print(f'   ❌ {f}: JSON inválido ({e})'); errores += 1
sys.exit(1 if errores else 0)
EOF

    # El Pueblo Meteoro existe dos veces (world_map y su copia proyecto_actual)
    if [ assets/maps/world_map.json -nt assets/maps/proyecto_actual.json ]; then
        cp assets/maps/world_map.json assets/maps/proyecto_actual.json
    elif [ assets/maps/proyecto_actual.json -nt assets/maps/world_map.json ]; then
        cp assets/maps/proyecto_actual.json assets/maps/world_map.json
    fi

    echo "🧭 2/5 Actualizando listas de mapas y minimapa..."
    "$PY" tools/generar_manifiestos.py
    "$PY" tools/generar_minimapa.py

    if [ -z "$(mapas_cambiados)" ]; then
        echo "✅ No hay cambios de mapas: nada que publicar."
        return 0
    fi

    echo "📦 3/5 Guardando en git..."
    git add -- "${MAP_FILES[@]}"
    git commit -q -m "Mapa: cambios desde el generador de mapa ($(date '+%Y-%m-%d %H:%M'))"

    echo "⬆️  4/5 Subiendo a GitHub..."
    git pull --rebase -q origin main
    git push -q origin main

    echo "☁️  5/5 Desplegando en Firebase..."
    firebase deploy --only hosting

    echo ""
    echo "🎉 ¡Mapa publicado! Ya está en $GAME_URL"
    echo "   (si no ves el cambio, recarga una vez con Ctrl + Shift + R)"
}

editar() {
    echo "=============================================================="
    echo "  🗺️  Dino Rey · Generador de mapa"
    echo "=============================================================="
    echo "  1. Se abre el editor en $EDITOR_URL"
    echo "  2. Elige el mapa arriba (MAPA), edítalo y pulsa 🚀 'Publicar al Juego'"
    echo "     (eso guarda el mapa en assets/maps/)."
    echo "  3. Cuando termines, vuelve aquí y pulsa Ctrl + C."
    echo "     Te preguntaré si quieres publicarlo en la nube."
    echo "=============================================================="

    "$PY" tools/map_editor/app.py &
    local pid=$!
    trap 'kill "$pid" 2>/dev/null || true' EXIT
    sleep 1
    (xdg-open "$EDITOR_URL" >/dev/null 2>&1 || true) &

    # Esperar a que el usuario pulse Ctrl + C
    trap 'echo ""; echo "🛑 Cerrando el editor..."' INT
    wait "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
    trap - INT

    echo ""
    estado
    if [ -n "$(mapas_cambiados)" ]; then
        read -r -p "¿Publicar estos cambios en la nube ahora? (s/n): " respuesta
        if [[ "$respuesta" =~ ^[sS] ]]; then
            publicar
        else
            echo "👍 No se publicó. Cuando quieras: ./generador_de_mapa/generador_de_mapa.sh publicar"
        fi
    fi
}

case "${1:-editar}" in
    editar) editar ;;
    publicar) publicar ;;
    estado) estado ;;
    *) echo "Uso: $0 [editar|publicar|estado]"; exit 1 ;;
esac
