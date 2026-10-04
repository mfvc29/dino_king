# 🗺️ Generador de mapa · Dino Rey

Herramienta para **editar los mapas del juego y publicarlos** para que todos los jugadores los vean en
https://dino-king-game-mfvc29.web.app

Todo se hace con un solo script: `generador_de_mapa/generador_de_mapa.sh`

---

## ⚡ Uso rápido

Desde la carpeta del proyecto (`dino_king/`):

```bash
./generador_de_mapa/generador_de_mapa.sh
```

1. Se abre el editor en **http://localhost:8080**.
2. Arriba, en **MAPA**, elige el mapa (Pueblo Meteoro = `world_map`, `ruta_1`, `cueva_meteoro`, `torneo`, `casa_martin`).
3. Edita y pulsa **🚀 Publicar al Juego** (guarda el mapa en `assets/maps/`).
4. Vuelve a la terminal y pulsa **Ctrl + C**. El script te pregunta si quieres publicar → responde **s**.

Listo: el mapa queda guardado en GitHub y publicado en Firebase.

### Otros comandos

| Comando | Qué hace |
|---|---|
| `./generador_de_mapa/generador_de_mapa.sh` | Abre el editor y, al cerrarlo, ofrece publicar |
| `./generador_de_mapa/generador_de_mapa.sh publicar` | Publica los mapas ya guardados (sin abrir el editor) |
| `./generador_de_mapa/generador_de_mapa.sh estado` | Muestra qué mapas cambiaron y faltan por publicar |

---

## 🚀 Qué hace "publicar"

1. **Valida** que todos los `assets/maps/*.json` sean mapas correctos.
2. Copia el Pueblo Meteoro entre `world_map.json` y su copia `proyecto_actual.json`.
3. Actualiza `assets/maps/mapas.json`, `assets/characters/personajes.json` y el **minimapa** (`assets/maps/minimapa.png`).
4. Hace **commit y push** a GitHub (`mfvc29/dino_king`, rama `main`).
5. Despliega en **Firebase Hosting** (`firebase deploy --only hosting`).

Si no hay cambios de mapas, no hace nada.

---

## 🧰 Requisitos (solo la primera vez)

- **Python 3** (usa `.venv` del proyecto si existe) con Pillow (`pip install pillow`) para el minimapa.
- **Git** con permiso para hacer push al repositorio `mfvc29/dino_king`.
- **Firebase CLI** con sesión iniciada en la cuenta del proyecto `dino-king-game-mfvc29`:
  ```bash
  npm install -g firebase-tools
  firebase login
  ```

> Otra persona puede usar la herramienta si clona el repositorio, tiene permiso de push en GitHub
> y acceso al proyecto de Firebase.

---

## 🎨 Reglas del mapa

- Tilesets permitidos: **`Outside.png`**, **`Caves.png`** y **`charcos.png`** (losas de 32 px; el Pueblo usa
  también 16 px en algunas capas).
- Capas: **Suelo base → Terreno → Decoración**. Las capas de arriba se dibujan sobre las de abajo.
- **Colisiones** (🚫): marca en rojo lo sólido (árboles, agua, paredes). **Hierba alta**: zonas donde aparecen dinos salvajes.
- **Puertas / warps** (🚪): llevan a otro mapa (`targetMap`, `targetX`, `targetY`).
- **Personajes** (🧑): entrenadores con 3 dinos, 3 ataques cada uno, carta de movimiento e IA (`normal`, `dificil`, `experto`).
- Los mapas nuevos aparecen solos en el editor, en el minimapa y en el juego al publicar.

### Editor en la nube

También existe en https://dino-king-game-mfvc29.web.app/tools/map_editor/ (sin instalar nada), pero desde ahí
**no puede guardar en el juego**: "Publicar" descarga el `.json`. Para aplicarlo, copia ese archivo en
`assets/maps/` y ejecuta `./generador_de_mapa/generador_de_mapa.sh publicar`.

---

## 🤖 Instrucciones para una IA asistente

Si eres una IA ayudando con este proyecto:

1. **Después de que el usuario edite y guarde un mapa** (en el editor local con "🚀 Publicar al Juego",
   o copiando un `.json` descargado en `assets/maps/`), ejecuta desde la raíz del proyecto:
   ```bash
   ./generador_de_mapa/generador_de_mapa.sh publicar
   ```
   Eso valida, actualiza manifiestos y minimapa, hace commit + push a `main` y despliega en Firebase.
2. Para saber si hay algo pendiente: `./generador_de_mapa/generador_de_mapa.sh estado`.
3. No uses otros tilesets que `Outside.png`, `Caves.png` y `charcos.png`.
4. Los mapas `ruta_1`, `cueva_meteoro` y `torneo` se pueden regenerar desde `tools/generar_rutas.py`
   (dibujo en texto). **Ojo:** regenerarlos sobrescribe los cambios hechos a mano en el editor; si el usuario
   editó esos mapas en el editor, no ejecutes `generar_rutas.py`.
5. No guardes en `assets/maps/world_map.json` sin copiarlo también a `proyecto_actual.json` (el script de
   publicar ya lo hace).
6. El multijugador corre en Render (`render.yaml`, https://dino-king-multijugador.onrender.com) y se
   actualiza solo cuando cambian `server.py`, `requirements.txt` o `render.yaml`; publicar mapas no lo reinicia.
