# Biblioteca de mallas 3D

Modelos 3D procedurales (hechos por código) para el World Builder, con el mismo estilo que
las piezas del estudio: **arcilla (clay) + wireframe de quads limpio**.

- Escala: **1 unidad = 1 metro**.
- Cada malla vive en su propio archivo `.js` dentro de la carpeta de su categoría.
- `catalogo.json` es la lista que el World Builder lee para cargarlas.
- `_comun.js` tiene las herramientas compartidas (troncos, follaje, rocas, cortes…).

## Estructura

```text
mallas/
├── biblioteca.js          plugin del editor: carga el catálogo, panel, vitrina, guardar/cargar
├── _comun.js              herramientas compartidas (window.MallasComun)
├── catalogo.json          lista de mallas que carga el World Builder
├── arboles/   pino_bonsai.js · roble.js · abedul.js · …
├── piedras/   cumulo_rocas.js · penasco.js · …
├── troncos/   troncos_caidos.js · tronco_hueco.js
├── plantas/   mata_hierba.js
├── personajes/ alvin.js · beatriz.js · blanche.js · cross.js · …
└── mini dino/  amargasaurus.js · ampelosaurus.js · …   (dinos chibi)
```

## Cómo verlas

- Panel izquierdo → **📚 Biblioteca de Mallas**: clic = añadir a la escena, doble clic = verla sola,
  o **Ver todas las mallas** (vitrina).
- Enlaces directos: `http://localhost:8086/#vitrina`, `http://localhost:8086/#malla=roble`
  y, como en una hoja de personaje, `#malla=alvin&vista=frente` (o `lado`, `espalda`).
- Se guardan y cargan con los diseños (`moduleType: "malla"`, `params.id`) y salen en la exportación .OBJ.

## Personajes con esqueleto

Un personaje puede traer huesos (`THREE.Bone`) con sus piezas colgadas de ellos y clips de animación en
`grupo.animations`. En la vista individual aparecen entonces los botones **🦴 Esqueleto**, **Quieto** y uno
por animación. Enlace directo: `#malla=alvin&anim=Caminar&huesos`.

```js
const alvin = BibliotecaMallas.construir('alvin');
alvin.getObjectByName('HuesoBrazoI').rotation.z = 1.2;           // posar a mano
const mixer = new THREE.AnimationMixer(alvin);                    // o animar
mixer.clipAction(THREE.AnimationClip.findByName(alvin.animations, 'Caminar')).play();
// en el bucle: mixer.update(delta)
```

`biblioteca.js` es un plugin independiente: no modifica `app.js`. `index.html` solo lo carga
después de `app.js` (bloque "Biblioteca de mallas" al final del archivo).

## Patrón para añadir una malla nueva

1. Crea `mallas/<categoria>/<id>.js`:

```js
registrarMalla({
  id: 'mi_arbol',                 // único, igual que el nombre del archivo
  categoria: 'arboles',
  nombre: 'Mi Árbol',
  icono: '🌳',
  origen: 'assets/.../imagen.png', // imagen de referencia

  construir(M) {                  // M = herramientas de _comun.js
    const g = new THREE.Group();
    g.add(M.tubo([[0, 0, 0], [0, 2, 0]], 0.2, 0.1, { nombre: 'Tronco' }));
    g.add(M.copa(0, 2.5, 0, { rx: 1, ry: 0.8, semilla: 1, nombre: 'Copa' }));
    return g;                     // apoyada en el suelo (y = 0), centrada en el origen
  }
});
```

2. Añádela a `catalogo.json` (`id`, `categoria`, `archivo`, `imagen`).
3. Recarga el World Builder.

### Herramientas de `M` (`_comun.js`)

| Herramienta | Para qué |
| --- | --- |
| `M.tubo(puntos, r0, r1, opts)` | Troncos, ramas y raíces cónicos a lo largo de una curva |
| `M.copa(x, y, z, opts)` | Follaje con lóbulos (copas, almohadillas, racimos) |
| `M.roca(x, z, opts)` | Roca tallada con caras planas, apoyada en el suelo |
| `M.guijarros(grupo, lista)` | Piedrecitas sueltas |
| `M.cilindroTumbado(radio, largo, opts)` | Tronco caído (eje X), con astillas opcionales |
| `M.anillos(rIn, rOut, x, opts)` | Corte de tronco con anillos de crecimiento |
| `M.recortar(malla, quitar)` | Abre huecos (aberturas, nudos) sin romper el wireframe |
| `M.hoja(...)` | Hoja de hierba afilada y arqueada |
| `M.hongo(x, y, z, tam)` | Hongo pequeño |
| `M.azar(semilla)` | Aleatorio con semilla: la malla sale siempre igual |
| `M.pielConHuesos(malla, raiz, pesos)` | Piel que se dobla suave con los huesos (cuellos y colas largos); el wireframe la sigue |
| `M.coserNormales(malla)` | Quita la línea de sombreado en la costura de una rejilla cerrada |

## Imágenes convertidas

Fuente: `assets/arboles/imagenes/`

| Imagen | Malla |
| --- | --- |
| `…e97u9le9….png` | `arboles/pino_bonsai` |
| `…j6w315j6….png` | `arboles/roble` |
| `…n5ti47n5….png` | `arboles/abedul` |
| `…e35u1fe3….png` | `piedras/cumulo_rocas` |
| `…y35gq1y3….png` | `piedras/penasco` |
| `…54ntb054….png` | `troncos/troncos_caidos` |
| `…fquohmfq….png` | `troncos/tronco_hueco` |
| `…b2rf1db2….png` | `plantas/mata_hierba` |

Repetidas (no se crearon): `…wj7ga3wj….png` = cúmulo de rocas en color oscuro;
`…xvjtvkxv….png` = el mismo tronco hueco.
