/**
 * Letrero de Ruta 1 — poste de madera y cartel subdividido.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta rústica de carpintería:
 *       • Poste cilíndrico en madera de cedro intemperizada con veta vertical y base húmeda.
 *       • Tablón del letrero en pino dorado con bordes desgastados, vetas de madera y pernos de hierro forjado.
 *   - Esqueleto articulado con THREE.Bone ('PosteHueso', 'TablaHueso') con bisagra de oscilación.
 *   - Animaciones orgánicas de viento ('Brisa Suave', 'Viento Fuerte', 'Reposo').
 */
registrarMalla({
  id: 'letrero_ruta',
  categoria: 'estructuras',
  nombre: 'Letrero de Ruta',
  icono: '🪧',
  origen: 'procedural/ruta_1',

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
      ['PosteHueso', 'Raiz', 0.00, 0.60, 0.00],
      ['TablaHueso', 'PosteHueso', 0.00, 1.15, 0.00]
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

    // ---------------- 2. MODELADO DE POSTE Y TABLA ----------------
    const postGeo = new THREE.CylinderGeometry(0.1, 0.12, 1.2, 8, 4, true);
    postGeo.translate(0, 0.6, 0);
    const meshPoste = M.pieza(postGeo, 'PosteLetrero', 8, 4);
    colgar('PosteHueso', meshPoste);

    const boardGeo = new THREE.BoxGeometry(1.1, 0.65, 0.18, 6, 4, 2);
    boardGeo.translate(0, 1.15, 0);
    const meshTabla = M.pieza(boardGeo, 'TablaLetrero', 6, 4);
    colgar('TablaHueso', meshTabla);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    const COL_MADERA_OSCURA = C(0x281a12); // Base húmeda y sombra
    const COL_POSTE_BASE = C(0x563e2a);    // Poste de cedro seco
    const COL_POSTE_CLARO = C(0x7c5e42);   // Vetas y resaltes de poste
    const COL_TABLA_FONDO = C(0x8a623c);   // Tono madera tabla
    const COL_TABLA_PINO = C(0xd0a466);    // Pino dorado central
    const COL_TABLA_BORDE = C(0x6e4e32);   // Borde desgastado
    const COL_HIERRO_PERNO = C(0x221e1a);  // Pernos de fijación

    M.pintar(meshPoste, (i, p) => {
      const veta = Math.sin(p.y * 20 + Math.atan2(p.z, p.x) * 6);
      let col = mezclar(COL_POSTE_BASE, COL_POSTE_CLARO, 0.5 + 0.5 * veta);
      col = mezclar(col, COL_MADERA_OSCURA, suave(0.35, -0.05, p.y));
      return col;
    }, g);

    M.pintar(meshTabla, (i, p) => {
      const vetaH = Math.sin(p.x * 12 + p.y * 25);
      const distCentro = Math.hypot(p.x / 0.55, (p.y - 1.15) / 0.32);

      let col = mezclar(COL_TABLA_FONDO, COL_TABLA_PINO, 0.5 + 0.5 * vetaH);
      col = mezclar(col, COL_TABLA_BORDE, suave(0.6, 1.0, distCentro));

      // Pernos de hierro en el centro donde se ancla al poste
      const distPerno = Math.hypot(p.x, (p.y - 1.15));
      if (distPerno < 0.12 && Math.abs(p.z) > 0.07) {
        col = mezclar(col, COL_HIERRO_PERNO, 0.9);
      }

      return col;
    }, g);

    // ---------------- 4. ANIMACIONES ORGÁNICAS DE VIENTO ----------------
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

    // Brisa Suave: balanceo sereno del cartel en su bisagra
    const dB = 3.8;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('PosteHueso', dB, (t) => [0.4 * sen(t), 0, 0.3 * cos(t)]),
      giro('TablaHueso', dB, (t) => [3.5 * sen(t), 0.8 * cos(t), 2.2 * cos(t)])
    ]);

    // Viento Fuerte: oscilación viva y chasquido con ráfagas
    const dV = 2.4;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('PosteHueso', dV, (t) => [1.5 * sen(t), 0, 1.2 * sen(t)]),
      giro('TablaHueso', dV, (t) => [12.0 * sen(t), 3.0 * cos(t, 2), 7.5 * sen(t)])
    ]);

    // Reposo: micro-vibración casi imperceptible
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('PosteHueso', dR, (t) => [0.08 * sen(t), 0, 0.05 * cos(t)]),
      giro('TablaHueso', dR, (t) => [0.6 * sen(t), 0, 0.4 * cos(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
