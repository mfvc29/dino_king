/**
 * Roble Frondoso — tronco grueso y nudoso con raíces, ramas maestras abiertas y copa ancha en cúpula.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_j6w315j6w315j6w3.png
 * Medidas aprox.: 6,8 m de ancho × 5,4 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) guiada por la ilustración oficial:
 *       • Tronco nudoso y raíces con corteza de roble profundo, fisuras oscuras y musgo basal.
 *       • Ramas maestras leñosas y nudadas.
 *       • Gran cúpula de 15 racimos con degradado de luz solar (sombra inferior, verde roble frondoso
 *         y copas doradas/oliva).
 *   - Esqueleto articulado de 12 huesos con deformación suave de tronco (M.pielConHuesos)
 *     y oscilación independiente de las ramas maestras.
 *   - Animaciones orgánicas de viento (Brisa Suave, Viento Fuerte, Reposo Zen).
 */
registrarMalla({
  id: 'roble',
  categoria: 'arboles',
  nombre: 'Roble Frondoso',
  icono: '🌳',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_j6w315j6w315j6w3.png',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;

    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const nudoso = (t, a) => 1 + 0.09 * Math.sin(a * 6 + t * 4) + 0.05 * Math.sin(a * 11);

    // ---------------- 1. ESQUELETO Y RIGGING ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['TroncoBajo', 'Raiz', 0.05, 0.70, 0.00],
      ['TroncoMedio', 'TroncoBajo', -0.05, 1.40, 0.05],
      ['CruzTronco', 'TroncoMedio', 0.00, 2.15, 0.00],

      ['Rama1', 'CruzTronco', -2.8, 1.85, 0.4],  // baja izquierda
      ['Rama2', 'CruzTronco', -1.3, 3.50, 0.3],  // alta izquierda
      ['Rama3', 'CruzTronco', 0.0, 4.20, -0.2],  // central alta
      ['Rama4', 'CruzTronco', 1.1, 3.90, -0.3],  // alta derecha
      ['Rama5', 'CruzTronco', 2.7, 3.20, -0.2],  // derecha media
      ['Rama6', 'CruzTronco', 2.9, 1.85, 0.3],   // baja derecha
      ['Rama7', 'CruzTronco', 0.2, 3.40, -1.2],  // trasera
      ['Rama8', 'CruzTronco', 0.0, 3.50, 1.1]    // delantera
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

    // ---------------- 2. TRONCO PRINCIPAL Y PIEL ----------------
    const tronco = M.tubo([[0, 0, 0], [0.05, 0.7, 0], [-0.05, 1.4, 0.05], [0, 2.15, 0]], 0.5, 0.4, {
      ensanche: 0.9, segLargo: 10, segRadio: 16, ruido: nudoso, nombre: 'TroncoNudoso'
    });
    g.add(tronco);

    const TRAMOS_ROBLE = [
      [0.0, 'Raiz'],
      [0.7, 'TroncoBajo'],
      [1.4, 'TroncoMedio'],
      [2.15, 'CruzTronco']
    ];
    M.pielConHuesos(tronco, g, (i, x, y, z) => {
      let k = 0;
      while (k + 1 < TRAMOS_ROBLE.length && y >= TRAMOS_ROBLE[k + 1][0]) k++;
      const res = [[hueso[TRAMOS_ROBLE[k][1]], 1]];
      if (k + 1 < TRAMOS_ROBLE.length) {
        const w = suave(-0.4, 0.4, y - TRAMOS_ROBLE[k + 1][0]);
        if (w > 0) { res[0][1] = 1 - w; res.push([hueso[TRAMOS_ROBLE[k + 1][1]], w]); }
      }
      return res;
    });

    // Raíces superficiales
    for (let k = 0; k < 5; k++) {
      const a = k * (Math.PI * 2 / 5) + 0.3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const raiz = M.tubo([[0.25 * c, 0.45, 0.25 * s], [0.65 * c, 0.14, 0.65 * s], [1.1 * c, -0.04, 1.1 * s]], 0.2, 0.05, {
        segLargo: 6, segRadio: 7, nombre: `Raiz_${k + 1}`
      });
      colgar('Raiz', raiz);
    }

    // ---------------- 3. RAMAS MAESTRAS Y RACIMOS DE HOJAS ----------------
    const ramas = [
      { p: [[-0.1, 1.9, 0], [-0.9, 2.2, 0.1], [-2.0, 2.2, 0.3], [-2.8, 1.85, 0.4]], r: [0.22, 0.05], h: 'Rama1' },
      { p: [[-0.1, 2.1, 0], [-0.7, 2.9, 0.2], [-1.3, 3.5, 0.3]], r: [0.24, 0.06], h: 'Rama2' },
      { p: [[0, 2.2, 0], [-0.2, 3.2, -0.3], [0, 4.2, -0.2]], r: [0.26, 0.07], h: 'Rama3' },
      { p: [[0.1, 2.1, 0], [0.6, 3.0, 0.2], [1.1, 3.9, -0.3]], r: [0.24, 0.06], h: 'Rama4' },
      { p: [[0.15, 1.95, 0], [1.0, 2.4, 0], [2.0, 2.9, -0.2], [2.7, 3.2, -0.2]], r: [0.22, 0.05], h: 'Rama5' },
      { p: [[0.1, 1.8, 0], [1.2, 1.9, 0.3], [2.2, 1.75, 0.4], [2.9, 1.85, 0.3]], r: [0.18, 0.04], h: 'Rama6' },
      { p: [[0, 2.0, -0.1], [0.1, 2.8, -0.9], [0.2, 3.4, -1.2]], r: [0.2, 0.05], h: 'Rama7' },
      { p: [[0, 2.0, 0.1], [-0.1, 2.8, 0.9], [0, 3.5, 1.1]], r: [0.2, 0.05], h: 'Rama8' }
    ];
    ramas.forEach((rama, i) => {
      const rMesh = M.tubo(rama.p, rama.r[0], rama.r[1], {
        segLargo: 10, segRadio: 9, ruido: nudoso, nombre: `RamaMaestra_${i + 1}`
      });
      colgar(rama.h, rMesh);
    });

    const racimos = [
      // x,    y,    z,    radio, hueso
      [0, 4.5, 0, 1.1, 'Rama3'],
      [-1.0, 4.15, 0.5, 0.95, 'Rama2'],
      [1.1, 4.15, -0.4, 1.0, 'Rama4'],
      [0, 3.9, -1.1, 0.95, 'Rama7'],
      [0, 3.75, 1.1, 0.9, 'Rama8'],
      [-2.05, 3.4, 0.2, 0.9, 'Rama2'],
      [2.05, 3.5, -0.2, 0.95, 'Rama5'],
      [-1.15, 3.1, -1.0, 0.85, 'Rama7'],
      [1.25, 3.0, 1.0, 0.85, 'Rama8'],
      [-2.7, 2.5, 0, 0.8, 'Rama1'],
      [2.7, 2.6, 0.3, 0.85, 'Rama5'],
      [-2.35, 1.65, 0.4, 0.7, 'Rama1'],
      [2.2, 1.7, -0.3, 0.65, 'Rama6'],
      [-1.35, 2.35, 1.0, 0.6, 'Rama1'],
      [1.35, 2.2, -1.0, 0.6, 'Rama6']
    ];
    racimos.forEach(([x, y, z, r, hNom], i) => {
      const copa = M.copa(x, y, z, {
        rx: r, ry: r * 0.72, rz: r, lobulos: 5, amp: 0.15, base: 0.6, segW: 16, segH: 10,
        semilla: 40 + i, nombre: `RacimoHojas_${i + 1}`
      });
      colgar(hNom, copa);
    });

    // ---------------- 4. PINTURA PROCEDURAL BASADA EN GEMINI_GENERATED_IMAGE_J6W315 ----------------
    // Tronco nudoso y raíces: corteza de roble curtido con fisuras y musgo
    M.pintar(tronco, (i, p) => {
      const v = p.y;
      const ang = Math.atan2(p.z, p.x);
      const estria = 0.5 + 0.5 * Math.sin(ang * 10 + v * 8);
      const c = new THREE.Color(0x564232);
      c.lerp(new THREE.Color(0x342418), estria * 0.45);
      c.lerp(new THREE.Color(0x76604c), (1 - estria) * 0.35);
      if (v < 0.9) {
        const musgo = Math.pow(1 - v / 0.9, 1.3) * 0.60;
        c.lerp(new THREE.Color(0x4a5d34), musgo);
      }
      return c;
    }, g);

    for (let k = 0; k < 5; k++) {
      const rMesh = g.getObjectByName(`Raiz_${k + 1}`);
      if (rMesh) {
        M.pintar(rMesh, (idx, p) => {
          const c = new THREE.Color(0x4c3828);
          c.lerp(new THREE.Color(0x384a28), Math.max(0, 0.5 - p.y) * 0.7);
          return c;
        }, g);
      }
    }

    ramas.forEach((rama, i) => {
      const rMesh = g.getObjectByName(`RamaMaestra_${i + 1}`);
      if (rMesh) {
        M.pintar(rMesh, (idx, p) => {
          const c = new THREE.Color(0x4e3a2a);
          c.lerp(new THREE.Color(0x36261a), 0.35);
          return c;
        }, g);
      }
    });

    // Pintar los 15 racimos de hojas con degradado vertical y luz de cúpula
    racimos.forEach(([x, y, z, r], i) => {
      const meshCopa = g.getObjectByName(`RacimoHojas_${i + 1}`);
      if (meshCopa) {
        M.pintar(meshCopa, (idx, p) => {
          const ny = (p.y - y) / (r * 0.72);
          const c = new THREE.Color(0x3d662c);
          if (ny < -0.15) {
            c.lerp(new THREE.Color(0x1a3218), Math.min(1, Math.abs(ny + 0.15) * 0.88));
          } else {
            const factorLuz = Math.pow(Math.max(0, ny), 1.15);
            c.lerp(new THREE.Color(0x82aa46), Math.min(1, factorLuz * 0.94));
          }
          const ang = Math.atan2(p.z - z, p.x - x);
          const ondulacion = 0.5 + 0.5 * Math.sin(ang * 5 + i);
          c.offsetHSL(0, (ondulacion - 0.5) * 0.06, (ondulacion - 0.5) * 0.05);
          return c;
        }, g);
      }
    });

    // ---------------- 5. ANIMACIONES ORGÁNICAS DE VIENTO ----------------
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

    // Brisa Suave: movimiento majestuoso y pesado del roble centenario
    const dB = 5.0;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('TroncoBajo', dB, (t) => [0.25 * sen(t), 0, 0.20 * cos(t)]),
      giro('TroncoMedio', dB, (t) => [0.55 * sen(t), 0, 0.40 * cos(t)]),
      giro('CruzTronco', dB, (t) => [0.90 * sen(t), 0, 0.65 * cos(t)]),

      giro('Rama1', dB, (t) => [-1.4 * sen(t), 0, -1.8 * cos(t)]),
      giro('Rama2', dB, (t) => [-1.2 * sen(t), 0, 1.4 * cos(t)]),
      giro('Rama3', dB, (t) => [1.8 * sen(t), 0.5 * sen(t, 2), 1.2 * cos(t)]),
      giro('Rama4', dB, (t) => [1.2 * sen(t), 0, -1.4 * cos(t)]),
      giro('Rama5', dB, (t) => [1.5 * sen(t), 0, 1.9 * cos(t)]),
      giro('Rama6', dB, (t) => [1.3 * sen(t), 0, 1.6 * cos(t)]),
      giro('Rama7', dB, (t) => [-1.5 * cos(t), 0, 1.2 * sen(t)]),
      giro('Rama8', dB, (t) => [1.6 * cos(t), 0, -1.2 * sen(t)])
    ]);

    // Viento Fuerte: resistencia elástica de gran porte
    const dV = 3.4;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('TroncoBajo', dV, (t) => [0.70 * sen(t), 0, 0.50 * sen(t)]),
      giro('TroncoMedio', dV, (t) => [1.60 * sen(t), 0, 1.10 * sen(t)]),
      giro('CruzTronco', dV, (t) => [2.60 * sen(t), 0, 1.80 * sen(t)]),

      giro('Rama1', dV, (t) => [-3.5 * sen(t), 0, -4.2 * sen(t)]),
      giro('Rama2', dV, (t) => [-3.0 * sen(t), 0, 3.5 * sen(t)]),
      giro('Rama3', dV, (t) => [4.5 * sen(t), 1.2 * sen(t, 2), 3.0 * sen(t)]),
      giro('Rama4', dV, (t) => [3.0 * sen(t), 0, -3.5 * sen(t)]),
      giro('Rama5', dV, (t) => [3.8 * sen(t), 0, 4.6 * sen(t)]),
      giro('Rama6', dV, (t) => [3.2 * sen(t), 0, 3.8 * sen(t)]),
      giro('Rama7', dV, (t) => [-3.6 * sen(t), 0, 3.0 * sen(t)]),
      giro('Rama8', dV, (t) => [3.8 * sen(t), 0, -3.0 * sen(t)])
    ]);

    // Reposo: tranquilidad solemne
    const dR = 6.4;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('TroncoBajo', dR, (t) => [0.10 * sen(t), 0, 0.08 * cos(t)]),
      giro('TroncoMedio', dR, (t) => [0.22 * sen(t), 0, 0.16 * cos(t)]),
      giro('CruzTronco', dR, (t) => [0.38 * sen(t), 0, 0.26 * cos(t)]),

      giro('Rama1', dR, (t) => [-0.6 * sen(t), 0, -0.7 * cos(t)]),
      giro('Rama2', dR, (t) => [-0.5 * sen(t), 0, 0.6 * cos(t)]),
      giro('Rama3', dR, (t) => [0.7 * sen(t), 0, 0.5 * cos(t)]),
      giro('Rama4', dR, (t) => [0.5 * sen(t), 0, -0.6 * cos(t)]),
      giro('Rama5', dR, (t) => [0.6 * sen(t), 0, 0.7 * cos(t)]),
      giro('Rama6', dR, (t) => [0.5 * sen(t), 0, 0.6 * cos(t)]),
      giro('Rama7', dR, (t) => [-0.6 * cos(t), 0, 0.5 * sen(t)]),
      giro('Rama8', dR, (t) => [0.6 * cos(t), 0, -0.5 * sen(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
