# Formato de las imágenes de dinosaurios

## Estructura del archivo de imagen

Cada imagen `.jpg` en esta carpeta tiene la siguiente estructura:

```
┌─────────────────────────────────────────┐
│                                         │
│   Mitad izquierda   │  Mitad derecha    │
│   (Frente de la     │  (Reverso de la   │
│      tarjeta)       │     tarjeta)      │
│                     │                   │
│   🦕 Dinosaurio     │   🎴 Reverso      │
│                     │                   │
└─────────────────────────────────────────┘
```

- **Fondo**: Blanco
- **Ancho total**: El doble de una carta individual
- **Mitad izquierda**: Frente de la tarjeta con la imagen del dinosaurio
- **Mitad derecha**: Reverso/parte trasera de la tarjeta (diseño genérico)

## Ejemplo visual

La imagen se ve así (una sola imagen con dos "caras"):

```
[ DINO IMAGE  |  CARD BACK ]
```

## Carpetas

```
assets/dinos/
├── cartas/<tipo>/                 # TUS cartas originales (.jpg / .jpeg). Aquí van las nuevas.
├── grande/<tipo>/izquierda|derecha/  # TUS dinos sin fondo (.png), mirando a cada lado
├── cards/<tipo>/                  # miniaturas del frente de cada carta (las genera el script)
├── arte/<tipo>/                   # dinos livianos (.webp) para el almanaque y los combates (los genera el script)
├── dinos.json                     # catálogo usado por el juego y el editor
├── actualizar_catalogo.py         # genera cards/, arte/ y dinos.json
└── generar_cartas.sh              # atajo para correr el script
```

- `<tipo>` = agua, especial, fuego, normal, planta, rayo, tierra, viento.
- El juego sólo usa `dinos.json`, `cards/` y `arte/`. `cartas/` y `grande/` son los originales con los
  que el script los genera (no se suben a Firebase: ver `firebase.json`).
- El arte de un dino se busca por nombre: `grande/fuego/izquierda/eocarcharia.png` → dino `eocarcharia`.
  Si un nombre no coincide, el script lo avisa (se puede agregar en `ART_ALIASES`).

- **Todas las cartas son dinosaurios** (entran en `dinos`), también las de marco naranja que
  antes eran cartas de movimiento: ahora cuenta el dino que aparece en ellas. Los ataques son
  sólo los de `attacks` (sin cartas).
- El nombre sale del archivo (se limpian "(games)", "- Dinosaur King", "Card"...). Para las
  cartas cuyo archivo no dice qué dino es (p. ej. `tag_team_dinosaur_king.jpg`) se agrega el
  nombre en `CARD_OVERRIDES` dentro de `actualizar_catalogo.py`.

## Cómo usar estas imágenes

Para mostrar solo el **frente** (dinosaurio), recortar la mitad izquierda:
- `x: 0, y: 0, width: ancho/2, height: alto`

Para mostrar solo el **reverso** de la tarjeta, recortar la mitad derecha:
- `x: ancho/2, y: 0, width: ancho/2, height: alto`

## Nota sobre el fondo blanco

El fondo blanco puede ser removido/ignorado aplicando una máscara o usando
`background-color: white` como referencia para chroma key si se necesita
transparencia.

## Catálogo `dinos.json` (usado por el editor y el juego)

- `dinos`: `id`, `name`, `image` (carta original en `cartas/`), `card` (miniatura del frente en `cards/`), `element`,
  `stats`, `art` (`left` / `right`: el dino en `arte/`) y `frontSide: "right"` si el frente de la carta está
  en la mitad derecha (las especiales).
- `stats`: estadísticas base `[salud, ataque, defensa]` de 0 a 10. Mínimo 4 y máximo según el
  `statCaps` de su elemento; no hay dos dinos con la misma combinación. En el juego valen
  base x nivel (nivel 50 con base 10 = 500). El script asigna stats solo a los dinos que no tengan
  unas válidas, así que puedes editarlas a mano.
- `attacks`: `id`, `name`, `element` y `power`. Agrega aquí nuevos ataques y aparecerán en el editor.
- `elements`: nombre, icono y color de cada elemento (según el reverso de la carta).
- `typeChart`: tabla de tipos. `beats` indica a qué elementos es eficaz cada uno (daño x`effective`);
  `resisted` (x0.5) contra el elemento que le gana y contra el mismo elemento. Normal siempre es neutro.

Al añadir cartas nuevas:
1. Copia la carta (`.jpg` o `.jpeg`) en `cartas/<tipo>/` (por ejemplo `cartas/fuego/`).
2. Copia el dino sin fondo en `grande/<tipo>/izquierda/` y `grande/<tipo>/derecha/` (`.png`, mismo nombre).
3. Ejecuta `./generar_cartas.sh` (o `python3 actualizar_catalogo.py`). Crea la miniatura en `cards/`, el arte
   liviano en `arte/` y actualiza `dinos.json` conservando los nombres, ids y estadísticas que ya hayas
   editado a mano. Sólo procesa lo nuevo o modificado.
