/**
 * Pino Bonsái — tronco sinuoso en S con almohadillas planas de agujas a distintas alturas.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_e97u9le97u9le97u.png
 * Medidas aprox.: 4,3 m de ancho × 4,6 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) guiada por la ilustración original:
 *       • Tronco y ramas con corteza de cedro/pino cálida, estrías verticales de corteza y musgo basal.
 *       • Almohadillas de agujas con degradado tricolor (sombra profunda inferior, verde pino vibrante
 *         en el cuerpo y reflejos dorados/oliva soleados en la cúpula).
 *   - Esqueleto articulado de 12 huesos con deformación suave de tronco (M.pielConHuesos).
 *   - Animaciones orgánicas de viento (Brisa Suave, Viento Fuerte, Reposo Zen).
 */
registrarMalla({
  id: 'pino_bonsai',
  categoria: 'arboles',
  nombre: 'Pino Bonsái',
  icono: '🌲',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_e97u9le97u9le97u.png',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;

    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES PARA EL VIENTO ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['Tronco1', 'Raiz', 0.08, 0.70, 0.02],
      ['Tronco2', 'Tronco1', 0.16, 1.40, 0.06],
      ['Tronco3', 'Tronco2', 0.04, 2.10, 0.10],
      ['Tronco4', 'Tronco3', -0.10, 2.80, 0.05],
      ['Tronco5', 'Tronco4', -0.04, 3.50, 0.00],
      ['CopaApex', 'Tronco5', -0.16, 4.15, -0.02],

      // Huesos de las ramas maestras para el vaivén elástico del follaje
      ['RamaBajaDer', 'Tronco2', 1.20, 1.70, 0.25],   // Almohadilla 6 (baja derecha)
      ['RamaFrontal', 'Tronco3', -0.45, 2.20, 0.50],   // Almohadilla 5 (pequeña frontal)
      ['RamaGranIzq', 'Tronco3', -1.30, 2.70, -0.15],  // Almohadilla 3 (gran izquierda)
      ['RamaMediaDer', 'Tronco4', 0.90, 2.75, -0.35],  // Almohadilla 4 (media derecha)
      ['RamaAltaDer', 'Tronco5', 0.80, 3.45, 0.30]     // Almohadilla 2 (superior derecha)
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

    // ---------------- 2. TRONCO SINUOSO CON PIEL DEFORMABLE ----------------
    const ejeTronco = [
      [0, 0, 0],
      [0.08, 0.7, 0.02],
      [0.16, 1.4, 0.06],
      [0.04, 2.1, 0.1],
      [-0.1, 2.8, 0.05],
      [-0.04, 3.5, 0],
      [-0.16, 4.15, -0.02]
    ];
    const curvaTronco = M.curva(ejeTronco);
    const tronco = M.tubo(ejeTronco, 0.2, 0.05, {
      ensanche: 0.8, segLargo: 18, segRadio: 10, nombre: 'TroncoSinuoso',
      ruido: (t, a) => 1 + 0.07 * Math.sin(a * 5 + t * 9)
    });
    g.add(tronco);

    // Rigging del tronco por altura Y
    const TRAMOS_TRONCO = [
      [0.0, 'Raiz'],
      [0.7, 'Tronco1'],
      [1.4, 'Tronco2'],
      [2.1, 'Tronco3'],
      [2.8, 'Tronco4'],
      [3.5, 'Tronco5'],
      [4.15, 'CopaApex']
    ];

    M.pielConHuesos(tronco, g, (i, x, y, z) => {
      let k = 0;
      while (k + 1 < TRAMOS_TRONCO.length && y >= TRAMOS_TRONCO[k + 1][0]) k++;
      const res = [[hueso[TRAMOS_TRONCO[k][1]], 1]];
      if (k + 1 < TRAMOS_TRONCO.length) {
        const w = suave(-0.35, 0.35, y - TRAMOS_TRONCO[k + 1][0]);
        if (w > 0) { res[0][1] = 1 - w; res.push([hueso[TRAMOS_TRONCO[k + 1][1]], w]); }
      }
      return res;
    });

    // ---------------- 3. ALMOHADILLAS DE AGUJAS Y RAMAS ----------------
    const almohadillas = [
      // x,    y,    z,     rx,   ry,   rz,   huesoAsociado
      [-0.2, 4.15, 0.0, 0.95, 0.5, 0.8, 'CopaApex'],       // 0: copa superior
      [0.8, 3.45, 0.3, 0.8, 0.42, 0.62, 'RamaAltaDer'],    // 1: superior derecha
      [-1.3, 2.7, -0.15, 1.05, 0.44, 0.75, 'RamaGranIzq'], // 2: gran rama izquierda
      [0.9, 2.75, -0.35, 0.85, 0.42, 0.68, 'RamaMediaDer'],// 3: media derecha
      [-0.45, 2.2, 0.5, 0.5, 0.3, 0.44, 'RamaFrontal'],    // 4: pequeña junto al tronco
      [1.2, 1.7, 0.25, 1.1, 0.46, 0.82, 'RamaBajaDer']     // 5: gran rama baja derecha
    ];

    almohadillas.forEach(([x, y, z, rx, ry, rz, hNom], i) => {
      if (i > 0) {
        const ini = M.puntoEnAltura(curvaTronco, y - 0.35);
        const fin = [x * 0.75, y - 0.08, z * 0.75];
        const medio = [(ini.x + fin[0]) / 2, (ini.y + fin[1]) / 2 + 0.15, (ini.z + fin[2]) / 2];
        const rama = M.tubo([ini, medio, fin], 0.075, 0.03, { segLargo: 8, segRadio: 7, nombre: `Rama_${i}` });
        colgar(hNom, rama);
      }
      const copa = M.copa(x, y, z, {
        rx, ry, rz, lobulos: 7, amp: 0.09, base: 0.5, segW: 18, segH: 10,
        semilla: 11 + i, nombre: `AlmohadillaAgujas_${i + 1}`
      });
      colgar(hNom, copa);
    });

    // ---------------- 4. PINTURA PROCEDURAL BASADA EN LA ILUSTRACIÓN ----------------
    // Tronco: corteza de cedro/pino envejecida con estrías y musgo basal
    M.pintar(tronco, (i, p) => {
      const v = p.y;
      const ang = Math.atan2(p.z, p.x);
      const estria = 0.5 + 0.5 * Math.sin(ang * 8 + v * 12);
      const c = new THREE.Color(0x544234);
      c.lerp(new THREE.Color(0x382b22), estria * 0.42);
      c.lerp(new THREE.Color(0x765f4c), (1 - estria) * 0.35);
      if (v < 0.85) {
        const musgo = Math.pow(1 - v / 0.85, 1.4) * 0.65;
        c.lerp(new THREE.Color(0x425430), musgo);
      }
      return c;
    }, g);

    // Pintar ramas y almohadillas de agujas de pino
    almohadillas.forEach(([x, y, z, rx, ry, rz], i) => {
      const meshCopa = g.getObjectByName(`AlmohadillaAgujas_${i + 1}`);
      if (meshCopa) {
        M.pintar(meshCopa, (idx, p) => {
          const ny = (p.y - y) / ry; // -1 en la base, +1 en la cumbre
          const c = new THREE.Color(0x3e6532);
          if (ny < -0.1) {
            // Sombra inferior densa de aguja de pino
            c.lerp(new THREE.Color(0x1c321b), Math.min(1, Math.abs(ny + 0.1) * 0.88));
          } else {
            // Reflejos solares dorados y verde oliva en la cúpula
            const factorLuz = Math.pow(Math.max(0, ny), 1.1);
            c.lerp(new THREE.Color(0x82aa4a), Math.min(1, factorLuz * 0.94));
          }
          const ang = Math.atan2(p.z - z, p.x - x);
          const ondulacion = 0.5 + 0.5 * Math.sin(ang * 7);
          c.offsetHSL(0, (ondulacion - 0.5) * 0.05, (ondulacion - 0.5) * 0.04);
          return c;
        }, g);
      }

      if (i > 0) {
        const meshRama = g.getObjectByName(`Rama_${i}`);
        if (meshRama) {
          M.pintar(meshRama, (idx, p) => {
            const c = new THREE.Color(0x4e3c2f);
            c.lerp(new THREE.Color(0x36281e), 0.35);
            return c;
          }, g);
        }
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

    // Brisa Suave: vaivén tranquilo y zen del tronco y las nubes de agujas
    const dB = 4.8;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('Tronco1', dB, (t) => [0.35 * sen(t), 0, 0.25 * cos(t)]),
      giro('Tronco2', dB, (t) => [0.75 * sen(t), 0, 0.55 * cos(t)]),
      giro('Tronco3', dB, (t) => [1.25 * sen(t), 0, 0.85 * cos(t)]),
      giro('Tronco4', dB, (t) => [1.75 * sen(t), 0, 1.15 * cos(t)]),
      giro('Tronco5', dB, (t) => [2.20 * sen(t), 0, 1.45 * cos(t)]),
      giro('CopaApex', dB, (t) => [2.60 * sen(t), 0.7 * sen(t, 2), 1.80 * cos(t)]),

      giro('RamaBajaDer', dB, (t) => [1.20 * sen(t), 0, 1.70 * cos(t)]),
      giro('RamaFrontal', dB, (t) => [1.50 * cos(t), 0, -1.20 * sen(t)]),
      giro('RamaGranIzq', dB, (t) => [-1.40 * sen(t), 0, -1.90 * cos(t)]),
      giro('RamaMediaDer', dB, (t) => [1.50 * sen(t), 0, 2.10 * cos(t)]),
      giro('RamaAltaDer', dB, (t) => [1.80 * sen(t), 0, 2.40 * cos(t)])
    ]);

    // Viento Fuerte: ráfagas de montaña que doblan el bonsái con recuperación elástica
    const dV = 3.2;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('Tronco1', dV, (t) => [0.90 * sen(t), 0, 0.70 * sen(t)]),
      giro('Tronco2', dV, (t) => [2.10 * sen(t), 0, 1.50 * sen(t)]),
      giro('Tronco3', dV, (t) => [3.40 * sen(t), 0, 2.30 * sen(t)]),
      giro('Tronco4', dV, (t) => [4.60 * sen(t), 0, 3.10 * sen(t)]),
      giro('Tronco5', dV, (t) => [5.80 * sen(t), 0, 3.80 * sen(t)]),
      giro('CopaApex', dV, (t) => [7.00 * sen(t), 1.8 * sen(t, 2), 4.60 * sen(t)]),

      giro('RamaBajaDer', dV, (t) => [2.80 * sen(t), 0, 4.20 * sen(t)]),
      giro('RamaFrontal', dV, (t) => [3.50 * cos(t), 0, -2.80 * sen(t)]),
      giro('RamaGranIzq', dV, (t) => [-3.20 * sen(t), 0, -4.80 * sen(t)]),
      giro('RamaMediaDer', dV, (t) => [3.80 * sen(t), 0, 5.20 * sen(t)]),
      giro('RamaAltaDer', dV, (t) => [4.40 * sen(t), 0, 5.80 * sen(t)])
    ]);

    // Reposo: sutil presencia viva casi estática, ideal para jardines zen
    const dR = 6.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('Tronco1', dR, (t) => [0.15 * sen(t), 0, 0.10 * cos(t)]),
      giro('Tronco2', dR, (t) => [0.30 * sen(t), 0, 0.20 * cos(t)]),
      giro('Tronco3', dR, (t) => [0.50 * sen(t), 0, 0.35 * cos(t)]),
      giro('Tronco4', dR, (t) => [0.70 * sen(t), 0, 0.50 * cos(t)]),
      giro('Tronco5', dR, (t) => [0.90 * sen(t), 0, 0.65 * cos(t)]),
      giro('CopaApex', dR, (t) => [1.10 * sen(t), 0.3 * sen(t), 0.80 * cos(t)]),

      giro('RamaBajaDer', dR, (t) => [0.50 * sen(t), 0, 0.70 * cos(t)]),
      giro('RamaFrontal', dR, (t) => [0.60 * cos(t), 0, -0.50 * sen(t)]),
      giro('RamaGranIzq', dR, (t) => [-0.55 * sen(t), 0, -0.75 * cos(t)]),
      giro('RamaMediaDer', dR, (t) => [0.60 * sen(t), 0, 0.85 * cos(t)]),
      giro('RamaAltaDer', dR, (t) => [0.70 * sen(t), 0, 0.95 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
