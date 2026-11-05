/**
 * Abedul Columnar — copa alta y densa en forma de huevo sobre un tronco blanco esbelto.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_n5ti47n5ti47n5ti.png
 * Medidas aprox.: 3,0 m de ancho × 4,7 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) fiel a la ilustración:
 *       • Tronco con corteza blanca de abedul nacarada, lenticelas horizontales oscuras y base terrosa.
 *       • Gran copa columnar y 12 racimos periféricos con degradado esmeralda profundo a lima luminoso.
 *   - Esqueleto articulado de 5 huesos con piel deformable en tronco y copa (M.pielConHuesos).
 *   - Animaciones de viento (Brisa Suave, Viento Fuerte, Reposo) con la elasticidad esbelta del abedul.
 */
registrarMalla({
  id: 'abedul',
  categoria: 'arboles',
  nombre: 'Abedul Columnar',
  icono: '🌳',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_n5ti47n5ti47n5ti.png',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;

    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['TroncoBajo', 'Raiz', 0.02, 0.95, 0.01],
      ['BaseCopa', 'TroncoBajo', 0.00, 1.90, 0.00],
      ['CopaMedia', 'BaseCopa', -0.02, 3.10, 0.01],
      ['CopaAlta', 'CopaMedia', 0.01, 4.30, -0.01]
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

    // ---------------- 2. TRONCO BLANCO CON PIEL DEFORMABLE ----------------
    const tronco = M.tubo([[0, 0, 0], [0.03, 0.9, 0.02], [0, 1.9, 0]], 0.14, 0.08, {
      ensanche: 0.3, segLargo: 8, segRadio: 12, nombre: 'TroncoBlanco',
      ruido: (t, a) => 1 + 0.03 * Math.sin(a * 3)
    });
    g.add(tronco);

    const TRAMOS_TRONCO = [
      [0.0, 'Raiz'],
      [0.95, 'TroncoBajo'],
      [1.90, 'BaseCopa']
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

    // ---------------- 3. COPA COLUMNAR Y RACIMOS EN ESPIRAL ----------------
    const cy = 2.65;
    const ry = 2.0;
    const rx = 1.3;
    const estrechar = 0.38;
    const copa = M.copa(0, cy, 0, {
      rx, ry, rz: rx, estrechar, lobulos: 7, amp: 0.1, base: 0.85, segW: 22, segH: 18,
      semilla: 5, nombre: 'CopaColumnar'
    });
    g.add(copa);

    const TRAMOS_COPA = [
      [1.0, 'BaseCopa'],
      [2.8, 'CopaMedia'],
      [4.65, 'CopaAlta']
    ];
    M.pielConHuesos(copa, g, (i, x, y, z) => {
      let k = 0;
      while (k + 1 < TRAMOS_COPA.length && y >= TRAMOS_COPA[k + 1][0]) k++;
      const res = [[hueso[TRAMOS_COPA[k][1]], 1]];
      if (k + 1 < TRAMOS_COPA.length) {
        const w = suave(-0.6, 0.6, y - TRAMOS_COPA[k + 1][0]);
        if (w > 0) { res[0][1] = 1 - w; res.push([hueso[TRAMOS_COPA[k + 1][1]], w]); }
      }
      return res;
    });

    // Racimos de hojas que sobresalen en espiral
    const rnd = M.azar(77);
    for (let i = 0; i < 12; i++) {
      const h = 1.3 + (i / 11) * 2.9;
      const yn = (h - cy) / ry;
      const radioLocal = rx * Math.sqrt(Math.max(0, 1 - yn * yn)) * (1 - estrechar * Math.max(0, yn));
      const a = i * 2.4 + rnd() * 0.6;
      const r = 0.38 + rnd() * 0.18;
      const racimo = M.copa(Math.cos(a) * radioLocal * 0.85, h, Math.sin(a) * radioLocal * 0.85, {
        rx: r, ry: r * 0.8, rz: r, lobulos: 5, amp: 0.18, base: 0.6, segW: 12, segH: 8,
        semilla: 100 + i, nombre: `RacimoHojas_${i + 1}`
      });
      const hPadre = h < 2.3 ? 'BaseCopa' : (h < 3.5 ? 'CopaMedia' : 'CopaAlta');
      colgar(hPadre, racimo);
    }

    // ---------------- 4. PINTURA PROCEDURAL BASADA EN GEMINI_GENERATED_IMAGE_N5TI47 ----------------
    // Tronco blanco de abedul con lenticelas oscuras
    M.pintar(tronco, (i, p) => {
      const v = p.y;
      const ang = Math.atan2(p.z, p.x);
      // Manchas horizontales características de la corteza de abedul
      const lenticela = Math.sin(v * 28 + Math.cos(ang * 4) * 2.5) * Math.sin(ang * 6);
      const c = new THREE.Color(0xf2efe6);
      c.lerp(new THREE.Color(0xdad4c4), 0.3);
      if (lenticela > 0.65) {
        c.lerp(new THREE.Color(0x282420), 0.85);
      }
      // Oscurecimiento terroso en la base
      if (v < 0.45) {
        const tierra = Math.pow(1 - v / 0.45, 1.2) * 0.7;
        c.lerp(new THREE.Color(0x4a3c2e), tierra);
      }
      return c;
    }, g);

    // Pintar copa principal
    M.pintar(copa, (i, p) => {
      const ny = (p.y - cy) / ry;
      const c = new THREE.Color(0x386d26);
      if (ny < -0.2) {
        c.lerp(new THREE.Color(0x163414), Math.min(1, Math.abs(ny + 0.2) * 0.88));
      } else {
        const factorLuz = Math.pow(Math.max(0, ny), 1.15);
        c.lerp(new THREE.Color(0x82c23a), Math.min(1, factorLuz * 0.94));
      }
      return c;
    }, g);

    // Pintar racimos de hojas periféricos
    for (let i = 0; i < 12; i++) {
      const racimo = g.getObjectByName(`RacimoHojas_${i + 1}`);
      if (racimo) {
        const h = 1.3 + (i / 11) * 2.9;
        M.pintar(racimo, (idx, p) => {
          const ny = (p.y - h) / 0.4;
          const c = new THREE.Color(0x3e772c);
          if (ny < 0) {
            c.lerp(new THREE.Color(0x1a3818), Math.min(1, Math.abs(ny) * 0.8));
          } else {
            c.lerp(new THREE.Color(0x8ed042), Math.min(1, Math.pow(ny, 1.1) * 0.95));
          }
          return c;
        }, g);
      }
    }

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

    // Brisa Suave: balanceo elástico de tronco delgado y estilizado
    const dB = 4.4;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('TroncoBajo', dB, (t) => [0.4 * sen(t), 0, 0.3 * cos(t)]),
      giro('BaseCopa', dB, (t) => [1.0 * sen(t), 0, 0.7 * cos(t)]),
      giro('CopaMedia', dB, (t) => [1.8 * sen(t), 0, 1.3 * cos(t)]),
      giro('CopaAlta', dB, (t) => [2.6 * sen(t), 0.6 * sen(t, 2), 1.9 * cos(t)])
    ]);

    // Viento Fuerte: flexión ágil de abedul de campo
    const dV = 2.8;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('TroncoBajo', dV, (t) => [1.2 * sen(t), 0, 0.9 * sen(t)]),
      giro('BaseCopa', dV, (t) => [2.8 * sen(t), 0, 2.0 * sen(t)]),
      giro('CopaMedia', dV, (t) => [5.0 * sen(t), 0, 3.6 * sen(t)]),
      giro('CopaAlta', dV, (t) => [7.5 * sen(t), 1.8 * sen(t, 2), 5.4 * sen(t)])
    ]);

    // Reposo: suave balanceo imperceptible
    const dR = 5.6;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('TroncoBajo', dR, (t) => [0.12 * sen(t), 0, 0.08 * cos(t)]),
      giro('BaseCopa', dR, (t) => [0.30 * sen(t), 0, 0.20 * cos(t)]),
      giro('CopaMedia', dR, (t) => [0.55 * sen(t), 0, 0.38 * cos(t)]),
      giro('CopaAlta', dR, (t) => [0.80 * sen(t), 0.2 * sen(t), 0.55 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
