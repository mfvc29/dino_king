# 🦖 Dino King - Exploración de Mapa & Minimapa (Estilo Pokémon)

¡Prototipo de exploración y mundo estilo Pokémon para **Dino King**!
Enfocado en la experiencia de caminar por el mapa con sprites del generador Universal LPC, colisiones con árboles/agua, hierba alta y minimapa en tiempo real.

---

## 📁 Estructura del Proyecto

```text
dino_king/
├── index.html            # Interfaz de exploración con HUD de coordenadas y terreno
├── server.py             # Servidor HTTP local en Python (sin caché)
├── css/
│   └── style.css         # Estilos retro arcade y HUD
├── js/
│   ├── camera.js         # Cámara 2D con suavizado que sigue al jugador
│   ├── tilemap.js        # Generador de ruta estilo Pokémon (hierba, caminos, agua, árboles)
│   ├── minimap.js        # Radar en esquina con terreno, viewport y puntos de jugadores
│   ├── lpcRenderer.js    # Motor de spritesheet Universal LPC (64x64)
│   ├── input.js          # Control de movimiento en 4 direcciones y sprint
│   ├── player.js         # Lógica del personaje (caminar, correr, efecto hierba alta)
│   └── game.js           # Bucle principal, profundidad de capas y encuentros
└── assets/
    ├── sprites/          # Coloca aquí player1.png y player2.png
    ├── maps/             # Recursos de mapas
    └── audio/            # Efectos sonoros futuros
```

---

## 🚀 Cómo Ejecutarlo

1. Abre la terminal en la carpeta:
   ```bash
   cd ~/Documentos/dino_king
   ```
2. Inicia el servidor de desarrollo:
   ```bash
   python3 server.py
   ```
3. Ábrelo en tu navegador:
   **http://localhost:8000**

---

## 🎮 Controles de Exploración

| Acción | Jugador 1 (Martín - Azul) | Jugador 2 (Rival - Rojo) |
|---|---|---|
| **Moverse (4 Direcciones)** | `W`, `A`, `S`, `D` | Flechas `↑`, `←`, `↓`, `→` |
| **Correr (Zapatillas Deportivas)** | `Shift` (o `K`) | `Shift Derecho` |
| **Interactuar / Desafiar** | `Espacio` o `J` | `Enter` |

---

## 🗺️ Características del Mapa Pokémon

- **Minimapa en tiempo real (Arriba a la derecha):** Muestra el mapa completo de la Ruta 1, el recuadro blanco que indica qué parte de la pantalla estás viendo y los puntos de ambos jugadores (P1 azul, P2 rojo).
- **Cámara con seguimiento suave:** La cámara acompaña suavemente los pasos del jugador seleccionado (puedes alternar el enfoque entre P1 y P2 en el panel).
- **Hierba Alta (🌿):** Al caminar por los parches verdes oscuros, se dibujan mechones de hierba sobre los pies del personaje y se detecta la zona de posibles dinos salvajes.
- **Profundidad 2.5D:** Los troncos de los árboles y el agua tienen colisiones sólidas; al caminar por detrás de los árboles, el follaje cubre al personaje de forma realista.
- **Encuentro de Entrenadores:** Al acercarte al Rival (P2), saldrá el clásico globo de exclamación `!` de Pokémon y un aviso de interacción.
