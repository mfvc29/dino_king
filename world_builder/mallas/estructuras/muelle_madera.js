/**
 * Muelle / Puente de Madera — tablones transversales y pilotes cilíndricos.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta marítima / fluvial:
 *       • Tablones superiores con veta de madera envejecida por el sol y la salpicadura de agua.
 *       • Marcas de clavos de forja en los apoyos de cada pilote.
 *       • Pilotes de soporte con verdín, algas y pátina de humedad en la base sumergida.
 *   - Esqueleto articulado con THREE.Bone para simular la oscilación de mareas y oleaje.
 *   - Animaciones fluidas de oleaje ('Oleaje Suave', 'Oleaje Fuerte', 'Reposo').
 */
registrarMalla({
  id: 'muelle_madera',
  categoria: 'estructuras',
  nombre: 'Muelle de Madera',
  icono: '🌉',
  origen: 'procedural/referencia_25d',

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
      ['DeckCentro', 'Raiz', 0.00, 0.85, 0.00],
      ['DeckFrontal', 'DeckCentro', 0.00, 0.85, 1.80],
      ['DeckTrasero', 'DeckCentro', 0.00, 0.85, -1.80],
      ['PilotesHueso', 'Raiz', 0.00, 0.45, 0.00]
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

    // ---------------- 2. MODELADO DE TABLONES Y PILOTES ----------------
    const length = 6.5;
    const width = 2.6;
    const numPlanks = 10;
    const mallasTablones = [];

    for (let p = 0; p < numPlanks; p++) {
      const plankGeo = new THREE.BoxGeometry(width, 0.14, 0.48, 6, 2, 2);
      const posZ = (p - numPlanks / 2 + 0.5) * 0.62;
      plankGeo.translate(0, 0.85, posZ);
      const mallaTablon = M.pieza(plankGeo, `Tablon_${p + 1}`, 6, 2);

      // Asignar tablones a secciones del muelle según su posición Z
      if (posZ > 0.8) colgar('DeckFrontal', mallaTablon);
      else if (posZ < -0.8) colgar('DeckTrasero', mallaTablon);
      else colgar('DeckCentro', mallaTablon);

      mallasTablones.push(mallaTablon);
    }

    const posts = [
      [-width * 0.4, -length * 0.38], [width * 0.4, -length * 0.38],
      [-width * 0.4, 0], [width * 0.4, 0],
      [-width * 0.4, length * 0.38], [width * 0.4, length * 0.38]
    ];
    const mallasPostes = [];
    posts.forEach(([px, pz], idx) => {
      const postGeo = new THREE.CylinderGeometry(0.16, 0.15, 0.9, 8, 4, true);
      postGeo.translate(px, 0.45, pz);
      const mallaPoste = M.pieza(postGeo, `Poste_${idx + 1}`, 8, 4);
      colgar('PilotesHueso', mallaPoste);
      mallasPostes.push(mallaPoste);
    });

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    const COL_AGUA_VERDIN = C(0x284218);  // Algas y verdín basal de agua
    const COL_POSTE_HUMEDO = C(0x241a12); // Nivel de marea alta
    const COL_MADERA_VIEJA = C(0x6e5a48); // Madera intemperizada
    const COL_MADERA_SECA = C(0x9a8470);  // Tablón bañado por el sol
    const COL_MADERA_CLARA = C(0xbcaaa8); // Resalte cenizo
    const COL_CLAVO = C(0x1e1a16);        // Clavos de fijación

    mallasTablones.forEach((malla, idx) => {
      M.pintar(malla, (i, p) => {
        const veta = Math.sin(p.x * 16 + p.z * 8);
        const matiz = (idx % 2 === 0 ? 0.05 : -0.05);

        let col = mezclar(COL_MADERA_VIEJA, COL_MADERA_SECA, 0.5 + 0.5 * veta + matiz);
        if (p.y > 0.88) col = mezclar(col, COL_MADERA_CLARA, 0.3); // Cara superior pisada

        // Clavos sobre los postes (en |x| ~ 1.04)
        if (Math.abs(Math.abs(p.x) - 1.04) < 0.12 && Math.abs(p.z % 0.62) < 0.15) {
          col = mezclar(col, COL_CLAVO, 0.85);
        }

        return col;
      }, g);
    });

    mallasPostes.forEach((malla) => {
      M.pintar(malla, (i, p) => {
        const veta = Math.sin(p.y * 18);
        let col = mezclar(COL_MADERA_VIEJA, COL_MADERA_SECA, 0.4 + 0.3 * veta);

        // Marca de agua y algas en la base sumergida
        col = mezclar(col, COL_AGUA_VERDIN, suave(0.35, 0.0, p.y));
        if (p.y > 0.25 && p.y < 0.42) {
          col = mezclar(col, COL_POSTE_HUMEDO, 0.6); // Línea de marea
        }

        return col;
      }, g);
    });

    // ---------------- 4. ANIMACIONES ORGÁNICAS DE OLEAJE ----------------
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

    // Oleaje Suave: balanceo y cabeceo rítmico con las olas del agua
    const dO = 4.2;
    const oleaje = new THREE.AnimationClip('Oleaje Suave', dO, [
      giro('DeckCentro', dO, (t) => [0.6 * sen(t), 0, 0.5 * cos(t)]),
      giro('DeckFrontal', dO, (t) => [1.5 * sen(t + 0.1), 0, 1.0 * cos(t + 0.1)]),
      giro('DeckTrasero', dO, (t) => [1.3 * sen(t - 0.1), 0, 0.9 * cos(t - 0.1)]),
      giro('PilotesHueso', dO, (t) => [0.2 * sen(t), 0, 0.15 * cos(t)])
    ]);

    // Oleaje Fuerte: oleaje intenso y marea alta
    const dOF = 2.8;
    const oleajeFuerte = new THREE.AnimationClip('Oleaje Fuerte', dOF, [
      giro('DeckCentro', dOF, (t) => [2.0 * sen(t), 0, 1.8 * cos(t)]),
      giro('DeckFrontal', dOF, (t) => [4.5 * sen(t + 0.1), 0, 3.2 * cos(t + 0.1)]),
      giro('DeckTrasero', dOF, (t) => [4.0 * sen(t - 0.1), 0, 2.8 * cos(t - 0.1)]),
      giro('PilotesHueso', dOF, (t) => [0.8 * sen(t), 0, 0.6 * cos(t)])
    ]);

    // Reposo: agua en calma
    const dR = 5.5;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('DeckCentro', dR, (t) => [0.15 * sen(t), 0, 0.12 * cos(t)]),
      giro('DeckFrontal', dR, (t) => [0.35 * sen(t + 0.1), 0, 0.25 * cos(t + 0.1)]),
      giro('DeckTrasero', dR, (t) => [0.30 * sen(t - 0.1), 0, 0.22 * cos(t - 0.1)]),
      giro('PilotesHueso', dR, (t) => [0.05 * sen(t), 0, 0.04 * cos(t)])
    ]);

    g.animations = [oleaje, oleajeFuerte, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
