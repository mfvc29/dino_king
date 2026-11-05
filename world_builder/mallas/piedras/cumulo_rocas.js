/**
 * Cúmulo de Rocas — una laja alta al fondo, rocas angulosas a su alrededor y guijarros sueltos.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_e35u1fe35u1fe35u.png
 * (La imagen Gemini_Generated_Image_wj7ga3wj7ga3wj7g.png es la misma forma en roca oscura: no se duplica.)
 * Medidas aprox.: 3,6 m de ancho × 2,3 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice facetada (M.pintar) con paleta extraída de la ilustración original:
 *       • Rocas con estratificación sedimentaria horizontal, tonos caliza y granito intemperizado.
 *       • Caras planas superiores iluminadas por el sol con reflejos cálidos y aristas nítidas.
 *       • Hendiduras y sombras basales en penumbra de suelo húmedo.
 *       • Líquenes alpinos y guijarros con diversidad mineral.
 *   - Esqueleto articulado con THREE.Bone para los bloques de roca y guijarros.
 *   - Animaciones geológicas y temáticas de dinosaurios ('Pisada Dino', 'Temblor Sísmico', 'Reposo').
 */
registrarMalla({
  id: 'cumulo_rocas',
  categoria: 'piedras',
  nombre: 'Cúmulo de Rocas',
  icono: '🪨',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_e35u1fe35u1fe35u.png',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const C = (hex) => new THREE.Color(hex);
    const grad = Math.PI / 180;

    const mezclar = (c1, c2, t) => c1.clone().lerp(c2, Math.max(0, Math.min(1, t)));
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],

      // Huesos para responder a temblores y pisadas de dinosaurios
      ['BloqueCentral', 'Raiz', 0.35, 1.15, -0.35],
      ['LajaPunta', 'BloqueCentral', 0.35, 2.30, -0.35],
      ['RocaIzq', 'Raiz', -0.70, 0.80, -0.15],
      ['RocaDer', 'Raiz', 1.30, 0.65, 0.05],
      ['BloquesFrontales', 'Raiz', 0.20, 0.35, 0.65],
      ['GuijarrosFront', 'Raiz', 0.00, 0.10, 1.10]
    ];

    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = 'Hueso' + nombre;
      b.userData.reposo = V(x, y, z);
      const p = padre ? hueso[padre] : null;
      b.position.set(x, y, z).sub(p ? p.userData.reposo : V(0, 0, 0));
      (p || g).add(b);
      hueso[nombre] = b;
    });
    g.updateMatrixWorld(true);

    const colgar = (nombre, obj) => {
      const h = typeof nombre === 'string' ? hueso[nombre] : nombre;
      if (!h || !obj) return obj;
      h.attach(obj);
      return obj;
    };

    // ---------------- 2. MODELADO DE ROCAS Y GUIJARROS ----------------
    const rocas = [
      // x,     z,   ancho, alto, fondo, inclin, giro, dureza, cortes, semilla, nombre, huesoPadre
      [0.35, -0.35, 1.25, 2.30, 0.95, 0.10, 0.30, 0.50, 14, 31, 'LajaAltaCentral', 'BloqueCentral'],
      [-0.70, -0.15, 1.05, 1.65, 0.90, -0.12, -0.40, 0.52, 13, 32, 'RocaIzquierda', 'RocaIzq'],
      [1.30, 0.05, 0.80, 1.30, 0.75, -0.15, 0.80, 0.50, 12, 33, 'RocaDerecha', 'RocaDer'],
      [-0.20, 0.60, 1.05, 0.75, 0.85, 0.05, 0.20, 0.55, 11, 34, 'BloquePlanoFrontal', 'BloquesFrontales'],
      [0.80, 0.75, 0.95, 0.65, 0.80, -0.08, -0.50, 0.55, 11, 35, 'BloqueFrontalDerecho', 'BloquesFrontales'],
      [0.15, 0.25, 0.55, 0.60, 0.50, 0.10, 1.10, 0.52, 10, 36, 'RocaMediaCentro', 'BloqueCentral'],
      [-1.40, 0.45, 0.70, 0.70, 0.65, 0.12, 0.60, 0.55, 10, 37, 'RocaBajaIzquierda', 'RocaIzq'],
      [-1.00, 0.85, 0.45, 0.40, 0.42, 0.00, 0.30, 0.56, 9, 38, 'RocaPequenaIzquierda', 'RocaIzq']
    ];

    const mallasRocas = [];
    rocas.forEach(([x, z, ancho, alto, fondo, inclinacion, giro, dureza, cortes, semilla, nombre, hPadre]) => {
      const malla = M.roca(x, z, { ancho, alto, fondo, inclinacion, giro, dureza, cortes, semilla, nombre });
      colgar(hPadre, malla);
      mallasRocas.push(malla);
    });

    const listaGuijarros = [
      [-1.75, 0.90, 0.20], [-1.20, 1.15, 0.14], [-0.50, 1.25, 0.18], [0.05, 1.30, 0.12],
      [0.55, 1.35, 0.16], [1.45, 1.00, 0.15], [1.75, 0.70, 0.12]
    ];
    const grupoGuijarros = new THREE.Group();
    grupoGuijarros.name = 'GrupoGuijarros';
    M.guijarros(grupoGuijarros, listaGuijarros, 60);
    colgar('GuijarrosFront', grupoGuijarros);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA FACETADA POR VÉRTICE (M.pintar) ----------------
    // Paleta fiel a Gemini_Generated_Image_e35u1fe35u1fe35u.png
    const COL_ROCA_SOMBRA = C(0x34322c);  // Sombra profunda de grietas y base de tierra
    const COL_ROCA_BASE = C(0x726e63);    // Tono granito/caliza neutro
    const COL_ROCA_MEDIA = C(0x8e897c);   // Roca media con pátina
    const COL_ROCA_CLARA = C(0xb6ae9f);   // Caras iluminadas por la luz del día
    const COL_ROCA_SOL = C(0xd0c7b6);     // Aristas y planos superiores reflectantes
    const COL_LIQUEN = C(0x828e78);       // Líquen seco gris-verdoso en cornisas

    mallasRocas.forEach((malla) => {
      M.pintar(malla, (i, p) => {
        // Estratificación horizontal
        const estrato = 0.5 + 0.5 * Math.sin(p.y * 14 + p.x * 3.5);
        const grano = Math.sin(p.x * 28 + p.z * 22);

        let col = mezclar(COL_ROCA_BASE, COL_ROCA_MEDIA, estrato);
        col = mezclar(col, COL_ROCA_SOMBRA, suave(0.4, -0.05, p.y)); // Sombra de contacto con el suelo

        // Iluminación cenital en caras superiores
        const factorLuz = suave(0.5, 2.3, p.y);
        col = mezclar(col, COL_ROCA_CLARA, factorLuz * 0.75);
        if (p.y > 1.8 && grano > 0.2) col = mezclar(col, COL_ROCA_SOL, 0.6);

        // Líquen en repisas horizontales
        if (p.y > 0.3 && p.y < 1.6 && estrato > 0.75) {
          col = mezclar(col, COL_LIQUEN, 0.45);
        }

        return col;
      }, g);
    });

    grupoGuijarros.traverse((o) => {
      if (!o.isMesh) return;
      M.pintar(o, (i, p) => {
        const veta = Math.sin(p.x * 30 + p.z * 25);
        let col = mezclar(COL_ROCA_BASE, COL_ROCA_CLARA, 0.5 + 0.5 * veta);
        col = mezclar(col, COL_ROCA_SOMBRA, suave(0.08, -0.03, p.y));
        return col;
      }, g);
    });

    // ---------------- 4. ANIMACIONES SÍSMICAS Y DE DINOSAURIOS ----------------
    function giro(nombre, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler(0, 0, 0, 'YXZ');
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set(x * grad, y * grad, z * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombre}.quaternion`, tiempos, valores);
    }

    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Pisada Dino: sacudida violenta que decae al pisar un dinosaurio gigante cercano
    const dP = 1.8;
    const decae = (t) => Math.exp(-3.5 * t);
    const pisada = new THREE.AnimationClip('Pisada Dino', dP, [
      giro('BloqueCentral', dP, (t) => [3.2 * sen(t, 4) * decae(t), 0, 1.8 * cos(t, 4) * decae(t)]),
      giro('LajaPunta', dP, (t) => [5.5 * sen(t, 4) * decae(t), 0, 3.2 * cos(t, 4) * decae(t)]),
      giro('RocaIzq', dP, (t) => [-2.8 * cos(t, 4) * decae(t), 0, -2.2 * sen(t, 4) * decae(t)]),
      giro('RocaDer', dP, (t) => [2.5 * sen(t, 4) * decae(t), 0, 2.0 * cos(t, 4) * decae(t)]),
      giro('BloquesFrontales', dP, (t) => [1.8 * sen(t, 5) * decae(t), 0, 1.4 * cos(t, 5) * decae(t)]),
      giro('GuijarrosFront', dP, (t) => [4.0 * sen(t, 6) * decae(t), 0, 3.5 * cos(t, 6) * decae(t)])
    ]);

    // Temblor Sísmico: vibración rítmica y profunda del terreno
    const dT = 2.4;
    const temblor = new THREE.AnimationClip('Temblor Sísmico', dT, [
      giro('BloqueCentral', dT, (t) => [0.9 * sen(t, 6), 0, 0.6 * cos(t, 6)]),
      giro('LajaPunta', dT, (t) => [1.6 * sen(t, 6), 0, 1.1 * cos(t, 6)]),
      giro('RocaIzq', dT, (t) => [-0.8 * cos(t, 6), 0, -0.7 * sen(t, 6)]),
      giro('RocaDer', dT, (t) => [0.8 * sen(t, 6), 0, 0.6 * cos(t, 6)]),
      giro('BloquesFrontales', dT, (t) => [0.6 * sen(t, 8), 0, 0.5 * cos(t, 8)]),
      giro('GuijarrosFront', dT, (t) => [1.5 * sen(t, 8), 0, 1.2 * cos(t, 8)])
    ]);

    // Reposo: masa pétrea quieta y sólida
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('BloqueCentral', dR, (t) => [0.08 * sen(t), 0, 0.05 * cos(t)]),
      giro('LajaPunta', dR, (t) => [0.12 * sen(t), 0, 0.08 * cos(t)]),
      giro('RocaIzq', dR, (t) => [-0.06 * cos(t), 0, -0.05 * sen(t)]),
      giro('RocaDer', dR, (t) => [0.06 * sen(t), 0, 0.05 * cos(t)]),
      giro('BloquesFrontales', dR, (t) => [0.04 * sen(t), 0, 0.03 * cos(t)]),
      giro('GuijarrosFront', dR, (t) => [0.08 * sen(t), 0, 0.06 * cos(t)])
    ]);

    g.animations = [pisada, temblor, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
