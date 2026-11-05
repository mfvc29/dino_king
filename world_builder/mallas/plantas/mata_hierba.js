/**
 * Mata de Hierba — manojo denso de hojas largas y afiladas, rectas al centro y arqueadas hacia afuera.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_b2rf1db2rf1db2rf.png
 * Medidas aprox.: 1,6 m de ancho × 1,1 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta extraída de la ilustración original:
 *       • Cuello de raíz oscuro con tonos tierra húmeda y clorofila densa.
 *       • Cuerpo de las hojas en verde esmeralda vibrante con suaves nervaduras longitudinales.
 *       • Puntas translúcidas bañadas por el sol con degradado lima / chartreuse dorado.
 *       • Variación botánica única entre briznas para un aspecto silvestre hiperrealista.
 *   - Esqueleto radial multi-sectorial articulado (11 huesos THREE.Bone).
 *   - Deformación orgánica por piel (M.pielConHuesos) en todas las 64 briznas de hierba:
 *       • Las raíces (y = 0) permanecen firmemente fijas al suelo.
 *       • El cuerpo y las puntas se arquean, flexionan y cimbran elásticamente.
 *   - Animaciones fluidas de oleaje de viento ('Brisa Suave', 'Viento Fuerte', 'Reposo').
 */
registrarMalla({
  id: 'mata_hierba',
  categoria: 'plantas',
  nombre: 'Mata de Hierba',
  icono: '🌿',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_b2rf1db2rf1db2rf.png',

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

    // ---------------- 1. ESQUELETO Y HUESOS POR SECTORES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],

      // Núcleo central (briznas altas y verticales)
      ['CentroMedio', 'Raiz', 0.00, 0.45, 0.00],
      ['CentroPunta', 'CentroMedio', 0.00, 0.90, 0.00],

      // Sector Norte (+Z)
      ['Norte_Mid', 'Raiz', 0.00, 0.35, 0.25],
      ['Norte_Tip', 'Norte_Mid', 0.00, 0.75, 0.50],

      // Sector Sur (-Z)
      ['Sur_Mid', 'Raiz', 0.00, 0.35, -0.25],
      ['Sur_Tip', 'Sur_Mid', 0.00, 0.75, -0.50],

      // Sector Este (+X)
      ['Este_Mid', 'Raiz', 0.25, 0.35, 0.00],
      ['Este_Tip', 'Este_Mid', 0.50, 0.75, 0.00],

      // Sector Oeste (-X)
      ['Oeste_Mid', 'Raiz', -0.25, 0.35, 0.00],
      ['Oeste_Tip', 'Oeste_Mid', -0.50, 0.75, 0.00]
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

    // ---------------- 2. MODELADO, PIEL Y PINTURA DE LAS BRIZNAS ----------------
    // Paleta fiel a Gemini_Generated_Image_b2rf1db2rf1db2rf.png
    const COL_TIERRA_RAIZ = C(0x162612);    // Raíz profunda en la tierra húmeda
    const COL_VERDE_PROFUNDO = C(0x244618); // Verde oscuro base
    const COL_VERDE_MEDIO = C(0x3e7425);    // Verde prado exuberante
    const COL_VERDE_VIBRANTE = C(0x5ca032); // Verde esmeralda resplandeciente
    const COL_VERDE_SOL = C(0x8bc644);      // Verde lima iluminado por el sol
    const COL_PUNTA_DORADA = C(0xc4f268);   // Extremos soleados casi dorados

    const rnd = M.azar(21);
    const radioBase = 0.32;

    for (let i = 0; i < 64; i++) {
      const az = rnd() * Math.PI * 2;
      const rb = Math.sqrt(rnd()) * radioBase;
      const centro = 1 - rb / radioBase; // 1 en el centro, 0 en el borde
      const alto = 0.6 + centro * 0.55 + rnd() * 0.3;
      const ancho = 0.05 + rnd() * 0.035;
      const inclinacion = 0.25 + (1 - centro) * 0.6 + rnd() * 0.25;

      const bx = Math.sin(az) * rb;
      const bz = Math.cos(az) * rb;
      const giroAz = az + (rnd() - 0.5) * 0.6;

      const hoja = M.hoja(bx, bz, giroAz, alto, ancho, inclinacion, `Hoja_${i + 1}`);
      g.add(hoja);

      // Asignar los huesos rectores según la orientación radial de la brizna
      let hMid = hueso.CentroMedio;
      let hTip = hueso.CentroPunta;
      if (rb > 0.08) {
        const cosA = Math.cos(az);
        const sinA = Math.sin(az);
        if (Math.abs(sinA) > Math.abs(cosA)) {
          if (sinA > 0) { hMid = hueso.Este_Mid; hTip = hueso.Este_Tip; }
          else { hMid = hueso.Oeste_Mid; hTip = hueso.Oeste_Tip; }
        } else {
          if (cosA > 0) { hMid = hueso.Norte_Mid; hTip = hueso.Norte_Tip; }
          else { hMid = hueso.Sur_Mid; hTip = hueso.Sur_Tip; }
        }
      }

      // Rigging con deformación elástica por piel (M.pielConHuesos)
      M.pielConHuesos(hoja, g, (idx, x, y, z) => {
        const t = Math.min(1, Math.max(0, y / alto));
        if (t < 0.15) return [[hueso.Raiz, 1]];
        if (t < 0.55) {
          const k = (t - 0.15) / 0.40;
          return [[hueso.Raiz, 1 - k], [hMid, k]];
        }
        const k = (t - 0.55) / 0.45;
        return [[hMid, 1 - k], [hTip, k]];
      });

      // Pintar cada brizna con degradado multicapa y variación silvestre
      const matizRnd = (rnd() - 0.5) * 0.08;
      M.pintar(hoja, (idx, p) => {
        const t = Math.min(1, Math.max(0, p.y / alto));
        let col;

        if (t < 0.12) {
          col = mezclar(COL_TIERRA_RAIZ, COL_VERDE_PROFUNDO, t / 0.12);
        } else if (t < 0.45) {
          col = mezclar(COL_VERDE_PROFUNDO, COL_VERDE_MEDIO, (t - 0.12) / 0.33);
        } else if (t < 0.78) {
          col = mezclar(COL_VERDE_MEDIO, COL_VERDE_VIBRANTE, (t - 0.45) / 0.33);
        } else {
          const k = (t - 0.78) / 0.22;
          col = mezclar(COL_VERDE_SOL, COL_PUNTA_DORADA, k);
        }

        // Variación sutil de saturación y tono entre hojas
        if (matizRnd !== 0) {
          col = col.clone();
          col.g = Math.min(1, Math.max(0, col.g + matizRnd));
        }

        return col;
      }, g);
    }

    g.updateMatrixWorld(true);

    // ---------------- 3. ANIMACIONES ORGÁNICAS DE OLEAJE DE VIENTO ----------------
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

    // Brisa Suave: oleaje cadencioso que recorre la mata como olas en un trigal
    const dB = 3.6;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('CentroMedio', dB, (t) => [2.5 * sen(t), 0.5 * cos(t), 1.8 * cos(t)]),
      giro('CentroPunta', dB, (t) => [5.2 * sen(t), 1.0 * cos(t), 3.8 * cos(t)]),

      giro('Oeste_Mid', dB, (t) => [2.0 * sen(t - 0.1), 0, 1.5 * cos(t - 0.1)]),
      giro('Oeste_Tip', dB, (t) => [4.8 * sen(t - 0.1), 0, 3.2 * cos(t - 0.1)]),

      giro('Norte_Mid', dB, (t) => [1.8 * sen(t - 0.05), 0, 2.2 * cos(t - 0.05)]),
      giro('Norte_Tip', dB, (t) => [4.0 * sen(t - 0.05), 0, 4.8 * cos(t - 0.05)]),

      giro('Sur_Mid', dB, (t) => [2.2 * sen(t + 0.05), 0, 1.6 * cos(t + 0.05)]),
      giro('Sur_Tip', dB, (t) => [4.6 * sen(t + 0.05), 0, 3.5 * cos(t + 0.05)]),

      giro('Este_Mid', dB, (t) => [2.8 * sen(t + 0.1), 0, 2.0 * cos(t + 0.1)]),
      giro('Este_Tip', dB, (t) => [6.0 * sen(t + 0.1), 0, 4.2 * cos(t + 0.1)])
    ]);

    // Viento Fuerte: ráfagas intensas que aplastan y cimbran las puntas de hierba
    const dV = 2.4;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('CentroMedio', dV, (t) => [7.5 * sen(t), 1.5 * sen(t, 2), 5.5 * sen(t)]),
      giro('CentroPunta', dV, (t) => [16.0 * sen(t), 3.0 * cos(t, 2), 11.0 * sen(t)]),

      giro('Oeste_Mid', dV, (t) => [6.5 * sen(t - 0.1), 0, 4.5 * sen(t - 0.1)]),
      giro('Oeste_Tip', dV, (t) => [14.0 * sen(t - 0.1), 0, 9.5 * sen(t - 0.1)]),

      giro('Norte_Mid', dV, (t) => [6.0 * sen(t - 0.05), 0, 7.0 * sen(t - 0.05)]),
      giro('Norte_Tip', dV, (t) => [13.0 * sen(t - 0.05), 0, 15.0 * sen(t - 0.05)]),

      giro('Sur_Mid', dV, (t) => [7.0 * sen(t + 0.05), 0, 5.0 * sen(t + 0.05)]),
      giro('Sur_Tip', dV, (t) => [14.5 * sen(t + 0.05), 0, 10.5 * sen(t + 0.05)]),

      giro('Este_Mid', dV, (t) => [8.5 * sen(t + 0.1), 0, 6.0 * sen(t + 0.1)]),
      giro('Este_Tip', dV, (t) => [18.0 * sen(t + 0.1), 0, 12.0 * sen(t + 0.1)])
    ]);

    // Reposo: suave respiración de pradera en calma
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('CentroMedio', dR, (t) => [0.8 * sen(t), 0, 0.6 * cos(t)]),
      giro('CentroPunta', dR, (t) => [1.8 * sen(t), 0, 1.3 * cos(t)]),

      giro('Oeste_Mid', dR, (t) => [0.7 * sen(t), 0, 0.5 * cos(t)]),
      giro('Oeste_Tip', dR, (t) => [1.5 * sen(t), 0, 1.1 * cos(t)]),

      giro('Norte_Mid', dR, (t) => [0.6 * sen(t), 0, 0.7 * cos(t)]),
      giro('Norte_Tip', dR, (t) => [1.4 * sen(t), 0, 1.6 * cos(t)]),

      giro('Sur_Mid', dR, (t) => [0.7 * sen(t), 0, 0.5 * cos(t)]),
      giro('Sur_Tip', dR, (t) => [1.5 * sen(t), 0, 1.2 * cos(t)]),

      giro('Este_Mid', dR, (t) => [0.9 * sen(t), 0, 0.6 * cos(t)]),
      giro('Este_Tip', dR, (t) => [2.0 * sen(t), 0, 1.4 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
