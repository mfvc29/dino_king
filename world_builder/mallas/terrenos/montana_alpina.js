/**
 * Montaña Alpina Escarpada — macizo montañoso piramidal con crestas rocosas,
 * barrancos glaciales y falda en pendiente suave.
 * Medidas: ~5.6 m de ancho × 5.2 m de fondo × 3.8 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta alpina geológica:
 *       • Cumbres más altas con nieves perpetuas y hielo glacial (#f4f8fc).
 *       • Paredes verticales y crestas escarpadas en granito y pizarra (#6a6256 a #8e8476).
 *       • Canchal y pendiente media con suelo pedregoso y líquenes.
 *       • Falda inferior con pastos alpinos y sendero tallado de tierra clara.
 *   - Esqueleto articulado con THREE.Bone para respuesta dinámica sismológica.
 *   - Animaciones geológicas temáticas ('Pisada Dino', 'Temblor Sísmico', 'Reposo').
 */
registrarMalla({
  id: 'montana_alpina',
  categoria: 'terrenos',
  nombre: 'Montaña Alpina',
  icono: '🏔️',
  origen: 'Referencia Montaña Escarpada + Pendiente',

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
      ['MacizoCentral', 'Raiz', 0.00, 1.80, 0.00],
      ['PicoPrincipal', 'MacizoCentral', 0.00, 3.80, -0.20],
      ['CrestaIzq', 'MacizoCentral', -1.50, 2.40, 0.00],
      ['CrestaDer', 'MacizoCentral', 1.50, 2.50, 0.00]
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

    // ---------------- 2. MODELADO DE LA MONTAÑA ----------------
    const cols = M.seg(36, 18);
    const rows = M.seg(32, 16);
    const ancho = 5.6;
    const fondo = 5.2;

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const nx = x / (ancho * 0.5);
      const nz = (z + 0.35) / (fondo * 0.5);
      const r = Math.sqrt(nx * nx * 0.85 + nz * nz * 1.05);

      let h = 0;
      if (r < 1.05) {
        const base = Math.max(0, 1.05 - r);
        const ang = Math.atan2(nz, nx);
        const crestas = Math.pow(Math.abs(Math.cos(ang * 3.0 + 0.35)), 0.75) * 0.32
                      + Math.pow(Math.abs(Math.sin(ang * 5.0 - 0.5)), 0.85) * 0.18;

        const p1 = Math.exp(-(nx * nx * 3.8 + (nz + 0.08) * (nz + 0.08) * 4.2)) * 2.1;
        const pL = Math.exp(-((nx + 0.42) * (nx + 0.42) * 5.2 + (nz - 0.05) * (nz - 0.05) * 5.2)) * 1.25;
        const pR = Math.exp(-((nx - 0.46) * (nx - 0.46) * 5.0 + (nz + 0.02) * (nz + 0.02) * 5.0)) * 1.4;

        h = Math.pow(base, 1.45) * (1.8 + crestas * 1.9) + p1 + pL + pR;

        // Ligera pendiente frontal con sendero tallado
        if (z > 0.2) {
          const sendero = Math.exp(-Math.pow(x - Math.sin(z * 1.5) * 0.35, 2) / 0.18);
          h -= sendero * 0.28 * Math.max(0, 1 - z / (fondo * 0.5));
        }
      }

      pos.setY(i, Math.max(0, h));
    }

    geo.computeVertexNormals();
    const meshMontanosa = M.pieza(geo, 'MacizoMontanosoAlpino', cols, rows);
    g.add(meshMontanosa);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    const COL_NIEVE_CUMBRE = C(0xf4f8fc); // Nieve perpetua en cumbres
    const COL_ROCA_CLARA = C(0xb8af9e);   // Risco superior de granito
    const COL_ROCA_MEDIA = C(0x7c7466);   // Pizarra y granito medio
    const COL_ROCA_SOMBRA = C(0x403a32);  // Barrancos sombríos
    const COL_PASTO_ALPINO = C(0x4e782e); // Pradera alpina en la falda
    const COL_SENDERO_TIERRA = C(0xb89258);// Sendero tallado en la falda

    M.pintar(meshMontanosa, (i, p) => {
      // 1. Sendero frontal
      if (p.z > 0.2 && p.y < 1.2) {
        const distSendero = Math.abs(p.x - Math.sin(p.z * 1.5) * 0.35);
        if (distSendero < 0.4) {
          return mezclar(COL_SENDERO_TIERRA, COL_PASTO_ALPINO, distSendero / 0.4);
        }
      }

      // 2. Altitud de la montaña
      if (p.y > 3.0) {
        // Cumbres nevadas
        return mezclar(COL_ROCA_CLARA, COL_NIEVE_CUMBRE, suave(3.0, 3.6, p.y));
      }
      if (p.y > 1.8) {
        // Risco rocoso escarpado
        const veta = 0.5 + 0.5 * Math.sin(p.y * 12 + p.x * 4);
        let col = mezclar(COL_ROCA_MEDIA, COL_ROCA_CLARA, veta);
        if (p.x < 0) col = mezclar(col, COL_ROCA_SOMBRA, 0.35); // Ladera sombría
        return col;
      }
      if (p.y > 0.6) {
        // Transición de canchal a pastos
        const t = (p.y - 0.6) / 1.2;
        return mezclar(COL_PASTO_ALPINO, COL_ROCA_MEDIA, t);
      }

      // Falda inferior
      const vetaPasto = Math.sin(p.x * 5) * Math.cos(p.z * 5);
      return mezclar(COL_PASTO_ALPINO, new THREE.Color(0x3a6020), 0.5 + 0.3 * vetaPasto);
    }, g);

    // ---------------- 4. ANIMACIONES SÍSMICAS ----------------
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

    // Pisada Dino: retumbo profundo en el macizo
    const dP = 2.0;
    const decae = (t) => Math.exp(-3.2 * t);
    const pisada = new THREE.AnimationClip('Pisada Dino', dP, [
      giro('MacizoCentral', dP, (t) => [1.8 * sen(t, 4) * decae(t), 0, 1.2 * cos(t, 4) * decae(t)]),
      giro('PicoPrincipal', dP, (t) => [3.5 * sen(t, 4) * decae(t), 0, 2.4 * cos(t, 4) * decae(t)]),
      giro('CrestaIzq', dP, (t) => [-2.2 * cos(t, 4) * decae(t), 0, -1.6 * sen(t, 4) * decae(t)]),
      giro('CrestaDer', dP, (t) => [2.2 * sen(t, 4) * decae(t), 0, 1.6 * cos(t, 4) * decae(t)])
    ]);

    // Temblor Sísmico: vibración geológica sostenida
    const dT = 2.6;
    const temblor = new THREE.AnimationClip('Temblor Sísmico', dT, [
      giro('MacizoCentral', dT, (t) => [0.6 * sen(t, 6), 0, 0.4 * cos(t, 6)]),
      giro('PicoPrincipal', dT, (t) => [1.2 * sen(t, 6), 0, 0.8 * cos(t, 6)]),
      giro('CrestaIzq', dT, (t) => [-0.7 * cos(t, 6), 0, -0.5 * sen(t, 6)]),
      giro('CrestaDer', dT, (t) => [0.7 * sen(t, 6), 0, 0.5 * cos(t, 6)])
    ]);

    // Reposo: macizo firme e inmutable
    const dR = 5.5;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('MacizoCentral', dR, (t) => [0.04 * sen(t), 0, 0.03 * cos(t)]),
      giro('PicoPrincipal', dR, (t) => [0.08 * sen(t), 0, 0.05 * cos(t)]),
      giro('CrestaIzq', dR, (t) => [-0.05 * cos(t), 0, -0.03 * sen(t)]),
      giro('CrestaDer', dR, (t) => [0.05 * sen(t), 0, 0.03 * cos(t)])
    ]);

    g.animations = [pisada, temblor, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
