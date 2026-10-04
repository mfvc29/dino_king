# 🦖 Dino Rey - RPG de cartas de dinosaurios (estilo Pokémon + Persona 5)

¡Prototipo de exploración y mundo estilo Pokémon para **Dino King**!
Enfocado en la experiencia de caminar por el mapa con sprites del generador Universal LPC, colisiones con árboles/agua, hierba alta y minimapa en tiempo real.

---

## 📁 Estructura del Proyecto

```text
dino_king/
├── index.html              # Juego (título, mundo, combate, torneo, menú)
├── server.py               # Servidor local + multijugador (en la nube: Render)
├── firebase.json           # Publicación en Firebase Hosting
├── deployment_guide.md     # Cómo está montado en la nube
├── sheet/                  # Apps Script de Google Sheets (guardado en la nube)
├── css/                    # style.css + dinorey.css
├── js/                     # game, tilemap, battle, cards, story, save, tournament...
├── tools/
│   ├── map_editor/         # Editor de mapas (local en :8080, nube en /tools/map_editor/)
│   ├── generar_rutas.py    # Genera Ruta 1, Cueva y Estadio
│   ├── generar_minimapa.py # assets/maps/minimapa.png
│   └── generar_manifiestos.py
└── assets/
    ├── maps/               # Mapas .json + tilesets (Outside, Caves, charcos)
    ├── characters/         # Sprites LPC, protagonistas.json, historia_y_dialogos.md
    ├── dinos/              # Cartas, dinos.json y herramientas del catálogo
    └── story/              # historia.json
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

- **Mapa del mundo (tecla `M`):** Abre el mapa completo con el recuadro de la cámara, los jugadores conectados y los entrenadores/NPCs. Se cierra con `M` o `Esc`.
- **Eventos de combate:** Los entrenadores colocados en el Advance Map Studio (herramienta 🧑, tecla `N`) te desafían al verte en su línea de visión. Habla con cualquier NPC con `Espacio` o `E`.
- **Cámara con seguimiento suave:** La cámara acompaña suavemente los pasos del jugador seleccionado (puedes alternar el enfoque entre P1 y P2 en el panel).
- **Hierba Alta (🌿):** Al caminar por los parches verdes oscuros, se dibujan mechones de hierba sobre los pies del personaje y se detecta la zona de posibles dinos salvajes.
- **Profundidad 2.5D:** Los troncos de los árboles y el agua tienen colisiones sólidas; al caminar por detrás de los árboles, el follaje cubre al personaje de forma realista.
- **Encuentro de Entrenadores:** Al acercarte al Rival (P2), saldrá el clásico globo de exclamación `!` de Pokémon y un aviso de interacción.


---

## 👑 Dino Rey: historia, combates y guardado

### Inicio y partidas guardadas
- **Pantalla de título:** Continuar (la partida más reciente), Nueva partida y Cargar partida.
- **3 ranuras de guardado.** Cada ranura muestra nombre, capítulo, piedras, equipo y tiempo de juego.
  Puedes exportar (📤), importar (📂) y borrar (🗑) partidas.
- **Autoguardado** tras combates, capturas y avances de historia (se desactiva en Menú → 💾 Guardar).
  También puedes guardar con el botón 💾 de la barra superior o desde el menú.
- Las partidas se guardan en el navegador y se copian en `saves/slotN.json` en el servidor; si borras
  los datos del navegador, la pantalla de título las recupera del servidor.
- **Solo dos protagonistas** (`assets/characters/protagonistas.json`): Fer y Ander. Cada hermano juega con su propia partida.

### Historia (`assets/story/historia.json`)
1. **El temblor:** una noticia habla de un extraño temblor; al salir de casa encuentras la carta de tu dino inicial.
4. **Los Guardianes:** los 7 entrenadores del mapa son Guardianes; cada uno da una **Piedra Elemental**.
5. **La Banda Meteoro:** con 3 piedras aparece el recluta Zarpa junto al Maestro Fósil.
6. **Las siete piedras → El Rey Usurpador:** vence a Rolando frente al Templo del Meteorito para
   convertirte en **Dino Rey**. Tu hermano no es un rival: juega con su propia partida.

Todo se edita en el JSON: textos (`{player}`, `{rival}` = tu hermano, `{stones}`, `{left}`), capítulos y sus
condiciones, personajes (posición, sprite, equipo, diálogos) y qué Guardián da cada piedra.

### Combate estilo Persona 5 (`js/battle.js`)
- **Debilidad → DERRIBO → ¡UNA MÁS!:** un ataque eficaz por tipo (o un crítico físico) derriba al rival y
  tu dino actúa otra vez. Un dino derribado pierde su siguiente acción. **Defender** evita ser derribado.
- **Relevo:** durante "¡Una más!" pasa la acción a otro dino (+50% de daño, x2 si encadenas dos).
- **Ataque total:** con todos los rivales derribados, todo tu equipo ataca a la vez.
- Los rivales también aprovechan tus debilidades. De los combates de historia no se puede huir.
- **Teclado:** `1`-`4` ataques, `1`-`3` objetivo, `D` defender, `H` huir, `Z`/`X` relevo, `T` ataque total,
  `Q` terminar la acción extra, `Esc` cancelar, `Espacio`/`Enter` continuar.

### Niveles
- Los dinos **no evolucionan**: solo suben de nivel (máx. 50). Ganar a un salvaje da +15% de nivel al
  equipo y a un entrenador +20% por cada dino derrotado. El Maestro Fósil enseña ataques nuevos.

### Personajes
- **Protagonistas:** los hermanos **Fer** (estratega, viento, empieza con Deltadromeus) y **Ander** (impulsivo, fuego,
  empieza con Acrocanthosaurus; mientras no exista su carta usa Carcharodontosaurus). Datos, frases de batalla y
  dino inicial en `assets/characters/protagonistas.json` (historia base: `assets/characters/historia_y_dialogos.md`).
- **Historia:** Dr. Cretácico (despierta tu dino y gestiona tu equipo), Vendedora Ámbar (tienda con
  Dino-Créditos), Maestro Eldon (enseña ataques), Recluta Darius,
  Comandante Helmep (Cueva Meteoro) y Rolando, el Rey Usurpador.
- **Guardianes (Pueblo Meteoro):** Beatrice 🔥, Cross 💧, Nelly ⚡, Trevor ⛰️, Livia 🌿, Tiberius 🌪️ y Ulises ✨.
  Cada uno lleva 3 dinos de su elemento (3 ataques cada uno) y una carta de movimiento.
- **Ruta 1:** Ruth, Alvin, Amelia, Luter y Maxwell. **Cueva Meteoro:** Ritza, Vivian y Rose.

### ✏️ Editar y publicar mapas
Usa **`./generador_de_mapa/generador_de_mapa.sh`** (guía en `generador_de_mapa/README.md`): abre el editor,
y al terminar valida, actualiza el minimapa, sube a GitHub y despliega en Firebase.

### Mapas y rutas (`tools/generar_rutas.py`)
- Pueblo Meteoro (norte, x 59-61) → **Ruta 1** → **Cueva Meteoro** (puerta en la pared de roca).
- Las rutas se dibujan como texto en `tools/generar_rutas.py` (una letra por losa) usando `Outside.png` y
  `Caves.png`. Edita el dibujo o los personajes y ejecuta `python3 tools/generar_rutas.py --preview`
  (la vista previa queda en `tools/vistas/`).

### Gran Torneo Mesozoico (`js/tournament.js`, mapa `torneo`, al sur del pueblo)
- Al entrar al estadio el Árbitro ofrece combatir: **solo** (tú + tu hermano con IA + 6 NPCs) o **con alguien más**
  (Fer y Ander los manejan dos personas en la misma pantalla; el segundo equipo sale de otra ranura de guardado,
  al azar o eligiendo 3 cartas).
- 8 Tamers, todos los dinos a nivel 50, cuartos → semifinal → gran final. Los 6 NPCs salen al azar sin repetir los
  del torneo anterior. Los combates entre NPCs se simulan. Antes de la final puede aparecer un Dinosaurio Alfa.
- Campeón: +1500 Dino-Créditos y suma en "Torneos ganados".

### IA de los rivales
- Campo `"ai"` de cada entrenador: `normal`, `dificil` o `experto`. Las difíciles se defienden cuando corren peligro,
  buscan derribos para encadenar acciones, preparan y lanzan Ataques totales, intimidan al dino más peligroso
  y rematan primero al que más daño hace. Guardianes y Ruta 1: difícil · Cueva, Helmep, Rolando y torneo: experto.
