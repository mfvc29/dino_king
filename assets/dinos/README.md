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

## Carpetas por tipo

Las cartas se organizan en una carpeta por elemento:

```
assets/dinos/
├── agua/  especial/  fuego/  normal/  planta/  rayo/  tierra/  viento/
├── cards/<tipo>/        # miniaturas del frente (generadas automáticamente)
├── dinos.json           # catálogo usado por el juego y el editor
└── actualizar_catalogo.py
```

- **Marco gris / morado** → carta de **dinosaurio** (entra en `dinos`).
- **Marco naranja** → **carta de movimiento** (entra en `attacks` con `"moveCard": true`,
  poder 70, o 50 si es normal). Se pueden asignar a entrenadores en el editor (🃏).

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

- `dinos`: `id`, `name`, `image` (tarjeta completa), `card` (miniatura del frente en `cards/`), `element`,
  `stats` y `frontSide: "right"` si el frente de la carta está en la mitad derecha (las especiales).
- `stats`: estadísticas base `[salud, ataque, defensa]` de 0 a 10. Mínimo 4 y máximo según el
  `statCaps` de su elemento; no hay dos dinos con la misma combinación. En el juego valen
  base x nivel (nivel 50 con base 10 = 500). El script asigna stats solo a los dinos que no tengan
  unas válidas, así que puedes editarlas a mano.
- `attacks`: `id`, `name`, `element` y `power`. Agrega aquí nuevos ataques y aparecerán en el editor.
- `elements`: nombre, icono y color de cada elemento (según el reverso de la carta).
- `typeChart`: tabla de tipos. `beats` indica a qué elementos es eficaz cada uno (daño x`effective`),
  `alwaysEffective` los que siempre son eficaces (especial). El resto, incluido normal, es neutro.

Al añadir cartas nuevas:
1. Copia el `.jpg` en la carpeta de su tipo (por ejemplo `fuego/`).
2. Ejecuta `./generar_cartas.sh` (o `python actualizar_catalogo.py`). Detecta si es dino o
   movimiento, crea la miniatura en `cards/<tipo>/` y actualiza `dinos.json` conservando
   los nombres, ids y poderes que ya hayas editado a mano.
