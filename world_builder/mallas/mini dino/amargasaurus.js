/**
 * Mini Amargasaurus (Tipo Agua) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte oficial de Dinosaur King:
 *   assets/dinos/arte/agua/amargasaurus_der.webp
 *
 * Pintado con la paleta y proyección exacta de amargasaurus_der.webp:
 *   - Piel base: Ámbar dorado / ocre tostado cálido (#ca9d6d / #d68f31)
 *   - Vientre continuo: Crema cálido (#f7dba2) en garganta, pecho y panza
 *   - Franjas dorsales: Chocolate oscuro / marrón rojizo (#421f0d / #663212)
 *   - Velas cervicales: Ámbar dorado / naranja fuego translúcido (#f5a623)
 *   - Espinas y remates: Terracota tostado (#9e6c48) con puntas de marfil
 *   - Ojos anime: Iris azul turquesa de agua (#0ea5e9) con pupila y brillos
 *
 * Malla 100% CERRADA Y SÓLIDA (Cero huecos, cero piezas abiertas):
 *   - Cuerpo completo continuo de una sola pieza desde la punta cerrada de la colita
 *     hasta la punta cerrada del hocico, pasando por cadera, barriga baja, pecho, cuello y cabeza.
 *   - Patitas cilíndricas redondeadas arriba en cúpula cerrada dentro del cuerpo y abajo en el pie.
 *   - Espinas dorsales curvas nacidas directamente de la piel cerrada del lomo y cuello.
 *   - Velas acuáticas cian/turquesa translúcidas entre las espinas.
 *   - Mandíbula articulada con dientecitos de marfil y ojos anime grandes y expresivos.
 *   - Pintura por vértice: piel azul pizarra, vientre crema continuo y manchas zafiro.
 *   - Esqueleto con piel deformable (M.pielConHuesos) y animaciones de bebé dinosaurio.
 */
registrarMalla({
  id: 'mini_amargasaurus',
  categoria: 'mini dino',
  nombre: 'Mini Amargasaurus (Agua)',
  icono: '🦕',
  origen: 'assets/dinos/arte/agua/amargasaurus_der.webp',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const L = (s) => (s > 0 ? 'I' : 'D');
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const grad = Math.PI / 180;
    const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t
      + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

    // ---------------- UTILIDADES GEOMÉTRICAS ----------------
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    function rejilla(pos, cols, rows, nombre) {
      const idx = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * (cols + 1) + c;
          const b = a + cols + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      return M.pieza(geo, nombre, cols, rows);
    }

    function bloque(cx, cy, cz, hx, hy, hz, p, nombre, sW = 24, sH = 16) {
      const w = M.seg(sW, 8);
      const h = M.seg(sH, 6);
      const geo = new THREE.SphereGeometry(1, w, h);
      const a = geo.attributes.position;
      const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), p);
      for (let i = 0; i < a.count; i++) {
        a.setXYZ(i, cx + f(a.getX(i)) * hx, cy + f(a.getY(i)) * hy, cz + f(a.getZ(i)) * hz);
      }
      return M.pieza(geo, nombre, w, h);
    }

    function almendra(hx, hy, hz, nombre) {
      const sW = M.seg(24, 10);
      const sH = M.seg(16, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        const pin = 1 - 0.45 * x * x;
        a.setXYZ(i, x * hx, a.getY(i) * hy * pin, a.getZ(i) * hz * (0.6 + 0.4 * pin));
      }
      return M.pieza(geo, nombre, sW, sH);
    }

    function punta(puntos, r, nombre, segLargo = 12, segRadio = 10) {
      return M.tubo(puntos, r, r, { segLargo, segRadio, ruido: (t) => Math.pow(1 - t, 0.85), nombre });
    }

    // ---------------- 1. CUERPO CONTINUO Y TOTALMENTE CERRADO (DE COLA A HOCICO) ----------------
    // Eje en el plano medio: [z, y, semiancho, alto hacia arriba, alto hacia abajo, forma]
    // La punta de la cola (índice 0) y la punta del hocico (último índice) tienen radio = 0,
    // garantizando que la malla nace y muere en un punto cerrado sin huecos.
    const EJE = [
      [-0.82, 0.70, 0, 0, 0, 2],                 // Punta de la colita curvada arriba (cerrada a 0)
      [-0.85, 0.66, 0.038, 0.038, 0.038, 2],
      [-0.80, 0.58, 0.070, 0.070, 0.070, 2],
      [-0.68, 0.55, 0.115, 0.115, 0.115, 2],     // Cola media
      [-0.50, 0.56, 0.175, 0.175, 0.175, 2],     // Base de la cola
      [-0.32, 0.58, 0.250, 0.225, 0.250, 2.2],   // Cadera / patas traseras
      [-0.14, 0.56, 0.290, 0.240, 0.275, 2.3],   // Barriguita baja y gordita (parte más ancha)
      [0.06,  0.58, 0.260, 0.240, 0.240, 2.2],   // Pecho
      [0.20,  0.68, 0.200, 0.200, 0.190, 2.1],   // Hombros / base del cuello
      [0.30,  0.82, 0.145, 0.150, 0.145, 2.0],   // Cuello medio
      [0.36,  0.94, 0.135, 0.145, 0.135, 2.0],   // Cuello alto / nuca
      [0.42,  1.03, 0.165, 0.165, 0.090, 2.2],   // Cabeza chibi, frente abombada y sienes
      [0.50,  1.01, 0.145, 0.145, 0.065, 2.2],   // Mejillas infladas y puente nasal
      [0.58,  0.98, 0.115, 0.115, 0.045, 2.3],   // Hocico superior estilizado
      [0.64,  0.95, 0.075, 0.075, 0.030, 2.2],   // Morro redondeado tierno
      [0.67,  0.94, 0,     0,     0,     2.0]    // Cierre suave de la punta del morro
    ];

    const ejeCurva = new THREE.CatmullRomCurve3(EJE.map(([z, y]) => V(0, y, z)), false, 'centripetal');
    ejeCurva.arcLengthDivisions = 1200;
    const LARGO = ejeCurva.getLength();

    function seccion(u) {
      const f = ejeCurva.getUtoTmapping(u) * (EJE.length - 1);
      const i = Math.min(EJE.length - 2, Math.floor(f));
      const t = f - i;
      const a = EJE[Math.max(0, i - 1)];
      const b = EJE[i];
      const c = EJE[i + 1];
      const d = EJE[Math.min(EJE.length - 1, i + 2)];
      return [2, 3, 4, 5].map((j) => Math.max(0, cr(a[j], b[j], c[j], d[j], t)));
    }

    const X = V(1, 0, 0);
    function marcoEje(u) {
      const P = ejeCurva.getPointAt(u);
      const T = ejeCurva.getTangentAt(u);
      const U = V(0, 0, 0).crossVectors(T, X).normalize();
      return { P, T, U };
    }

    function uCercano(p, desde = 0, hasta = 1) {
      let mejor = desde;
      let dMin = Infinity;
      for (let k = 0; k <= 500; k++) {
        const u = desde + (hasta - desde) * (k / 500);
        const d = ejeCurva.getPointAt(u).distanceToSquared(p);
        if (d < dMin) { dMin = d; mejor = u; }
      }
      return mejor;
    }

    const COLS = M.seg(64, 24);
    const FILAS = M.seg(200, 60);
    const cuerpo = (() => {
      const pos = [];
      for (let r = 0; r <= FILAS; r++) {
        const u = r / FILAS;
        const { P, U } = marcoEje(u);
        const [w, hA, hB, p] = seccion(u);
        const ex = 2 / p;
        for (let c = 0; c <= COLS; c++) {
          const fi = Math.PI + (c / COLS) * Math.PI * 2;   // Costura abajo (en el vientre)
          const s = Math.sin(fi);
          const co = Math.cos(fi);
          const lx = w * Math.sign(s) * Math.pow(Math.abs(s), ex);
          const ly = (co >= 0 ? hA : hB) * Math.sign(co) * Math.pow(Math.abs(co), ex);
          pos.push(P.x + X.x * lx + U.x * ly, P.y + X.y * lx + U.y * ly, P.z + X.z * lx + U.z * ly);
        }
      }
      return M.coserNormales(rejilla(pos, COLS, FILAS, 'Cuerpo'));
    })();

    function enCuerpo(u, fi, despegue = 0) {
      const { P, U } = marcoEje(u);
      const [w, hA, hB, p] = seccion(u);
      const ex = 2 / p;
      const s = Math.sin(fi);
      const co = Math.cos(fi);
      const lx = (w + despegue) * Math.sign(s) * Math.pow(Math.abs(s), ex);
      const ly = ((co >= 0 ? hA : hB) + despegue) * Math.sign(co) * Math.pow(Math.abs(co), ex);
      return P.clone().addScaledVector(X, lx).addScaledVector(U, ly);
    }

    // ---------------- 2. ESQUELETO Y SKINNING DEL CUERPO ----------------
    const PIE_X = 0.22;
    const MANO_X = 0.20;
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['Cadera', 'Raiz', 0, 0.58, -0.22],
      ['Cola1', 'Cadera', 0, 0.56, -0.45],
      ['Cola2', 'Cola1', 0, 0.55, -0.66],
      ['Cola3', 'Cola2', 0, 0.66, -0.82],
      ['Pecho', 'Cadera', 0, 0.58, 0.08],
      ['Cuello1', 'Pecho', 0, 0.74, 0.22],
      ['Cuello2', 'Cuello1', 0, 0.88, 0.32],
      ['Cabeza', 'Cuello2', 0, 1.02, 0.44],
      ['Mandibula', 'Cabeza', 0, 0.95, 0.48],
      ...LADOS.flatMap((s) => [
        ['Brazo' + L(s), 'Pecho', s * MANO_X, 0.56, 0.14],
        ['Mano' + L(s), 'Brazo' + L(s), s * MANO_X, 0.16, 0.14],
        ['Muslo' + L(s), 'Cadera', s * PIE_X, 0.56, -0.26],
        ['Pata' + L(s), 'Muslo' + L(s), s * PIE_X, 0.16, -0.26]
      ])
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
    const colgar = (nombre, obj) => { if (obj) hueso[nombre].attach(obj); return obj; };

    // Vinculación suave de la piel del cuerpo continuo a los huesos
    const uH = (n, d1 = 0.2, d2 = 1) => uCercano(hueso[n].userData.reposo, d1, d2);
    const uCola3 = uCercano(hueso.Cola3.userData.reposo, 0, 0.35);
    const uCola2 = uCercano(hueso.Cola2.userData.reposo, 0.1, 0.45);
    const TRAMOS = [
      [0, 'Cola3'],
      [uCola3, 'Cola2'],
      [uCola2, 'Cola1'],
      [uH('Cola1', 0.15, 0.5), 'Cadera'],
      [uH('Pecho', 0.35, 0.7), 'Pecho'],
      [uH('Cuello1', 0.5, 0.8), 'Cuello1'],
      [uH('Cuello2', 0.65, 0.9), 'Cuello2'],
      [uH('Cabeza', 0.8, 1.0), 'Cabeza']
    ];
    const MEZCLA = 0.15 / LARGO;
    function pesosTramos(u, tramos, mezcla) {
      let k = 0;
      while (k + 1 < tramos.length && u >= tramos[k + 1][0]) k++;
      const res = [[hueso[tramos[k][1]], 1]];
      if (k + 1 < tramos.length) {
        const w = suave(-mezcla, mezcla, u - tramos[k + 1][0]);
        if (w > 0) { res[0][1] = 1 - w; res.push([hueso[tramos[k + 1][1]], w]); }
      }
      if (k > 0) {
        const w = 1 - suave(-mezcla, mezcla, u - tramos[k][0]);
        if (w > 0) { res[0][1] *= 1 - w; res.push([hueso[tramos[k - 1][1]], w]); }
      }
      return res;
    }
    g.add(cuerpo);
    M.pielConHuesos(cuerpo, g, (i) => pesosTramos(Math.floor(i / (COLS + 1)) / FILAS, TRAMOS, MEZCLA));
    const duenoEn = (u) => pesosTramos(u, TRAMOS, 1e-6)[0][0];

    // ---------------- 3. PATAS COLUMNARES RECHONCHAS TOTALMENTE CERRADAS ----------------
    // Cada pata nace redondeada en cúpula CERRADA dentro del cuerpo (sin cilindros cortados)
    function pataCerrada(s, camino, radios, huesosPata, nombre) {
      const curva = M.curva(camino);
      const tSeg = M.seg(20, 8);
      const rSeg = M.seg(24, 10);
      const geo = new THREE.TubeGeometry(curva, tSeg, 1, rSeg, false);
      const pos = geo.attributes.position;
      const P = new THREE.Vector3();

      for (let i = 0; i <= tSeg; i++) {
        const t = i / tSeg;
        curva.getPointAt(t, P);
        let r = M.interp(radios, t);
        // Cierre superior en cúpula suave dentro del cuerpo para que NUNCA quede abierta
        if (t < 0.22) {
          r *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / 0.22, 2)));
        }
        for (let j = 0; j <= rSeg; j++) {
          const k = i * (rSeg + 1) + j;
          pos.setXYZ(k,
            P.x + (pos.getX(k) - P.x) * r,
            P.y + (pos.getY(k) - P.y) * r,
            P.z + (pos.getZ(k) - P.z) * r
          );
        }
      }
      const malla = M.coserNormales(M.pieza(geo, nombre, rSeg, tSeg));
      g.add(malla);

      const tramos = [
        [0, huesosPata[0]],
        [0.55, huesosPata[1]]
      ];
      M.pielConHuesos(malla, g, (i) => pesosTramos(Math.floor(i / (rSeg + 1)) / tSeg, tramos, 0.15));
      return malla;
    }

    LADOS.forEach((s) => {
      // Pata trasera (nace arriba a y=0.62 dentro de la cadera)
      pataCerrada(s,
        [[s * PIE_X, 0.62, -0.26], [s * PIE_X, 0.42, -0.26], [s * PIE_X, 0.22, -0.26], [s * PIE_X, 0.05, -0.26]],
        [[0, 0.125], [0.35, 0.120], [0.7, 0.100], [1, 0.095]],
        ['Muslo' + L(s), 'Pata' + L(s)], 'PataTrasera');

      // Pie trasero: almohadilla redondeada y 3 garritas marfil
      colgar('Pata' + L(s), bloque(s * PIE_X, 0.045, -0.25, 0.095, 0.042, 0.105, 0.7, 'PieTrasero'));
      [-0.048, 0, 0.048].forEach((dx) => {
        colgar('Pata' + L(s), punta([[s * (PIE_X + dx), 0.045, -0.16], [s * (PIE_X + dx * 0.9), 0.030, -0.11], [s * (PIE_X + dx * 0.8), 0.015, -0.07]], 0.022, 'GarraBebe', 8, 8));
      });

      // Pata delantera (nace arriba a y=0.64 dentro del hombro)
      pataCerrada(s,
        [[s * MANO_X, 0.64, 0.14], [s * MANO_X, 0.44, 0.14], [s * MANO_X, 0.24, 0.14], [s * MANO_X, 0.05, 0.14]],
        [[0, 0.115], [0.35, 0.108], [0.7, 0.092], [1, 0.088]],
        ['Brazo' + L(s), 'Mano' + L(s)], 'PataDelantera');

      // Pie delantero
      colgar('Mano' + L(s), bloque(s * MANO_X, 0.045, 0.15, 0.090, 0.042, 0.098, 0.7, 'PieDelantero'));
      [-0.044, 0, 0.044].forEach((dx) => {
        colgar('Mano' + L(s), punta([[s * (MANO_X + dx), 0.045, 0.23], [s * (MANO_X + dx * 0.9), 0.030, 0.28], [s * (MANO_X + dx * 0.8), 0.015, 0.32]], 0.020, 'GarraBebe', 8, 8));
      });
    });

    // ---------------- 4. ESPINAS Y VELAS CERVICALES DE AGUA ----------------
    // 5 pares de espinas dorsales y sus velas membranosa acuáticas
    const ESPINAS = [
      // [z, y, largo, abX, incDeg]
      [0.34, 0.96, 0.12, 0.055, 32],
      [0.26, 0.88, 0.17, 0.072, 28],
      [0.17, 0.80, 0.23, 0.088, 24],   // Espina cumbre más alta
      [0.06, 0.76, 0.18, 0.084, 30],
      [-0.06, 0.72, 0.12, 0.076, 40]
    ];

    LADOS.forEach((s) => {
      const puntasEspinas = [];

      ESPINAS.forEach(([z, y, lg, abX, inc]) => {
        const u = uCercano(V(0, y, z), 0.35, 0.85);
        const bHueso = duenoEn(u).name.replace('Hueso', '');
        const radInc = inc * grad;

        const base = enCuerpo(u, s * 0.14, 0.005);
        const medio = base.clone().add(V(s * 0.02, lg * 0.58 * Math.cos(radInc), -lg * 0.45 * Math.sin(radInc)));
        const fin = base.clone().add(V(s * 0.015, lg * Math.cos(radInc), -lg * Math.sin(radInc) - 0.02));

        puntasEspinas.push({ base, fin, bHueso });

        // Espina sólida suave
        colgar(bHueso, punta([base, medio, fin], 0.018, 'EspinaDorsal', 10, 8));
        // Remate marfil de la punta
        colgar(bHueso, bloque(fin.x, fin.y, fin.z, 0.008, 0.012, 0.008, 0.4, 'PuntaEspinaMarfil'));
      });

      // Velitas de agua festoneadas entre espinas consecutivas
      for (let i = 0; i < puntasEspinas.length - 1; i++) {
        const p1 = puntasEspinas[i];
        const p2 = puntasEspinas[i + 1];

        const colsV = 6;
        const rowsV = 8;
        const posV = [];

        for (let r = 0; r <= rowsV; r++) {
          const v = r / rowsV;
          for (let c = 0; c <= colsV; c++) {
            const u = c / colsV;
            const bX = p1.base.x + (p2.base.x - p1.base.x) * u;
            const bY = p1.base.y + (p2.base.y - p1.base.y) * u;
            const bZ = p1.base.z + (p2.base.z - p1.base.z) * u;

            const tX = p1.fin.x + (p2.fin.x - p1.fin.x) * u;
            const tY = p1.fin.y + (p2.fin.y - p1.fin.y) * u - Math.sin(u * Math.PI) * 0.024;
            const tZ = p1.fin.z + (p2.fin.z - p1.fin.z) * u;

            posV.push(
              bX + (tX - bX) * v,
              bY + (tY - bY) * v,
              bZ + (tZ - bZ) * v
            );
          }
        }
        colgar(p1.bHueso, rejilla(posV, colsV, rowsV, 'VelaMembranaAgua'));
      }
    });

    // Púas pequeñas redondeadas en la cola
    [-0.50, -0.64, -0.76].forEach((z, idx) => {
      const u = uCercano(V(0, 0.6, z), 0, 0.45);
      const bHueso = duenoEn(u).name.replace('Hueso', '');
      const p = enCuerpo(u, 0, 0.002);
      colgar(bHueso, bloque(p.x, p.y + 0.015, p.z, 0.012, 0.022, 0.014, 0.4, 'PuaColaBebe'));
    });

    // ---------------- 5. CABEZA, MANDÍBULA ESTILIZADA Y LABIOS ----------------
    // Mandíbula inferior modelada anatómicamente con alta resolución de vértices
    const MAND_PERFIL = [
      // [z, y, semiancho, alto, forma]
      [0.42, 0.935, 0.135, 0.040, 2.2],  // Comisura trasera / mejilla
      [0.48, 0.925, 0.125, 0.045, 2.2],  // Mandíbula media
      [0.54, 0.915, 0.105, 0.042, 2.2],  // Curva hacia el mentón
      [0.60, 0.910, 0.075, 0.035, 2.2],  // Barbilla delantera
      [0.64, 0.920, 0.045, 0.025, 2.0],  // Curva hacia arriba del mentón tierno
      [0.66, 0.928, 0,     0,     2.0]   // Cierre suave en la punta
    ];

    const colsMand = M.seg(48, 20);
    const filasMand = M.seg(32, 16);
    const posMand = [];

    for (let r = 0; r <= filasMand; r++) {
      const t = r / filasMand;
      const f = t * (MAND_PERFIL.length - 1);
      const i = Math.min(MAND_PERFIL.length - 2, Math.floor(f));
      const e = f - i;
      const a = MAND_PERFIL[Math.max(0, i - 1)];
      const b = MAND_PERFIL[i];
      const c = MAND_PERFIL[i + 1];
      const d = MAND_PERFIL[Math.min(MAND_PERFIL.length - 1, i + 2)];

      const z = cr(a[0], b[0], c[0], d[0], e);
      const y = cr(a[1], b[1], c[1], d[1], e);
      const w = Math.max(0, cr(a[2], b[2], c[2], d[2], e));
      const h = Math.max(0, cr(a[3], b[3], c[3], d[3], e));
      const p = Math.max(1.8, cr(a[4], b[4], c[4], d[4], e));
      const ex = 2 / p;

      for (let col = 0; col <= colsMand; col++) {
        const fi = Math.PI + (col / colsMand) * Math.PI * 2;
        const sx = Math.sin(fi);
        const cy = Math.cos(fi);
        const hActual = cy > 0 ? h * 0.40 : h;  // Parte superior entra suave al paladar
        const px = w * Math.sign(sx) * Math.pow(Math.abs(sx), ex);
        const py = y + hActual * cy;
        posMand.push(px, py, z);
      }
    }
    colgar('Mandibula', M.coserNormales(rejilla(posMand, colsMand, filasMand, 'MandibulaBebé')));

    // Labios superiores estilizados con sutil curvatura de sonrisa chibi
    LADOS.forEach((s) => {
      const labioPuntos = [
        [s * 0.142, 0.948, 0.42],  // Comisura de la mejilla con sutil sonrisa
        [s * 0.130, 0.942, 0.48],
        [s * 0.110, 0.938, 0.54],
        [s * 0.080, 0.936, 0.60],
        [s * 0.045, 0.938, 0.64],
        [s * 0.005, 0.940, 0.665]  // Centro del labio frontal
      ];
      colgar('Cabeza', M.tubo(labioPuntos, 0.008, 0.005, { segLargo: 28, segRadio: 10, nombre: 'LabioSuperior' }));
    });

    // Dientecitos redondeados de marfil colocados en la mandíbula
    LADOS.forEach((s) => {
      [0.50, 0.54, 0.58].forEach((z, idx) => {
        const xTeeth = s * (0.095 - idx * 0.020);
        colgar('Mandibula', bloque(xTeeth, 0.936, z, 0.006, 0.009, 0.006, 0.4, 'DienteBebe', 12, 10));
      });
    });

    // Fosas nasales en lo alto del hocico
    LADOS.forEach((s) => {
      colgar('Cabeza', bloque(s * 0.032, 1.050, 0.58, 0.010, 0.009, 0.010, 0.4, 'FosaNasal', 12, 10));
    });

    // Ojos anime grandes y expresivos
    LADOS.forEach((s) => {
      const ojoGrupo = new THREE.Group();
      ojoGrupo.position.set(s * 0.138, 1.045, 0.465);
      ojoGrupo.rotation.y = s * 0.44;

      // Blanco del ojo
      ojoGrupo.add(almendra(0.052, 0.048, 0.014, 'OjoBlanco'));

      // Iris azul turquesa / agua cristalina grande
      ojoGrupo.add(bloque(s * 0.004, 0, 0.006, 0.038, 0.038, 0.008, 1, 'IrisAgua'));

      // Pupila azul marino profundo
      ojoGrupo.add(bloque(s * 0.004, -0.002, 0.012, 0.020, 0.022, 0.006, 1, 'Pupila'));

      // Grandes brillos especulares
      ojoGrupo.add(bloque(-s * 0.012, 0.014, 0.016, 0.014, 0.014, 0.005, 1, 'BrilloOjo'));
      ojoGrupo.add(bloque(s * 0.012, -0.012, 0.015, 0.007, 0.007, 0.004, 1, 'BrilloOjoPequeno'));

      // Párpados suaves superior e inferior
      ojoGrupo.add(M.tubo([
        [-0.048, 0.006, 0.006],
        [0, 0.046, 0.012],
        [0.048, 0.006, 0.006]
      ], 0.008, 0.006, { segLargo: 10, segRadio: 8, nombre: 'ParpadoSuperior' }));

      ojoGrupo.add(M.tubo([
        [-0.044, -0.006, 0.006],
        [0, -0.042, 0.010],
        [0.044, -0.006, 0.006]
      ], 0.006, 0.005, { segLargo: 10, segRadio: 8, nombre: 'ParpadoInferior' }));

      colgar('Cabeza', ojoGrupo);
    });

    // ---------------- 6. PINTURA: COLORES Y PROYECCIÓN DE AMARGASAURUS_DER.WEBP ----------------
    const TEXTURA = this.textura;
    const proyectar = M.proyeccion(TEXTURA, 0.90);

    const C_OCRE = new THREE.Color(0xd2974b);
    const C_CREMA = new THREE.Color(0xf7dba2);
    const C_CHOCOLATE = new THREE.Color(0x421f0d);
    const MARFIL = new THREE.Color(0xeee3c6);
    const cColor = new THREE.Color();

    // Franjas y marcas de chocolate en el lomo y costados
    const MANCHAS_LOMO = [
      V(0.18, 0.64, 0.02), V(-0.18, 0.64, 0.02),
      V(0.24, 0.58, -0.16), V(-0.24, 0.58, -0.16),
      V(0.22, 0.62, -0.28), V(-0.22, 0.62, -0.28),
      V(0.10, 0.72, -0.20), V(-0.10, 0.72, -0.20),
      V(0.08, 0.62, -0.58), V(-0.08, 0.62, -0.58)
    ];

    // Pintar cuerpo cerrado con proyección lateral de la imagen de referencia y vientre crema
    M.pintar(cuerpo, (i, p) => {
      // 1. Proyección lateral de la textura original
      proyectar(p.z, p.y, cColor);

      // 2. Vientre crema continuo (co < 0 en la parte inferior)
      const u = Math.floor(i / (COLS + 1)) / FILAS;
      const cIdx = i % (COLS + 1);
      const fi = Math.PI + (cIdx / COLS) * Math.PI * 2;
      const co = Math.cos(fi);

      if (co < 0 && p.y < 0.74 && u > 0.12 && u < 0.90) {
        const factorCrema = Math.pow(-co, 1.6) * suave(0.74, 0.44, p.y);
        cColor.lerp(C_CREMA, Math.min(1, factorCrema * 0.92));
      }

      // 3. Marcas de chocolate tostado en el lomo
      for (let m = 0; m < MANCHAS_LOMO.length; m++) {
        const d = p.distanceTo(MANCHAS_LOMO[m]);
        if (d < 0.065) {
          const w = suave(0.065, 0.018, d);
          cColor.lerp(C_CHOCOLATE, w * 0.88);
          break;
        }
      }

      return cColor;
    }, g);

    // ---------------- 7. MATERIALES Y PINTURA DE PIEZAS ----------------
    const COLOR = {
      pataDelantera: 0xc6956b,
      pataTrasera: 0x7a493a,
      pieDelantero: 0xb8865c,
      pieTrasero: 0x6e3f32,
      mandibula: 0xb07e46,
      espina: 0x9a6642,
      puaCola: 0x824e2d,
      espinaPunta: 0xfffaea,
      marfil: 0xfffbeb,
      velaAmbar: 0xf5a623,
      ojoBlanco: 0xf8fafc,
      irisAgua: 0x0ea5e9,
      pupila: 0x0f172a,
      brillo: 0xffffff,
      parpado: 0x986036,
      labioSuperior: 0x7c4620,
      fosaNasal: 0x48240f
    };

    const PINTURA = {
      PataDelantera: 'pataDelantera', PataTrasera: 'pataTrasera',
      PieDelantero: 'pieDelantero', PieTrasero: 'pieTrasero',
      MandibulaBebé: 'mandibula',
      EspinaDorsal: 'espina', PuaColaBebe: 'puaCola',
      PuntaEspinaMarfil: 'espinaPunta', DienteBebe: 'marfil', GarraBebe: 'marfil',
      VelaMembranaAgua: 'velaAmbar',
      OjoBlanco: 'ojoBlanco', IrisAgua: 'irisAgua', Pupila: 'pupila',
      BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo',
      ParpadoSuperior: 'parpado', ParpadoInferior: 'parpado', FosaNasal: 'fosaNasal',
      LabioSuperior: 'labioSuperior'
    };

    const materiales = {};
    function material(clave) {
      if (!materiales[clave]) {
        const esVela = clave === 'velaAmbar';
        const m = esVela
          ? new THREE.MeshPhongMaterial({
              color: COLOR[clave],
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              transparent: true,
              opacity: 0.90,
              shininess: 45,
              specular: 0xffd17a
            })
          : clayMaterial.clone();

        if (!esVela) {
          m.color.setHex(COLOR[clave] || 0xe2e6ec);
        }
        materiales[clave] = m;
      }
      return materiales[clave];
    }

    g.traverse((o) => {
      if (!o.isMesh || o === cuerpo) return;
      const clave = PINTURA[o.name];
      if (clave) {
        o.material = material(clave);
      }
      applyRenderStyleToMesh(o);
    });

    // Pintar piezas secundarias con su proyección correspondiente de la imagen de referencia
    const piezasPintables = [];
    g.traverse((o) => {
      if (o.isMesh && o !== cuerpo && /^(Pata|Pie|EspinaDorsal|VelaMembrana|Mandibula|LabioSuperior)/.test(o.name)) {
        piezasPintables.push(o);
      }
    });

    piezasPintables.forEach((o) => {
      const esPata = /Pata|Pie/.test(o.name);
      const esVela = /Vela/.test(o.name);
      M.pintar(o, (i, p) => {
        // En las patas limitamos Y al tobillo para no tomar sombra de suelo
        const yP = esPata ? Math.max(p.y, 0.14) : p.y;
        proyectar(p.z, yP, cColor);
        if (esVela) {
          // Realce cálido ámbar/dorado de la vela
          cColor.lerp(new THREE.Color(0xf5a623), 0.25);
        }
        return cColor;
      }, g);
    });

    // ---------------- 8. ANIMACIONES CHIBI ----------------
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();

    function giro(nombre, dur, fn, n = 24) {
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        q.setFromEuler(eu.set(x * grad, y * grad, z * grad));
        tiempos.push((i / n) * dur);
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombre}.quaternion`, tiempos, valores);
    }

    function sube(nombre, dur, fn, n = 24) {
      const [x, y, z] = hueso[nombre].position.toArray();
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) {
        tiempos.push((i / n) * dur);
        valores.push(x, y + fn(i / n), z);
      }
      return new THREE.VectorKeyframeTrack(`Hueso${nombre}.position`, tiempos, valores);
    }

    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Reposo: respiración tierna de bebé, alegre vaivén de cola y balanceo de cabeza
    const dR = 2.4;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      sube('Cadera', dR, (t) => 0.008 * sen(t)),
      giro('Pecho', dR, (t) => [1.5 * sen(t), 0, 0]),
      giro('Cuello1', dR, (t) => [-2.0 * sen(t), 1.8 * sen(t), 0]),
      giro('Cuello2', dR, (t) => [1.0 * sen(t), 1.5 * sen(t), 0]),
      giro('Cabeza', dR, (t) => [2.5 * sen(t), -2.2 * sen(t), 1.5 * cos(t)]),
      giro('Cola1', dR, (t) => [0, 8 * sen(t), 0]),
      giro('Cola2', dR, (t) => [0, 14 * sen(t), 0]),
      giro('Cola3', dR, (t) => [0, 20 * sen(t), 0])
    ]);

    // Caminar: trote cómico y tambaleante (waddle) de sauropodito
    const dC = 1.0;
    const PASO = 18;
    const caminar = new THREE.AnimationClip('Caminar', dC, [
      sube('Cadera', dC, (t) => 0.015 * (1 - cos(t, 2)) / 2),
      giro('Cadera', dC, (t) => [0, 4 * sen(t), 3 * sen(t)]),
      giro('Pecho', dC, (t) => [1, -4 * sen(t), -2.5 * sen(t)]),
      giro('Cuello1', dC, (t) => [2 * sen(t, 2), 3 * sen(t), 0]),
      giro('Cuello2', dC, (t) => [1 * sen(t, 2), 2 * sen(t), 0]),
      giro('Cabeza', dC, (t) => [-2 * sen(t, 2), -3 * sen(t), 2 * sen(t)]),
      giro('Cola1', dC, (t) => [0, 12 * sen(t), 0]),
      giro('Cola2', dC, (t) => [0, 22 * sen(t), 0]),
      giro('Cola3', dC, (t) => [0, 30 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro('Brazo' + L(s), dC, (t) => [s * -PASO * sen(t), 0, 0]),
        giro('Muslo' + L(s), dC, (t) => [s * PASO * sen(t), 0, 0])
      ])
    ]);

    // Rugir / Celebrar: da un saltito sobre las patas traseras, alza la cabecita y abre la boca
    const dG = 1.8;
    const alzar = [[0, 0], [0.22, 1], [0.75, 1], [1, 0]];
    const abrirBoca = [[0, 0], [0.25, 0], [0.40, 1], [0.70, 1], [0.85, 0], [1, 0]];
    const rugir = new THREE.AnimationClip('Rugir', dG, [
      sube('Cadera', dG, (t) => 0.04 * M.interp(alzar, t)),
      giro('Cadera', dG, (t) => [-12 * M.interp(alzar, t), 0, 0]),
      giro('Pecho', dG, (t) => [-16 * M.interp(alzar, t), 0, 0]),
      giro('Cuello1', dG, (t) => [-18 * M.interp(alzar, t), 0, 0]),
      giro('Cabeza', dG, (t) => [10 * M.interp(alzar, t), 0, 0]),
      giro('Mandibula', dG, (t) => [28 * M.interp(abrirBoca, t), 0, 0]),
      giro('Cola1', dG, (t) => [8 * M.interp(alzar, t), 15 * sen(t, 2), 0]),
      giro('Cola2', dG, (t) => [12 * M.interp(alzar, t), 25 * sen(t, 2), 0]),
      giro('Cola3', dG, (t) => [16 * M.interp(alzar, t), 35 * sen(t, 2), 0]),
      ...LADOS.flatMap((s) => [
        giro('Brazo' + L(s), dG, (t) => [-24 * M.interp(alzar, t), 0, s * 8 * M.interp(alzar, t)]),
        giro('Muslo' + L(s), dG, (t) => [12 * M.interp(alzar, t), 0, 0])
      ])
    ]);

    g.animations = [reposo, caminar, rugir];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  },

  // Imagen de referencia reducida ×3, sin tinta (RGB en base64) para proyectar colores fieles de amargasaurus_der.webp
  textura: {
    w: 173, h: 119, k: 3, esc: 0.00322, x0: 275, y0: 344,
    datos: "Xz4XXz4XXz4XXj4XWj4dSj8zSD82SEA2SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzU0k7pZmE5de96tzB6tzB693C693C693C693C693C693C693C693C693C693C6tzB59m/q5yIdmZYdGRXdGRXdGRXdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldFZldFZ1lIa2BVa2FXZltPVEk1UkYxUUs8UVFLUVFMUVFMUVFMUlJNUlJNUlJNUlJNUlJNUlJNUlJNUlJNUlJNUlJNUlJNU1NOX1xVWElBYFBBb2FJdGdSYFRJTkRATkNAT0RBbV1Oo5N1rp9ynIZQl4JMkXtOlX5ab2BCTUMrcmdLmo5zeHFkb2lgd29mfm9gX1I7XFM3YFg9UEQ3TUE1UEg1UUo2VEs8altRhHRefnRbeG9Xc2ZLY1A1U0MqVEQlW0kiYEktWkcwUEYuUkcsWkgoXUIlXkAkXkAkZjsocTQtcjQuczQuczUwczQvcjQuazkydWJJg3ZXinZcinZci3Zdi3Zdi3Zdi3Zdi3Zdi3Zdi3ZdnYhmvah3Xz4XXz4XXz4XXj4XXT4ZTj8tSD82SD82SEA2SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzYFdIwLSc6NrA6tzB6tzB693C693C693C693C693C693C693C693C693C6tzB6tzBx7mifW1fdGRXdGRXdGRXdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldFZldFaFtMa2FXa2FXYldJU0cyUkYxUUc0UU5EUVFMUVFMUVFMUVFMUVFMUVFMUlJNUlJNUlJNUlJNUlJNUlJNUlJNUlJNU1NOX1xVWUpCbV1LcmRLeWxWbmFOUkY8T0ZBUUZAXEs6b15CrZptwq9228d51Lt9wqt+eGpJem1Os6aBrqGBjYJrcmhehXtzmY6Bo5h/d3BRgnlfVko9TkEzT0YxUUo1WE9AhnVoiXtienJad21UbFxBWkguUkMnWUciX0koXkgwU0YuUUYtWEgqXEQmXUAkXkAkZD8nbzcscjQtczQuczUwczQvcjQuajYwZkU7em5Qg3ZXinZcinZci3Zdi3Zdi3Zdi3Zdi3Zdi3Zdkn1hs55ywKt5Xz4XXz4XXz4XXj4XXj4XUj8oSD82SD82SEA2SEA2SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSkE0bmRUxrmh6dvA6tzB6tzB693C693C693C693C693C693C693C693C6tzB6tzB2suyiXlqdGRXdGRXdGRXdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldFZldFaV1Qa2FXa2FXX1VFUkYyUkYxUUYxUUc3T0pDUE1IUVBLUVFMUVFMUVFMUVFMUVFMUVFMUlJNUlJNUlJNUlJNUlJNU1NOYFxWY1VKfG1Xd2lQfXBacmNPUkQyUEQ4U0Y5VUItXEwud2ZAalksc18un4JP0LVu8tWa5dKf3NClzb+YoJJxY1ZFaWBUYllLgHJXxbqSz8Gic2ZXV0s4T0QwUEcxZlpLhXZhpJh9l492e29TZFI3VEQqVkYkXUkkYEgvVkcvUEYtVkgrXEYnXUEkXkAkY0EnbzkscjQtczQuczUwczQvcjQubTUvYDk0bFVDfnVUhHZYinZcinZci3Zdi3Zdi3Zdi3Zdi3ZdjHdepI9qvql4wKt5Xj0XXj0XXz4XXj4XXj4XVz4iST81SD82SEA2SEA2SEA1SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzS0I1fHFg18qx6tzB6tzB693C693C693C693C693C693C693C693C693C6tzB5da8oJF/dWVYdGRXdGRXdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldFZlhIa2BUa2FXa2BWW1A/UkYxUkYxUUUxUUUyTUQ6TEU/TUdBTkpEUE1IUVBLUVFMUVFMUVFMUVFMUVFMUVFMUlJNUlJNVVZQcnBono59kYFokYNmjH9nfGxXVEUzU0c1YFE9W0QtVUYzWE06YFA2ZVEyZ1Aob08lh2M4vp1Y68+J9uWowLOJb19LYVg/W1M4Xk8xcWI+mIpk2siavbOOaFtDV00xYFU+al5Gc2hQkotuw7WQemdJX08vXUokYEksW0cwUUcvVUgtW0goXUIlXkAkY0QnbT0scjQtczQuczUwczQvcjQubTUvYjczYD43dWRLf3ZVhnZZinZcinZci3Zdi3Zdi3Zdi3Zdi3Zdl4JjuKN1wKt5wKt5Xj0XXj0XXj0XXj4XXj4XWj4cSz8ySD82SEA2SEA2SEA2SEA1SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzT0Y4jIFu3tC36tzB6tzB693C693C693C693C693C693C693C693C6tzB6dvAuquWeGhadGRXdGRXdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldFaFtMa2FXa2FXa2BWW1A/UkYxUkYxUUUxUUUxUEY3TEQ+TEQ+TEQ+TEU/TUdBTkpEUE1IUVBLUVFMUVFMUVFMUlJNVVVQcXJqmpiKpZmDsKSBzL+X1MSnrp2Ad2lSbmJOiHhfYEkxVUg2WE9HbmBVeWhXYk05XEMnYEUgY0kab1sgu51J89OF9N+traiEcmZHX1E1dmtLfm9Ig2tBrpRo5tWbraN7g3teX1lAXFQ7X1M2emhEx7WAtZ5shnBIZE41VUgwXFA2Xk0tXUQmXkAkY0YnbkQscjYuczQuczUwczQvczQubjUwYjczXTk0aEo3fHBOf3ZVhnZainZcinZci3Zdi3Zdi3Zdi3Zdj3pfq5Zuv6p5wKt5wKt5XTwXXj0XXj0XXz4XXj4XXT4ZTj8tSD82SD82SEA2SEA2SEA2SEA1SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzVUw9p5uG5Na86tzB6tzB693C693C693C693C693C693C693C6tzB6tzBv7CZeGhadGRWdGRWdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZldGal5Ra2FXbGJXa2FWXFA/UkYxUkYxUkYxUkYxVk09U0tETEQ+TEQ+TEQ+TEQ+TEQ+TEU/TUdBTkpEUE1IUVBLVFRPcXJqmJmOm5WEdWlRXVEzZlY5gW9UrZ5128Wh6Na1ybuYhW9TYVY6XlZGd2hcl4ZziHVhX04xbFg0ZEopWEMZaUoasotE6sVz9teH8+a2w7ma3NSxy7yTlHtSc1kxkHBA1K1z4dSui4dqcGdLXkwzbFk1kX1M2Ll63sWNnJBsbGFFZ1c4XUgoXkEkZEYncEstczkuczQuczUwczQvdjYxf0E8bD46XTk1Xzwzc1s3fnVRgHZViHZbinZci3Zdi3Zdi3Zdi3Zdi3ZdnIdmvKd3wKt5wKt5wax6XDoYXj0XXj0XXz4XXj4XXj4XUj8oSD82SEA2SEA3SEA2SEA2SEA2SEA1SEAzSEAzSEAzSEAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzXFJDt6uU6Nq/6tzB6tzB693C693C693C693C693C693C693C6tzBv7CYeGhYdGRWdGRWdGRXc2NWc2NWa1tLZldFZldFZldFZldFZldFZ1lJa2BVa2FXbGJYa2FWXFA/UkYxUkYxUkYxUkYyXFRHXVdQT0dBTEQ+TEQ+TEQ+TEQ+TEQ+TEQ+TEQ+TEU/TUdBW1dQj4+EoJ+Si4JuX1M4UEMlU0IpWUkyXE0wXUUwgmk+rpRr38mj3MytpJ6GdGxZhnhilIZjsp5syaqBlndWZ1Eva0wwoXxL0a1ktpFI37dg8tuX+fK98eCw5NCct55xhGU9dlYxsI5Y7NifxLSSemNJZk8zeF84hGc1iXM06NWOxrqMc2A+Y0gqZEcncU8udD4uczQuczUwczQvezo1mFRSjldVYTw4XTk0aEcwfGc3fnZTgHZWiXZb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SkE0SUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzaF5OxLeg6NvA6tzB6tzB693C693C6tzBv7CXeWhSdGROdGRUdGRWc2NWc2NWa1tLZldFblxGgm1Pj3lcdmlabGJYbGJXbGJYbGJYb2NYXVFAUkYxUkYxUkYyW1NFY15WY15WZF9XY15WY15WX1lSUUpDTEQ+TEQ+S0Q+S0Q+TEQ+UkpCU0s9VUw4bWBGmYRgvql8y7iM5dei7NusxbeYjIBoYFg+dWRBjG9Ou5dwx6p5qIthdlkxc1cvcVMpfFktuZlazKtf9t6P9uGgxq56clM1f1czsXlJpW86lWk8fFE3qnZGwGQ7x0sy8KuG8MOm8Lif7K+YrYFmlWdGoE8wxltHmEo9eTIoczIhkzslrj4owVE377qd9d3Cm3puXzs0b00+noJXlYE4gWgmf2oyfnVRfnRSf2lJiXNZi3ZdkXxhtp93wqx7wax6zbqF2cmSzLiDx7J+x7J+x7J+WjgYWjkYXj0XXj0XXz4XXj4XXj4XXEQgUUQvSEA2SEA2SEA3SEA3SEA3SEA3SEA3SEA3SEA3SEA3SkI4UEk9Uks+Uks+Uks+UEk8TkY5S0M2SUE0SUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzSUAzS0E0b2VUy76m6tzB6tzB6tzB693C6tzBv7CXeWhSdWROdmZVdGNWc2NWc2JVbV1Mbl1Gg21Pk3xcinhXcGVWbGJXa2FXbGJYbWJYb2NYXVFAUkYxUkYxUkYyXVVJY15WY15WZF9XZF9XZF9XZF9XZl9WUkpDTEQ+S0Q+S0Q+S0Q+UUtBTEU2Uko2aFxClIFZqpZqoI5kkoNZeG1DxqyI7Nu30dCrko1rY1Y4eGVDoYdg2rSA17B1qIlZfF0xk289upRXu5dQxqFS79OK8uKiyq58y6Nurn5RpnVDpXE6mG9JpnpByGUvwkQryjgw4IRu5qWO55eE2pOAzJmAr3JSo0EysTw/kTUylTg2njkuoUArrEovqE8w6LOY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mm0q1Jk505ontHYmqmwd36JA36E96Kwt4KEo15Yn9sJBzaBO1aBR1p5QsnxZkF9CdkMjjlg4lVs4z5RQ7LBI3p8v7bVY7MFl78lszJ1Qn2syrXVLt4Ben2lMkmFFkVs22Z9j+s1k+cJLy4ss5aQ89LVL6rhL+dJU/M1Zwnkc14kd9K073JEq3pI2w3Qs0IYj2o8xm1AhikYviEorqGEx1IUs6KY1/d+U9MdR98ZL+c5l6cRtvo9Fq3Aj6alDtHIuoWY7qHRTpXJXnWhVsntnlmBOiVtLf1lKgFhKm3Bbm2dSo2VOsXBOtWo02IQ214Q55JVHtnxF2q9z+taZ8smM47d73at33bWK++rIxruncGVWWE4/V049WFA+W1NBbWVSmpJ9zsau6uPK8+7W9vHa9OvW8OPO7+DM79/K8N7H8N7G8d7G8d/G9OPK+OrQ/O7T/ezR/evP+ufK7tm33MCfzamPzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeN0aRt2pwq3JsjyZtDemxJWkgkVkciZFIucFk4aEstaUgrb1Uys51j5sl/+9iB+810+c586Lpu365n3Ktv1KhyzqJux5lsj2hKhWNEmHVVgWNNXUQ0fGBIoYJabkssZUIkYUMhYE0geGc8ZVpGWE9BV05BV05BW1JDg3dbtaN7r49P2q5G5ag72ZEuuXYcqmwZ6q9M4qY9w4Yh9bs6y5Ad6rA26rRL982FuIVFxpFbl2VRglREiFg/iVc7sXpP151Qyos00pE84KdM6sV2/uWp/uCj3bB5m2c/om5Rl2RLjFpBlF87uIFH8btK9bI65KRE9LpPzpAx05sz/NBP6qUpxnUR7Zs34ZIrw3Mg3I8+ql4lzYM335ZDyYE7nFkyhUstkVk4mFkyqmwi472A8NWF8cVL36s25MJt8ceIuYFFt3opw4M0omY9s3lcp2xVlFhFtnxmtH1nk2pakWlcmGlcqnNXu3lYqF4/qFkzplAh1IVD0oxJr3lI1a169dmd9dKh3q521alv0ql08tm0/PLc5tzIem5gVEk8VUo8Vk09V089WFA+W1NBbWVSmpJ9zsau6uPK8+3V9e3X8ufS7+HN79/L79/J8N7H8N7G8d7G8d/G9OPK+OnQ/O3S/OzQ+OXH5cyrz6yRzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeNzqaB2J4725six5g+emxIXUcnWkgkWUkkdmI9hm5JxKZw+diP/d2F+tqG7cR43qpr0KBqto5kqoRdk25Mj21LjGxFjmhGaUYuZUUuhWJFfl9HWkEyWkAyclY/bUstakYngF01sZNV1bt2uqZxkoRgg3dlgHVneW9gemhFsI5F3KlB8rlBw4Qks3IW3p8v3KIo3qM5woMuwo4o+Nd2zZou+MJIz5hK7sGMrnhFsoFbj2hWiWJVglVLe0o3r3xK0pZMxYRBxYM/9Ltv6LRv2qRw7rmH47B4vo1nl2VKkF9KhlQ8nGlFsH5O0JMz354y46I45KZHvn8v+Mdv/MlP5qgk0IUf6aVK14hAs2IZy4E9rGg5s3A04J5M45pJu3cyi04nh0oyjk83rmsttnkw9diP78128rxR7bhP+tKE67h1vX02n2QvmVo8n2NLpGpVh1I+oGlTvoJqn2xblGpam2RQpWI/smc90ohHunIfxHwqxnw/36Jq4LSH99ii99eg3rSA1qV0yaNv79Wq/fHR/vbb+/PevLKhYVVIVEg8VEk8Vkw9V089V089WFA+W1NBbWVSmpJ9zsau6uLK8uvT8+rT8OTP7+DM79/L8N7I8N7G8N7G8d7G8d/G9OLK+OnP++vQ8t7A1bSYzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeL06Fb25slx5g+emxIWkAkXUYmX0wojnpQ1b+H/uGQ9dh+27lj0KJf06JwzZ93sIhjeVg4fl49g2BBf11AgGE8gl4+aEUtXD0odlU6hGNJXkQ0WD8xXEMzeV0+qo5Xz7Jq58Z35cZ55cuE6NCG4ceK0rqT3Mmc3b9r7r062ZYlwHoZvHUc66s297k/1Zkj3p9J0JBC2K1j/tqNuHYi9rpVp2o8yJBjqXVFm25NkGdSk25gfVBHhVVFv49V5K5P46c99LdN/dZ3/tmF6LRp2qRwzZhgu4hioG1UkF5Mg1M7mGdGrnxRvYNC25Yw25Ed3JMqwHgf4p43450l0HoUzIc28LRrxn1DsGMcrGUoi0orh0ccr2807Z5A1Y02ikkXg0YthEUut3gz2Zop9r9X992K6cxw9cNS7rtJ26xTypdOlFwtn2BDsnZhnGFLgEw5eko6rGtOsGxNpmNJoVcwsVslr18p15Y71ps9wIRCzJRd776H5Ld/3a990qR3x5dtvZVq4MWY/OvI/vTV/vXX/vbc8erVlox9V0s/VEg8VEg8VUs8V049V089WFA+WFA+W1NBbWVSmpJ9zsau6uLK8ejR8ebQ7+HM79/L79/K8N7H8N7G8N7G8d7G8d/G9OLK9ubL5s2yz6uRzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeN0KV22Zwxx5g+emxIYEIpX0QohmdEzal1+eWg+NmQ27Jjzp5gyp5ozJ9uy552qIBecVEyd1g4gF9AflxAf2A9gF48Z0UtWTonZkYvhGNHaE07bVZCk4JiwLSA4M6F5c1+68t76Md458l+7NKH99uC88139MpU5K82zooUyIET7K4z4qMp9bc96q0y0Zcw5rFz1JVa2JlO6qRZpV4r0IpUgEYosW1An2I3h1c+jGBQjmlcek9FbD8yj18z051B661E2po757BS78Fk679j9M2O3bJ6uIlhi1tAi1pGglQ9j19AvYhht3pNzYg01Ygu1IsjzogY5KUw7qc7xnIW0JNL1J1hunc+xH4vmF8pkk8zgT0mwII32Zk215Q0x4A+mWA5i08wo2YssXsk05k49b9P8MRe/eaO2KlN67JL2apVr3k6kVo4qHJelV9Mekg4az8vml9CwHpYx25EvGEusmMs1ZBEsnYrr3k+yJZe8cKK0qNvwZJkt4hdqX9ToH5VzLOU8+XG/PDK/vDN/vXW/vXX/vbb3dXBe3BiVUk9VEg8VEg8VUo8Vk09V089V089WFA+WFA+W1NBbWVSmpJ9zsau6eHJ7+XN7+LM7+DM79/L79/J8N7H8N7G8N7G8d7G8d7G79vC2r2jzamPzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeI1p9KyJY2empDdVQ5flw+1p9u8tSU/OGT0qdTxZJYwJBkyJlqx51ry55zs4lmdlU2clM0fV0+flxAf189fl47aEcvWz0qYkUxg2dMinRXxbSH49qj2NOa49eU5tKE6Mx7781968p78NSI9duD5LpN5agwzYgb6qYs7LE47rY60psn/+GA/t5+2LFh1qV2pGI5w18rzWwytHNMsHFOeEMonVg5tWhKlltHj2ZZiGNYfVBHdUU5iVpBsoBEwoNLyYpV3JpY3qVd6MN4/d2k2q95yJxuj15EglNAflM8glU3p3JMwYZcxYRGt3ApvHYdy4cky4Qp2o81p1gS25xPt3hApGEqxoQ8l2Q2kk4xhkImsHEywIEs66M9qGopmmQ8gkwqm1on3p050pMr0JQr27NX/eeX88l2yYhK3rFW68F/pnNMgU05gU47ekg1eUkyfkwzwYVkt29IxHI92o5Fvn0usHc/ypll7sCN78KS2q5+sIRZoHRKoX9SyK6I2sWu7dvE9enL/PHL/vDN/vXW/vXX/PTZyMCtaFxPVEg8VEg8VEg8VEk8Vkw9V089V089V089WFA+WFA+W1NBbWVSmpJ9zsau6eDI7+PN7+HM7+DL79/L8N7I8N7G8N7G8d7G8N3F6dO71bSbzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeM0qNlypMte2g8gFc7u4Rc16pZ/uSX9tB6xZBHqnxGr4FTv5BlxZppyJ1tu5FsfFs7b1Axels8eVo+dVo6cFg1eGBGdWBNdmNPi3hclIJi1cSR9Oit39mg4tue7d2U589/7s598857885w6rpNzZMe1o8c9K808rY+5rRM98BQ1JYv5Kpc0pJJz5RXrHdXklI2rlktvmk4sG5SmV9GeEUtfEQygkU5g0s+imFWiGBWfk5Ei1hMgFJEkWdCpnNNqndGyoxFvn4yu4Y0v5FTuIxZvpFmqnlfhVhEeVE7jWJGlWA8pHBOq3RF6aph4Z4+56Iz3ZIjy38fq2cU6qVNsGYuoFsgtXM7n2tEiUctg0QioF4u4Jg2v4Auxo1QkV81j1g/mV84sHgy7Lli+MNr9dub9tmXzplU0Ztc0qNi9siMyppgiVc6dkMud0MrlWBEjFxDtoFiuIJZyYRL341IsnQw1qptyJ9x7MOW5buQqoBUn3ZJqH9Uza+E7dey6NW659a99ubL9uvL/fHL/vDN/vXW/vXX9+/Vr6aUXFFEVEg8VEg8VEg8VEg8VUs8V049V089V089WFA+WFA+WFA+W1NBbWVSmpJ9zsWu6eDI7uPM7+HM7+DL79/K8N7H8N7G8N7G8N3F6NG41LKYzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeNz6Z+x5Q9e2g8jmFB1ZZex5Q5+9yG6bdevodRpXZEnG8+qnxPuI1hvZZmvJhuo4dcfGRAd2NBZFU1XE8uWUwqcmRHiHhkeWlWiHZckX9hw7OD+Oqs6uKp39mf9uqm7tqN8tN6+89q6KYu1JYjyosczIcg/b9B5KxP1aJT46dN7KNH3Ys1vm8yt3RJjVhAd0Qxi042omVPpGlZilRGeEg3aTkuaDcubz82hl1ViWBXjF5KkGRShVhKkmVNnWpMm2hAzI9J66RI6aA09cp2wJJguoths4Vog1tFb0s2iV9FqHJTnWpKnmxMuoRb4KFY2ZUx45072pI80Yop35Qwyn0pqmgzqGRAll9CmVtBjE8wpWUv1pI3rXEzwItVnWpEiFM8g1E+ekssj10us4AyuJRP9+Cn8NOQxJJNt4FNxpNZ7byEtoVieUgyfks0l2NBnGlNonBPu41iuIJTw35Iy5BdzaBz9MmfyJ91r4dhoHlQrIVW48Cc6Mym7+G3+u/I/PLL/fTM+/PQ/ffW/vTS//LS/vbX/vXX7eXLmI59WU1BVEg8VEg8VEg8VEg8VUo8Vk09V089V089V089WFA+WFA+WFA+W1NBbWVSmpJ9zsWu6d/H7uLM7+DM79/L79/J8N7H8N7G8NzE48mw0K2UzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeKxJhYe2k+pX1hwoNM4KxO9M5x7bpWonc+gV4ud1YmgWAxkHNJn4Vbtp9w38+MopVlfG9LZVo4WE4tV0wpbWBAj4Bqe2tZhXRdkoBiuKh++uuq9uqu5t+k+u+q69F+37BH36Iu3pwi3qAtxIYd05Qy87pUvII/sHdIzYxXwnQ704RGsGk7nmRGhVpGakEvdEMwgk9AgE5CeEg7aD8zZDsvcD8xdEU6f1ZMelBFhFdEi2FMgVZFg1Q+j1xBmWVA2qJn7K5T5aE+zqJOu4xcz592zqGDkWpUeFI+kF9LmV9LomZMn2RIomlMomhAvn082JFFyoZDyo1G4JQ114k0sHE/pWJLkllGm11GilE3sXE/tm8t0ZNbt4VJxJVkuolkiEsoomE0omQqtYAy3KhN269P+tiO+MVq2aFOuH9U2aV+36+Pl2lQckExs35jwYxrnmtPn3BOp3RPr3lKoXFGxZp0uY1mqX9Vq4JYm3RLz6mD6sifzrB028KF/fXL/vjV/vra/vrc/vrc/vna//jY//jY/vfX/vXW5d3DgHVmVko+VEg8VEg8VEg8VEg8VEk8Vkw9V089V089V089V089WFA+WFA+WFA+W1NBbWVSmpJ9zsWu6N7H7uHM7+DM79/L8N7I8N7G79vD4MSszqqQzaiOzaiOzaiOzaiOzaiOzaiOzaiOzaeNzaeNwJx5e2pItY1xsHQ/2qI/3bFR8sVjqYU8cFMeblQihG5Ai3JKoothwKp18+OYxLZ8gXRPbGE+WU8uV0wqaFs5kYJqgnJfm4t0tKKCva2F+Oqm/e2i+OOT6cRewowk4acx77At87Qy5q828rhA2plB2ppGrHE+vYVknV9DvXJSrWM9klM1kFpCeU43c0QqckMsc0EybDkvd0U2cEUzgVI5jlo9eUY0dEg6dE0+flM/hVRBd0o7dUs3j15EqHNPrXlGs3tEvIU22KtfypxqyZpwrYBgn3Vaek46ilNGklhIo19BoVw+mF9Do3BVsXZdvYNS1ZZe149Nv2sqwXJClVg9qGpUqWpYnV5KhU44mFk2uHZGy5Bavo1QwZBNn2gurWAlw20o7J1D+clj/MJb6qlD5qtO9cpe8cFVr3Y3tYFa672fqHtkdEQzeUUtzpl1toVgoHFSrn5grn9ZpHpVpn1an3ROqX9Wq4NWxJ541LGK4b6Ov5NDyqdk/PLN/vjY/vna/vnZ/vnY/vnY/vnY/vnY/vjX/vjX/fbW2NG2jIJvYlZIVUk9VEg8VEg8VEg8VEg8VUs8V049V089V089V089WFA+WFA+WFA+WFA+W1NBbWVSmpJ9zsWu6N3H7uHM7+DL79/K8N7H7djA272kzqmPzaiOzaiOzaiOzaiOzaiOzaiOzaeNzKeNxaKHiHVXnnZar3VC0I8w+L9J3Kg+1LFbtZZSmoRNk31RkXlQq5Ro2MF8/Oyc49WPkYNZdGhEXVMxXlMwal06m41xm4x2r6CD79607Ned17te671F7a87+Lw+2KYy+NBd+clJ+b0287tE1ps0yos25KdcqG9DpXFUhVM9i1M5iVA8l1k7rmxAs24+oVwqsXBEmV4/j1U7pWxIoWc9rHBGm2I/d0MwdUU0dlI/eVRAml1Mg05Bd089iV1DsHpY6buH99Sb9M6FvZNQzaBtsoVbqHtYgFM7ajwpgVA9mmhSm2RGsnBKmVw7lVxBoWdNunlTsmg5yXlGsGQ9jVQ8d0UzoGZLrmtZmV5Oj1pIhUo5omhHzppi3KhV0JMxy38nyW0mwmMh7JY17bNJ+9h97cdo4KxH47VP98JQ0plIn2lLoHNeuI56eks4h0w0rXFJ06N0kmRAnXBTo3dXmnFNnHJPmm9KmG9IrIVcw558v551zKJs0phB3bNV4M+g/ffV/vnY/vnY/vnY/vnY/vnY/vnY/vnY/vnY/vnY/ffX8OrLx7+mi4FuYldJVks+VEg8VEg8VEg8VUo8Vk09V089V089V089V089WFA+WFA+WFA+WFA+W1NBbWVSmpJ9zsSu6NzG7uDL79/L79/J69a/1raczaiOzaiOzaiOzaiOzaiOzaiOzaiOzKeNy6aMoIdqiF9FpGs5xIIw36Eq+LQx36U7zKVNr5RWoIRWoIVZt55n7NOB/u6d+uqdyLh/kYRdgHVQo5lspZlr2s+p6t648tmN6LtS768046Im8q8o1I0e9rhX16FIxZM+4axK6qpDvXwzqmo1vn89qm03n2dDj15AfEkrjFMzlVtCoWZDw4BNvHA2yn5CvHpGq3BFnWM4qXBFunxMyYZUqW9KcT4odkY0fVhGhV1MoWVUiVNEkmdTpXphpm9NvohV26xh8cd63rNy1KVy1KV7zqB7e0ozaTsqaUEuf1dDhltKk15FxXxRu3BFs2c7tWY2u24+wX1SnWZLjltHqXJbpGtPmmFTilhHgVBAgU47nGRKwI1VyJtB67xb+8Jh6Z1Eumkhzn8ovnYdt3wv7sl988Zo3qhQ2ppJ77Vejlo0fVA7nnNfeUk3llI9rmI/5bGAn3JJjF5BnHFSmG5Nm3FPnnRQmnFMzamDlW9TtpZtwJhW4Kc92bNM8uK0/PTS/fTT/fTT/fTT/fTT/fTT/fTT/fTT/fTT/fTT/fTT/fTT+/PR7+bGy8ClnJF7a19QWEw/VEg8VEg8VEk8Vkw9V089V089V089V089WFA+WFA+WFA+WFA+WFA+W1NBbWVSmpJ9zcSu6NzG7uDL7t/K59K71LSbzaiOzaiOzaiOzaiOzaiOzaiOzKeNzKeNt5h8j2VFrXZLomYk5KQ576wv8Kgn9a471pM03aFPxZlI1rNa+t+C/uyb/Oub4Md72smL6tmf++mx7d6Y8NaK8Lle8a44z48d1qEr6rtM/tRj2qVKwIQ/voNJqnFCtXpOrG1AnFo2oF8+lVQtm102j1UujlkyqW1ErnFLpWlJqnNPsHxRvIhWwYtXw5BetYRVpnNGsH5RjFkvmmM8lWBCf1M8gVdBiWRThVxNpmdXfUs5f1VBlWlMr3RKzolO6bNA88dk9s2K365506J1x5dxgVA4aTsqXzwoY0Iuc01AeFFCiVQ6unRSyYNXzINTvXhQoWhKhVI/vIJpu3dbp2dNmWBIiVRBdkg3g0w9lFw+n2024LRl9sp02KJYx4dJxH5C2JJL7p076qAr6qQ36sBZ77pZsm0u2JJSvolnd0s3fVI/fk08mFc9v3BC1aBxr4Nbg1g6l21Oi2FBnHNRm3JOw5t3nn1akmtL38GT3aZX3qYryqhT8eGq8eK48uK68uK68uK68uK68uK68uK68uK68uK68uK68uK68uK68uK68uK68eG56tuzzr6ao5R2d2pVYFRFVUk9VEg8VUs8V049V089V089V089WFA+WFA+WFA+WFA+WFA+WFA+W1NBbWVSmpJ9zcOt6NvG7t7K5M640a6VzaiOzaiOzaiOzaiOzaiOzaiOzKeNx6SJsoZftophoWk6tnQo35449bU68a4w6qMp8Kgw5qEo87VA5K1A6bNM4Z836aYy5aI3vHkh2phB4qhA1Jkq46Yq9bU11JUn88RX8cxs6MBh37Bdq20zsnRDpGc6rG9Dm100llYvk1MtjE4pklgymmU9sHtRvIVauoVbuIVbwpBmz59z3K5/26+D1a2Bzqh9v5hvxZt0rYJbqHZQlGJBgVk+eVQ7jGhXkWdYk1ZFiFNBdUs3g1Y62p1o66lM5Kcr7rU39sBl16FesoFNs4FZlWJGeUYwdEwzgFpAdU4/b0g8eVFEflA8dUgzjltCilc/fEw5tndU05BqrmpKj1Q/k1tEilBEe0g7fEs9h1Q5snxDzJBGs4JIom1CnWJHomRGn2E3qmIn2IIq86k9yIgvyZFArmw+pWQ9zZp1fVI9eE46ekk1pGZEy41c6rmLtotil2xNhFk7imFCimFAj2ZDu5VwjmxKw6KD+uCr4qpTzo0m88xp3MB59N+m9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGp9eGo8t6m5dKdxLGEkH5ebV1IW04/Vks9V009V089V089V089V089WFA+WFA+WFA+WFA+WFA+WFA+W1NBbWVSmpF9zcKt59jD4Mmy0K6UzaiOzaiOzaiOzaiOzaiOzKeNzKeNxJx2xp55wYxqunVOt3QzvHolz44r8bhG+MVI8LM53Zgo1Y8k7Ko25Z43+LU72JYzu3Y4v4E136hK8cyG/dl4+LxA25wx67VMypE1wooy155MnF4momEwmVUkr2o0sG47n14tsHFDomg8wpBky51z2KyCz6R5zaZ817SKyqeBwZ14rotlv5x4oYFdsZJvnn9flHNTpoNlkm5MkXBLhGJHbE85fl5NkGZWomhXtHZlkV9Ljl9EzJBQz44n4p4i9Kgr9ao2t3sn2qtu3Kt+m2dIfUctkmFDvYtriF1JaUM1dE06bEMta0E0hlhLnmlRyYppwYBdnWRFiFI8dUQ0hVFBi09HdEM4cEc2hlI7o2hGp3NOlGlIhVU8kVxAqXROqXRGqGtFqVoxym8xxWoi3Z5Xv4VSgU4ykWRLdEk1bkQwdUQtvoJTyZ5x06d63bOKm3FRkGZIl25PkmpImnRPmnZVvpt4+OfM9NiiuIY435s16Ks+3q5V6sR77MiD7MmF7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG7cqG68iF5MGA0bB1sZZmhHBSZldEWlA/WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+W1NBbWVSmpF9zL+q2MCpzqqQzaiOzKeNzaiOzaiOzaiOzaiOmX1fgWlQiW1WqXhZsnlDu3o/ol8jrm4pzZNB2KJJ0ps/98Fe/chj36hM8bhb1ptXrXFFm2Qt6rh73bN54bVu1p5LzI9DsHMzpmcvt3ZBpGI0p2M5sXA0xnk5x3s0tXM62J9t5a+A47KF3reM78ih8cym58Sf0q+MwZ17qYRkpoJin3xdnHxerI5uiWtMlnZYkXBSjGlNgmFGclQ8dlhCYUcxdFVCjF5NhU8+rmxXnGVOn3BQzpVQ6rA8+71A/LUr9a07wYEx47Br5rSEsX1bhE43jVo/rnxXtYdljmRIeU45h1dGhFhHhlhHi15LkGBQgVBAe0k3cUExb0AydkU4dkc8YToudUo8fUk+eE5BiFtGgFI5e0YvkFYoyY5EtXg7oGRGlFtIolk9pFArtWs60ZBggEw0ekw8cEQ5b0MvhFIx3aVoyppt06SA9Na4sJFumHFPm3NQjGQ/poNftJp66uDD/u/O472Jtn08vHYj56A74alS4K9f47Vo5btx58B46cN96cR/6cR/6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6cWA6cR/6MN/3rt6yKhwpYxhgnBQaF1FW1I/WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+W1NBbWVSl4t2uaCIyaWLzKeNzKeNzaiOzaiOzaiOTEEuTD4rWD8uelxHuJFrv4pVtXhHomM6rW9Aqmo4rGsxw4I33Z1SyI1R77lzwYdKpGkwqWs2wIJUrXJDvoNJun5Apmc0nlwyn10tv3xKtXA+r2czvnc6x4JGz5Jg3ax/3ruNxqR34b6S2LWMyaZ/vpt2wJ16xqSBwZ19xqKDxaKEwp6AvJt/sJB2pIZrp4pvoINnoINpkXNbg2ZPbU45X0Mtbk05iVtJekQyp2ZQilZBeUwwoWcz3qlZ5rNI2Zkh8Ko7wn8y36pjzpxps4Bbf0cqiFE2kWJCu4letYRbfFE7d0o4iltGmmRRnmpaiFRGdkU2bTwubTwubj0wbz8ycEQ3ZkI3eFNGhl1OgFJFhE88hUkosnA14p0/7ag81Yw8s3BFmmZNiVQ8jUwwnVQwn180hVI5eUs7c0g+dEozlWM91Z5f0KFy3raJ+ea/8t7CxaJ+lW9IrYdfvJl19ePF/O7P89etyZhfrXA7s2kj14022ZtH2Z9N26VT3qpa4LBh47Zq5bty58B56cN96cR/6cR/6cR/6cR/6cR/6cR/6cR/6cR/6sWA6sWA6sWA6sWA6sWA6cR/6cR/6cR/6cR/58J+3rt6x6lwm4Zcd2lMX1ZBWVE+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+W1NAa19MnoVuyKSKzKeNzKeNzaiOzaiOSzwqVDwrXEIzfmNPxKeJt49wqHpTqXFDrG9BunZGtGw6wHdByX5IrWQ0vnk7wXs9unI3r2Y2n1gymlc0qmk9rm42pWUvoGAvrW88tnlE0JZk1Z9y1p9136x+5baU2bCMy6R/uZJtsY1oyKiEz6+N0K+Qy6uLqoxupYlwza+Uza+VyamOwqOItZd/q452tZmBspZ+r5WCspiHq498iGlScFM8blA8lm1afUo3rW9Ql2RLd0s6u4JfyoRD3Jwl+bk3+8JTy4U+zJdV26t1s4FajFIwiU0zkGJIpHNVwoxconVMfE00b0AqdUIujVlIilVDckAvdUIygko7gk09cUAwaj8wYkE1bU1BiWZXiF1Mk1Y5uXIu76035qIn55wuznkqwXE4nWhJlGBIik06iFI2g1AsfEk0fEw8dkMxfUwwkV8326hu7MOS9dWg8uOx//Le/eC647+X0KyD5sml/+/R/OPBw5xyxJBcwYRUr2owyIY6xY0+1aFT3atc3qxd365g4LJk4bNm4rRn47ds5bx058F66MJ86cN+6cR/6cR/6cR/6cR/6cR/6cR/6cR/6sWA6sWA6sWA6sWA6sWA6cR/6cR/6cR/6cR/5cF91bR2s5lnh3ZTaV1FXFNAWFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+WFA+ZFlGnYRtyKSKzKeNzKeNzaiOVTwrW0IyY0o6oYdvrZN5f2hSuaGCxqV7vY1luH5PunxJtnpIqWs6r3E5u31Dv35HpmYvr246s3FCuXtPrWxEu4pZ3bJ/5rqJ57uK6r2N5LiM3reQ06mCz6V9xpt00qeBz7GSza+Oy7CTxa+X2r6i17mevqGGdFpBbFM7s5d9za+WyqqRwqOJtZd/q493tZmBtZqEtJqJtp2MsZiErpJ7mH5og2tZnHpmi1pEsnVMsXVUgVFEoWxRu3ow8LI+/MdP+LpHvXYwvYlKwZFbmWdAg0sqgEcsj1xJkV1Kj1ozs4BNoW1BjVYwklc6ikszikw1iUk1oWJQhUk5kVpJgk89ZTwpYT4ud1dIi2tbkmZPnVwi6aQw6K44669C9LBQ5JJFvm85h0otj19Ch1Q+fU85ekw4dUQyfEk3mVY6jlIykl400qp31beD89Of9uOw/vDU89Cq5cCY27qN7Ni4/uvO8c6mroNgq3xYqHNNq201yIg526pa4LJm4LNn4LNn4LNn4bNn4bNn4bNn4bNn4bRo4bVq4rZr47hu5Lpw5bxz5r5358B56MJ86cN96sV/6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6sWA6cR/6MN/3rx7yapxpo5hemtNY1hDWVE+WFA+WFA+WFA+WFA+WFA+WFA+WFA+ZFlGnYRtyKSKzKeNzKeNXEIzXkU2dVxKnoVteGJNdF9KtaOA0riVuZyAw6KFyaF+zKB4yZt1qHpRqHpQrn1UxZZj369716Vx0p5t1KBw3a1+2Kp91Kd6z6NyzJ9vzaV7yKqLzrCRxqqOvaCFp4luyK+WzrWYx66RwKyW1byj2r2ivJ+FblU9YEgwkXZdyKuSyauSwqOJtZd/q493tJiBs5iEtp2MtJ2KspmDsZeBm4RylH5tqIZtlmZNoGBCuHhTglRDom9ZxYtXy4o846E08q8yunMk47Fr0p9qrXhTgkgofkgsiFU9mmdIk185kFwxp3FDlV03tnhUtXVRq2pIqGVHn15Fh046lmVPlGBKfFA6Z0Qygl9LlnBalF09qWEg56Ms6rA87bVRwIE1q25AjlQxi1I8iVY4h1U+flA8fE48fEw6fEk0l1Q3lFc3nmk/t45e2LmF8tGg++O9+urB1LKJxaF29dqu++jH582twqF+mm1NjF0+ll86llcg0JBC8bpj7Lpn5rdn5LVn47Vo47Vo47Vo47Vo47Vo47Vo47Zp47dr47hs5Lhs5rxx6L9z6L906cF26sJ478qC78uE78uE7sqF7MiE68eE68eE68eE68eE68eE68eE68eE68eE68eE68eD6MSC2rl8vKFulYJcg3NUbWFIYFZCWlI/WFA+WFA+WFA+WFA+ZFlGnoRtyaWLzKeNXUQ1X0c3eGBMdWBLbFdDfWlSwq2Kt5x/knlglXljmXlejW5Opohptpp4vaKCvaKD3L2a2rmVz66KzaqEz6yI17OO3biUupl5xaSE2LiVyq2MhnRghXRgf21ccV1MeF5HoYhxzLSaxq6Qv6qVz7eg27+kvaCGblU9XkYucllBvaCHyquTw6SLtZd/q493sZZ/spiFtp6MspqGs5iBrpSAlH5tnoRvtZF0rIBkjU041JVdqXlXlWdXpGpUrGo/044p/LdCz4Qp67BPxpNUtH1YlVk5hU0wg1E0qXtbr4NesoJTrXpJoGxHpG49rng+qnM5vYJQpWtGkVk5mmlFq31aqX1hb04+fFhCkWZKilAvun0wzpUv+sBcwYY6omg5lV06ll83mV80k1c3g0oyfEk2dkQ3g0s2gUMsnVg2qm5FwZBkto9h3LmL7sme99aw4cSOn3tS1bGF27qM0bSKr5hxlG1PjF1Dek83lFo3qWkv3qhF8sBf88Bm8r5n8rxo8bxo8b1p8b5r8b9t8cJy8cV18ch68ct/8cyB8cyB8s6D8s+F8s6F8c6G8M2H8M2J78yK78yK78yK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7cqJ6ceI48KE1LV9u6FwnolhinlXcmZLY1lEXFNAWVE/aV1KrpF5y6aNXkU2Y0s7a1ZCbFdDbFdDjnpfuKCBknlgi3FajnJcfWBEfF9BemFGfWdNbVpFb1tHu6GGup+EaVJAYU03po1y0bKUv5+AcVY+eV1HwqOEwqaHaltIWkw9Y1NGZ1VHcllDgWhRvKWMyK+RwKqTyLKc3MCmv6OJblU9XkYuZk42q452yqyUxKaNtZd/q452r5N+s5mIs5yJspmDs5iCp497l4Btro92tpR5sIxzjVY/xoZMuINWckg6kVs/x4469LYz/Lkzw3YdvXkfyZZUqXBGn2NDjlY7e00yi2FIhGNHk25Mt4NfpXNKrHpF2p9gzpRWqHpGu4BPw4FQ0phjqn9amHNadVNCfllEh1ZCh0ws1adU8M95rHkxmmUvh084iU03r3c367RVsnNBj1QvfUcsd0Ath0YufT8qn2NBvIhfvpNpwJht5LuS7cae3LiCtZBflW9KxqF1wZxrw55wtppymXVWe001h1Y9pmgx2ZtJ67NG8rxf875m88Br9MRx9MZ19Ml69Mx/9M6C88+E89CF89CG8s+H8s+H8c6I8M2J78yK78yK78yK78yK78yK78yK78yK78yK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK68iJ5sWH2ryDxKx7q5p0lYxyiYJsjX5pxKaNYEg4aVNAa1ZCbFdDbllFmoNom4JoiXFZjHJch2tUclY4dVo9c1xCbllCWEY1Yk48hW5ZclpIVD4uVUEtiHFZxamNmn1hYEYwX0QxnYBmv6OFaVpHV0o6YFFDZlVHb1hEdlxFnYRsxq2PwquRwq6Z2r+mwqaMblU9XkYuYEcvkHVdx6qSxKaNtZd/q453r5R/s5uJspqGs5iBspiCpo15q495s5Z/spZ/sJJ9lmpTu3hG0IpUfE47iVQ8xo44+Ls8+LMtyX8Z5KUyt4ZAomtBm109pWhLf1E2e1E3bE43e1tEjmdNrINhtodbuoNSsnpFuYQ/qHE3pm49rXlKlWpCgl0/e1VDimZOmGNHs3dA8b9N2q1EvII4kFcti1QzzZlc7L1W+8dN0ZU8tHY/hk4meUEilU0zkU45qHJVwZVzs41oxJtx47mNzaZxsYxeoHtTroZhupRovZttvZlwsJBukG1YiV5KkVw3x4s18rdH4K5B7b9i88l3882A88+E89CF89CG8s+H8s+H8c6I8M2J78yK78yK78yK78yK78yK78yK78yK78yK78yK78yK78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL78yL782N8M+R8dOX89qj9eCt+Om8+e7G+fLP9/HT8enO6NzE8ODKZ1E+a1ZCa1ZCbFdDcVxHjndei3NaiXFZjXJdgWVNb1I0cFc7cltBZ1M9V0U0YE07Yk07VT4vUj0sU0AsdF9Iu6CFiG1UXkUvW0Aud1tGtJh7aVpHV0o6X1BCZVVHbVdFc1pDgWdQt56CxKyQv6uW1byjxqqQblY9XkYuXkYufWNLwqSMxaeOtZd/q453sJaBspuIspmDs5iCspiDsJaBsZeCspaBspF+sIp3oHJfmFo404hGjVMrnWxSrnU63J4897Uwx30b6qw/0qlcr3lArWo4q2tKekMsdEMsYkMwcFE8eVg/l3RXs4tpw5t3wZZxvJNjvpRmu49jroVXkm9KdlM3fVZEnnZeqnZGvYI55aNGzpA5nWMvh08rnmU098dk9cA+7bYq3Z4utnUrgEYciU8qols+m1xCmXBToXxcsolkzaF0upBYqoRQoHtXlXJMvpFhvptyuZxzq4hjiGBMg1xPhVlEmmQw46ZD4aUz3rVX68l69dKI9NKJ8s+J8M2J78yK78yK78yK78yK78yK78yK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK7suK78yL78yL78yL78yL782N8M+R8dOX89qj9eCt+Om8+u/G/PbS/fnY/vrb/vnb/vbb/vTa/vLb/vLd/vHe/vHfa1ZCa1ZCbFdDbFdDdV9KiHBYiXFZinFajXFce15DblIzcFc7cFpAYU46VkU0YEw7XUg3UjssUj0sUz8rY085rpR7hWtSXkUvW0AuZEk2nYJoaVlHV0o6XE4/ZFRHalZGc1lDdVxEm4Jnw6qNv6qVz7egyK2Sb1Y+XkYuXkYubVQ8t5qCxaePtpiAq493sJeDspqFs5iBspiDspeCspaBspF+sIt4roRzq4Bvo3dlhk8zyog5rnM1fE03l2RGnV41048t15EgyYYqtoQ/tHM8x35Kk1I0eUArc0ArZUU0ZEYzdFM7hmRKmXVcuZN5p39knXlWl3NOpn5Ypn1adlM5eFM8gFpGnHNaqXQ54KlO3Jk0zYxBh0okjVEl26BC98BC+MAx9r0x2JMo04cwp2Asl1Y7kVxCiF1BjWpNnnVOrX1SsIFWsIJcn3hTlHFNoHZQsolku5dxspNvgFpBbkMydko8iVY0xos99rk/9rk/8dF98M2H78yI7syJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suJ7suK7syM78+Q8dOX89qj9eCt+Om8+u/G/PbS/frY/vzc/vzd/vvd/vnc/vfb/vTa/vLb/vLd//Hf/vHg/vLg/vPd/vTYa1ZCa1ZCbFdDbVhDfGVPiHBYiXFZjHJci29ZdVg8blI0cFg9bVc+Wkg1VkU0YEw6W0Y1UjssUj0sUz8rWUUwm4JqhGtSXkUvW0AuXUIvf2VPZlZEV0o6W00+ZFRHZ1VHcVlDdFpDhWtTu6GDwKqTyLKcyq+VcVhAXkYuXkYuY0szpYlxxqiQtpiAq494sJiDspmCspiBspaBspF+sIt5roV0q4Jxq4JxrINwqn5qjllBqGwv2p1FhVEviFc7pGw8z41D0pEz3Z852qJGz4dAu3M6mFo5gks1fUw2aUg2Y0MvbEszfVtBhmNEnnhVo3pXonpNpHpPmW5IfFI2fVhBf1pFh2JNjmZMsno7x4sxwn8zs3E7omNA2qJG67E+9boz+8Qx6a0q1Iwn2oQrx349n2ZCjmNIkWZJm29Op3hMpHhIpHpXqYJmq4hts5Fqq4ZgrYVksIlokmxSakAtZzwohVY1qXE25qk69rsv7bEs1bhk5MR17sqB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uB78uC78yE786H8dKP89md9N+o9ui5+e7E/PbR/frY/vzc/v3e/v3e/v3e/vzd/vnc/vfb/vTa//Lb//Ld//Hf//Hg/vLh/vTi/vXf/vXZ/vTS+/DLbFdDbFdDbFdDclxHhG1ViHBYiXFZjXJdh2tUcVQ3blM2cFk+alQ9WEY0VkU0X0w6WEIyUjssUj0sUz8rVUEshG5WgmlQXkUvW0AuW0AuZEs4XE08V0o6WUw8Y1NGZlVHb1hEc1lDeF5GqI5ywaqQwq6ZyK6UcVlAXkYuXkYuX0cvkHVdxKaOtpiBq5B5sJiDspaAsZF9sIt5roZ1rIRyrINwroRvsIRsr4Joqnxhl2dKmGM2xYhEilQwgk40qXA9rnAwxos6wo9CsX5BuXo8rG0ymV46fEkzfFJAY0tAXUEvbEw1f1xFiWVJiGRDlG5Nk21LimNEgls+gVo+g19EhWBIh2FNiWBIr3hDuoE5qWlCo2JBr3I15a076LI28r0y+sQ3z5Uf7Kkqz3gqr3A2gFY5gls/i2JElGpIpIJerZNxpotsqo50r5V9uZl4so9nq4NhoXhejWRRhFtIiFxHiFc0t4A49LdG+cA09bss+OCP68d37MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV47MV57cZ57cd878uC8dGN9Nue+OWy+u2//PXO/frX/vzb/v3d/v3e/v3e/v3e/v3e/vze/vnc//fb//Ta//Lb//Ld//Hf//Hg//Hh/vPj/vbj/vfg/vba/vTS+/DL9+rF9ObCbFdDbFdDbFdDe2ROiHBYiXFZinFajnJegWVNb1Izb1Q3cFk/ZlI7VkQzVkU0X0w6WEIyUjssUj0sUz8rU0ArcFtEfGNKXkUvW0AuW0AuWkEvV0g4V0k5WEs7YlJFZVVHbVdFc1lDdFpDk3lfwKiMv6uWyK+We2JKXkYuXkYuXkYufWNLwKKKupyErZJ8sJJ+r4p4rYZ0rYRxroRvsIRsr4Joq35jpXlennNYlGxShmJHhFk6nGk4kl82gkw4rXJArHIwwo07v41CsX9Bqm0vqGowmWJBilhEfFZIYE1GX0Y6cVA8fFpDjWlOh2JChF4+l3FQlnBRlW5RkWtPi2VKiWNKjmhUkWlSt4hYr3xHmmE4pWo226Q97Lcx8L4i/stB+MQ53KQp4Z0dxHUvoGpCe1Q6flc7f1o+fV1CnYJmsJZ5rJZ4rJR7rZV+t5p8tpRvnHdXhl5Li2FQi2FPglVAkWA1r3gv3qA6+8E28rcp1rNf5rpk6Lxq5bts5Lpt5Lpt5Lpt5Lpt5Lpt5Lpt5Lpt5Lpt5Lpt5Lpt5Ltu5bxx5b506MR/6sqL7tSc8+Cv+OvB/PXQ/vrZ/v3d/v3e/v3e/v3e/v3e/v3e/v3e//ze//nc//fb//Ta//Lb//Ld//Hf//Hg//Hh//Li/vXk/vjl/vni/vfa/vTT+/DL9+rF9ObC9OXB9OXBbFdDbFdDcFpGgmtUiHBYiXFZjHJcjXFde15DblEyb1Y6cFk/ZE85VUQzVkU0X0s5V0AxUjssUj0sUz8rU0ArX0s1cVhAXkQvW0AuWkAuWkAuWEc2V0k5V0o6YFFDZVRHalZGc1lDdFpDf2VNtJt/vqqUyrKbjHJaXkYuXkYuXkYubVQ8tpmBwqSLwqWKwqGIu5Z9upB2u5B0t4xvrIBlpHhdn3NZmnBWjmhOgl1DeVM5dUsvj1w0rHhMrndLzZNStn42zZZRuYU6y5JM35tMsXI/j1s+gU8/d09CY01FZEw9eF1IhWpSiWZPiGJIi2dGimZInXlcn3pdk25SkWtPiWJHjWZRimFLl21HlmM5lVwtwok34qs747Aoy5Yc9MA/+sVE+s5b3I8nwXQ7m3BRgWROclQ+fVlAg2FGj3RYq5B1r5d6rJV8rJR+qY10j29Vakg2YTsxcEg7e08/g1RAiFQ0uYI63Z84/cQ4+L00++CR8cJk8L9f7r5i671n6bxp5rpq5blr5Lls5Lpt5Ltw5b5258J+6ciJ7dGb8t2x9efD+fLW+/fb/fvf/vze/v3e/v3e/v3e/v3e/v3e//3e//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vHg/vHh//Pj/vfm/vrn/vni/vfa/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXBbFdDbFdDeGJMh29YiHBZiXFZjXJdi29adVg8blEzcFc7b1k/X0w3VUQzVkU0Xko4VD4uUjssUj0sUz8rU0ArVUIsXkcwXkQuW0AuW0AuWkAuWEY1V0k5V0o6X1BCZFRHZ1VHcVlDc1lDdlxFoIdsvqmRw62YjHNaXkYuXkYuXkYuZUw0sJV53cKf582m582l48ih4sWf5MSf48Ge2LST0KuLxJ5/tY1vqX9jpHleonZconFVn2ZBs3hMy49Iu3o6v4VA5LFh06VYuopJyI0+sXlEi1k/f04/eks+bk1CcllGhm9Zk3pkj3JdpopulntZlHRSl3JUqIBjoXhbkGVLkGpNj2dRjGJLkmU5oWo3tXY105Y10JUx+sg7+ck488Iw7bYx5aMrwXQrwHhEn3FSgmdTcltIeVhAgVxBh2hNnoNosJZ5rJV7mYBrcVZEWj0tVjcpWjUrXjgvc0g6gVA9hVAxsnoyyYko8rQ625wt6L5u879r875q875q8r5r8r5r8b5t8cJ08suF89ae9OG39ujG+vHX+/Xe/fvp/v3r/v7p/v7k/v7g/v7f/v7f/v3e//3e//3e//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDh/fHh/vTk/vno/vvo/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXBbFdDb1pFgmpTiHBYiXFZinFajnJeh2tUcVQ2blI0cFg9blg+XUo2VUQzVkU0XUk4VD4uUjssUj0sUz8rUj8rU0ArW0QtXkQuW0AuW0AuWkAuWUQzV0k5V0o6XE4/ZFRHZlVHb1hEc1lDdFpDjHJZu6SLvqmVjXVdX0cvXkYuYEgvg2tO3cSd+eC19t2y8diu7dSq69Go6tGo69Co7c+p7s6q7cyo5sKe1KuFxJZ0toRprXhcmF84qms1x4A2um8zuH00zpZI57lo/t+a3q9Zr3tDjlo/iVdHildIiFtLg2hTk3xmlXtmnYJssJp+qZV2uZ6DrJB3mn1itJl5tZl5waCCmXJdg1Q8p3MzuHgv0Iw1y4or2p8+8b1A6LhC67o66agwx2cbyHRGxX1Vr3dUhmlTcVxLdlhCfVlAg2FFj3RYqo90m4BoaU08VjkqVTgpVTcpVzcpYDowckc6i1hEjVU1snczyoovyogwyYY106ZZ4Kxn4apr4Ktr361t4bR068iK+OKv/fPT/vnl/vvq/vzs/v3u/v7t/v7q/v7k/v7g//7f//7f//3e//3e//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDg/O/h+vDi+fLk+/jo/vzp/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBbFdDdV9Khm9XiHBYiXFZjHJcjnJegWVNb1IzblM2cFk+bFY+WUc1VUQzVkU0XEg3Uz0tUjssUj0sUz8rUj8rU0ArW0QtXkQuW0AuW0AuWkAuWUMyV0k5V0o6W00+ZFRHZVVHbVdFc1lDdFpDe2FJq5N6vqmVoYlxYkoyX0cvgmlN172X++G2/eS4/eS4/OO4+uG29t2y8diu7dSq69Go69Co7c+p7s6q7Mii4LaMyZd1nWdLlV4zmlom0YBBqlwytnA4yHwv76BF7qJI6qZTtnVBnF89pWtZpWtapGtamXJemoFrk3hjqI52q5d8qJZ5uZ+Hqo92oIVpwayKybGNyqWDn3FbilY2oGYZ7KpF04ov458725ws8rk3+MFA2p08v3smv2M5zXpb0IBfyH9cm29Vcl5Mc1lFelhAgVxBh2hNknZdbFA9VjkqVTgpVTgpVTgpWToqaUI0eUs9i1dAlFo4p2o5tXk7y5RM159gwYxW2KRn3bBx3rZ55ceL8t+q+/LM/vrj/vzq/vzs/v7u/v7t//7q//7k//7g//7f//3f//3e//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDg++/g+O3g9e7i9/Pl+/np/fzp/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBbllEf2hRiHBYiXFZiXFZjXJdjXFde15DblEyb1Q3cFk/alQ9WEY0VUQzVkUzWkU0UjssUjssUj0sUz8rUj8rU0ArWkQtXkQuW0AuW0AuWkAuWkIwV0g4V0o6WUw8Y1NGZVVHalZGc1lDc1pDdVtEmH9mu6eSn4lzZEw0gWhN1LmV9tqz+d21+t+2++C3/OK3/eO4/eS4/OO4+uG29t2y8diu7dSq7NGp7c+p6sefy5dkpGw8mmQ4ml8w1IhXtGlDoVU5vWg52YRHxnk8vntEmFs1klc7nWROo2pWpmtZpW9dm3pmj3Rgl4Btgm9gfGhcgmxgg2telX1nw6uEzqduyJVbo24/jFAo5qNB77BGxoQtzIcqyIYd0Y0m2JI2sWgkv3Q6vnJRxHdby3tgz35gvnlcgmRQcltId1dAfVlAgmBEclZAWDsrVTgpVjkpWDoqWzsrXTwraUAwd0Y4gUw0kl04omxEq3VOpnRNqXhLlmQ5x5ZX6MmL8+Cn+/DB/vjb/vvp/vzs/v7u//7t//7q//7k//7g//7f//3e//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDg++/g9+3g8+vg8+3i9fLm+vnp/vzp/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBdF5Jhm5XiHBYiXFZinFajnJei29adVg8blEyb1Y6cFk/ZlI7VkQzVUQzVkUzWkU0UjssUjssUj0sUz8rUj8rU0ArWEIsXUQuW0AuW0AuWkAuWkEvV0g4V0k5WEs7YlJFZVRHZ1VHcVlDc1lDdFpDhWtTs56In4p0hGtQzrKQ8dSv9dmy9tqz99u0+Ny0+Ny1+d21+t+2++C3/OK3/OO4/OO3+uG29t2y8dit68qayo5DxY49mWI1nGc9t3hRpWNFmlQ8q187n04gkkgiiEsue0Usik43kVdAl19HnmZPompWlGpbdV1UaFNOYU1JX0tIX0tIYExIbFZOrYlazZtTzppOxI1Ej1Emz4Qx25pEt3k7r242q2kvo2MrlFUqm18xpmo+snNQtnNUv3Zax3lfyXtgqnFZeV9MdlhCelhAfVk+ZUUyWjsrXj0sY0AvaEIxa0Qzb0U0dEU0eEc4ekgvi1szilgzmGJCqXJBzZhS6bZl7L9w+uuv/vPL/vri/vzs/v7u//7t//7q//7k//7g//3f//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDg++/g9+3g8+rg8Ong8ezi9vTn/Pvq/vzp/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBfWZQiHBYiHBYiXFZjHJcjnJeh2tUcVQ2blEzcFc7cFk/ZE85VUQzVUQzVkQzWEMyUjssUjssUj0sUz8rUj8rU0ArV0IsXUQuW0AuW0AuWkAuWkAuWEc2V0k5V0o6YFFDZFRHZlVHb1hEc1lDdFpDeF5Ho4x1w6yS0rWU58il6suo68yp7c+r79Gs8dSv89aw9dmy9tqz99u0+Ny1+d21+t+2++C3/OG3+9+z58CH2J8426M6qXBCkV88ll9Bll1JnmBIm15EmFU1j0glh0sve0UtiEs1jlA6j1U+kllBlF9IgF5UcFlWbldUalRRZlFOY09MYUxJY01IkG1NwJNZx5hYu4hJlFstvnA6ol0nnmI/qnVRqnNKm2M+lV06iVYzhlQ0mWdHpG5Os3VSwHxayH9gxX9hnHFXfF9IeVdAdlI7a0UzbkY1ckk4d0w7fVA/hFRDjlhHll1Lg1BAfEsyk2E5hVEsmmFBsndD0Jo9+MZb78Rd9eSp/vfi/v3t/v7t//7q//7k//7g//3e//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vDg/vDg++/g9+3g8+rg7+jg7unh8u7k9/bo/Pvq/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBh29XiHBYiXFZiXFZjXJdjnJegWVNb1IzblI0cFg9b1k/X0w3VUQzVUQzVkQzVUAwUjssUjssUj0sUz8rUj8rU0ArV0IsXUQuW0AuW0AuWkAuWkAuWEY1V0k5V0o6X1BCZFRHZVVHbVdFc1lDdFpDdltEn4Vs3sGh6Mmm6Mmm6cqn6cqn6cqn6cqn6cqn6suo68yp7c+r79Gs8dSv89aw9tmz+Nu0+dy099mu2ahp6ag53qE+mV81ilgwh1I4ekQxf0k2hVE9jFQ9hU86gVBAfU4/g1BBiVA+jFE8j1U+ildDc1hSb1hVb1hVblhVbldUY0tHWkE8Wz86YUE3iWNHvI1ct4RSlV89wnRIoVo8ml87jVk2m2c/l141mGA7nm1NmWpDpHNLtoFTy5Nd05xm06Bs1KFuzp9ruZBfmXJNiV5Ji11Kk2VSmWpXnW5bonFepXNgpnRhpXNgh1ZHekoxmmY+hk4pkFY2sXg98b5H+8xJ7sJb9uSp+/Pf/v3o/v7k/v3g//ze//nc//fb//Ta/vLb/vLd/vHf/vHg/vHg/vDg++/g9+3g8+rg7+jg7ejg7unh8u7k+Pfo/fzr/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBiHBYiHBYiXFZinFajnJejXFde15DblEyblM2cFk+blg+XUo2VUQzVUQzVUQzVT8vUjssUjssUj0sUz8rUj8rU0ArV0IsXUQuW0AuW0AuWkAuWkAuWUQzV0k5V0o6XE4/ZFRHZVVHalZGc1lDdFpDgWdOxaiI5MWi6Mmm6Mmm6Mmm6Mmm6Mmm6Mmm6cqn6cqn6cqn6cqn6cqn6cqn6suo682p79Gr89Oq9tOi151R6qU3zYcxmV42n18wnF05cTsqYzcrYTovb0IzdUg5elBGfVNKflNKf1NJgVJHhVNEgFVHblZRbFZSbFVRa1NPbVJNaEpFYEI7Wzw2VTYxXDw0oHZVwZFnh1c6nmA/m1k4p2w93Z9S1JdDwoU5x4xJx4xQu4BCzJNa1qBn16Zt16hv2alt3Ktr36xp4Kxn1KJltoZrsoJus4NvtINwtINwtINwtINwtINwsYBtk2JNk15Cnmc7pW1EkVY4n2Yp9cA/+chD+9Jq9OOv+fLQ/vrc/vnc/vfb//Ta//Lb/vLd/vHf/vHg/vHh/vLj/PHj9+7i8+vg7+jg7Off7Ofg7urh9PHl+vnp/fzr/v3q/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBiXFZiXFZiXFZjHJcjnJei29adVg8blEyb1Q3cFk/bFY+WUc1VUQzVUQzVUMyVD4uUjssUjssUj0sUz8rUj8rU0ArVUErXEMuW0AuW0AuWkAuWkAuWUMyV0k5V0o6W00+ZFRHZVVHZ1VHcVlDclhBdFpAjHFUnYFktJd3tZh5upx9z7GQ1LaU2ruZ48Si5MWi58il6Mmm6cqn6cqn6cqn6cqn6cqn6sqm58KV2JtL6qhCuXMwnVs0wnIwtWsygUotaj4uZDksckAucUEvcUc4fFJGflRKflRKflRKflNKd1JKa1BLbVFLbk9JbUxGbUxFbElDZUM8Xj03VTYxVjcxgFtIt4tplGVKg041klMxmF0vzI8987lQ1Jw616FK4q5g7bln3adl26ps3Ktr36xp4a1o4q5o469p5a9q4q1sxJNxtodztYZztYZztYZztYZztIVysYJwoXRhg1VAmmRIvYZR36h0m2I9mWIm8LlA9Lwx7Lo16s15+vLF/PLV/vLb/vLd/vHf/vHh/vLj/vTm/fXo+vTo9O/l8Ori7Ofg6+bf6eXd6+bd8/Dk+vnq/v3r/v3q/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBiXFZiXFZiXFZjXJdjnJeh2tUcVQ2blEyb1Y6cFk/alQ9WEY0VUQzVEMyVEIyUjwtUjssUjssUj0sUz8rUj8rU0ArVEErXEMuW0AuW0AuW0AuWkAuWkIwV0g4V0o6WUw8Y1NGZFRHZlVHbldDalA4X0UsXUMqX0UsYkguYkguZEowb1U6clc9fWJGkHNXknZZqItstph5x6iH0rKR2bmX37+c4sGe4sGe2LKG4KRRwIInnFwppl02zXQ4tGQrjk0veEMscz4pcjkmeUIshFdAh1tGiF1JhVpKglhKgFZKd1FJbUxFbUxFbUxFbUtFbUtFa0pDZUM8Xz43VzcuVzYtYj81gVxNlWpWgEwwmV05nmU7pG0t4a1G+MZWzp437L5g5cF246pb4q1k465n5a9q5rBr57Fs6LBt6LBt561szZhwtodztYZztIVzsYNxrYBvpntqoHVlmnBfhVlFoGlNxY1T+cSGv4tZlV8t0pg16q0q+sA07sZd9uq+/vHW/vPg/vTl/vbp/vns/fnu+PXr8u7m7uni6+bf6OPb49/V4d3Q6ebX9vXk/f3r/v3q/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBiXFZiXFZinFajnJejnJegWVNb1IzblEzcFc7cFk/ZlI7VkQzVUQzVEMyVEIxUjwtUjssUjssUj0sUz8rUj8rU0ArVEErXEMuW0AuW0AuW0AuWkAuWkEvV0g4V0k5WEs7YlJFZFRHZVRGZU86X0UsXUMqXEIpXEIpXUMpXUMpXUMqXUMqXUMqXUMqXUMqXkMqYEYtYkgva1A2cVY7gGRIk3ZZqIlqu5t6xJ9y2ZxMoWEli1MrmFEvzXM6rGMunVspiVElklcqg0YqlVpBlWNMkWJKj2JKjmJKjWFKi19LelVKcE9KcE9KcE9KcE9KcE9KbEtFYkE6XTw0WTkuWjktY0A2dFNHoXlpg1E0qnM3z5dQt3E60Yoz67hD+9Ja/Nlt99yO6blv5K1l569r6LBs6K5s6Kxr6Kpr6Klq6Klr1p5vsoVxqn5up3xso3lroXhqoHdpn3Zom3NkkGVRpGxNtnlJ8Lp+6bl+mWM1oGEq2pk687ox+tBI/N2Q//PQ/vrq/vvw+/nv9/Tr8e3l7Ofg6OPb4t3T2dXI1tPD4d/N8vHf/Pzp/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXBiXFZiXFZjHJcjnJejXFde15DblEyblI0cFg9cFk/ZE85VUQzVUQzVEMyVEIxUjwtUjssUjssUj0sUz8rUj8rU0ArVEArW0MtW0AuW0AuW0AuWkAuWkAuWEc2V0k5V0o6YFFDZFRHYlA/XUUtXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEIpXEMpXkQqYkgucFU5rIZbrm8zmVsvjVU0n2A6vm87jU8qjlIroGEooWMqgkMklmJOmWhUmWdSlWRNkWJKj2JKjmJLgV9SeVxVd1pTdldSdVVRdFRQbE1IXj44WTgwXTwyY0E2Yj80aks+l29hmWdTklgy46lOyIdAxHU03Jo84a5G4LhJ6Mdi+tqR4qdi5qlo6Klq6Khq6Klr6Kxu6LBz57V43LF8roVvoXhqoXhqoHdpn3ZonHRlmXFhl21emWxerXdkqmpG26Js98qDw5NaomUzvnwo77cu78Qt6cpP/u3B/PXs9vLp7+vj6eXc4t3T2NTH0M2909C+393K8fDe/Pvp/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9+bCiXFZiXFZjXJdjnJei29adVg8blEyblM2cFk+b1k/X0w3VUQzVUQzVEMyVEEwUjssUjssUjssUj0sUz8rUj8rU0ArU0ArWUItW0AuW0AuW0AuWkAuWkAuWEY1V0k5V0o6YVJDdGBOd15Cb1Q2ZUotY0grYEUoX0UoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoX0QoY0grqYJYqGk6lVkykFY4pGg8xYVMjFYrlFswq2cyp2MxnF1DonBcm2tYmGhWmWhVmWdSlWVNkWZRiGpfgmdff2RcfWJae2BYeV1WblBJXj83Xj02Xj01ZEA1bkk+blFEjmlaoW9bmGA9tnw32JxKq2YtxXovy4oz2qM3+M9Z+uKZ6q9v5Klr5axu57J157d7572A58CF6cOJ58OOvpd8oXhqn3ZonHRlmXFhlm1elmtdmGtfpHVnr35rq25SrnBB6blx5LV3j1Umz5FA5q8o4rEv58Rd49KR8Ozc4t7T2NTHz8u7zcm31tK/6OXR9vXi/fzq/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9uXB9+bC+ObC+ebC+ebCiXFZinFajnJejnJeh2tUcVQ2blEyb1Q3cFk/blg+XUo2VUQzVUQzVEMyU0AwUjssUjssUjssUj0sUz8rUj8rU0ArU0ArWUEtW0AuW0AuW0AuWkAuWkAuWUQzV0k5WUs7f21X0LKN48KX17eNxKR9tJVwnH1cj3BRe1xAdFU5a0wzaUsyZkgwZUcvZUcvZUcvZUcvZUcvZUcvZUcvZUcvZUcvZUcvaUoypnhYt3hPnGA6k1k2p21ClVsuilIpj1UrlVgriFIsnG1SqXxpp3loonJgm2tZmGhWmWlWnnVlnX90lnlwj3Nqim1lhWphgGVcc1ZMaUlAY0E5ZEE1Yj8rck89dVNFkG1dp3lhk2A9rnhEw4hCxog7qmof1oUz9LdW6r1U0LNu8M2V5rh85rx/58CE6cOJ68eQ7suZ8tOk9tyy3cOlpH9umXFhlm1elmtdlmpdmGteo3NmrHtrrXxorHpgomRArXZC57J8ml80tXkz8Lo69sEu+NBp38R27ebMwb2rxcGu29fD8OzY+vfk/v3r/v3q/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9uXB+ObC+ebC+ebC+ebC+ebC+ebC+ebCiXFZjHJcjnJejnJegWVNb1IzblEyb1Y6cFk/bFY+WUc1VUQzVEMyVEMyU0AwUjssUjssUjssUj0sUz8rUj8rU0ArU0ArWUEtW0AuW0AuW0AuWkAuWkAuWUMyWUs6fGpU1LeQ99ap+deq+deq+deq99Wo9NKm7syh48GX17WLxaF4vpluo4BbmXZUhGJHfl1EfFxDdFQ+b1A7b087bk86bk86b086dVI5mWhGqGg/nmM6omc8p29JgkkjjFMqllwyml06lF5EqnpjrH5nq39pqX1rp3loonJgn3FerIh5rY2AqIl+o4V6nX92l3lwj3JpfV5UclBFaUY5dVE8iGRFgFw/d1Q6l3Vaw52AqHJQiE8usnpHv3cyv3spzn0h9bdN5rBN065g59aa68iM68eR7suY8dCh9Ner+OG4/OzH/vTT8+rMr5F/lmtdlmpdlmpdmWxfo3Nkq3pprn5pr4FosYNprnhflVs1voVTtHhNtXg74Kc79b0w77dA99Ny5tiq3tbD7OXR+/bj/v3q/v3p/vvj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9+bC+ObC+ebC+ebC+ebC+ebC+ebC+ebC+ebC+ufD+ufDiXFZjXJdjnJejXFde15DblEyblEzcFc7cFk/alQ9WEY0VUQzVEMyVEMyU0AwUjssUjssUjssUj0sUz8rUj8rU0ArU0ArWEEtW0AtW0AuW0AuW0AuW0AuXEQyfWlS1LeQ99ap+deq+deq+tir+deq+deq+deq+deq+deq+deq+dao+NSk9M+c8cqT5r2G4biA27R9x6Jyu5druJRos45kr4pgrohdr4RSwYpO1o9Psmoxpmo9nGRAjVUvkFcti1EoiEsslmFMtIZ1uo17uIx4s4dyr4Nvq4BusYl3v6GQvZ6Ot5iJspKErY2Ap4h8m3pvf11PfFlFc1A3hWFGjGZJg15AimdE1baO6cqns4Vqll4/h1Ewr2o32o850IYc6KIh4p4067xm/eWn9Nio9Nap9tuw+eS9/e7K/vXU/vjZ8u3QwLigh3FikWhblmpdmm1fpXVlrHxproBosINps4VstodvtIZvmWtMrnRNtHNQuXhF6q5F+r847qwr78Jb2cSA6N+7/Pbh/vzo/vrj/vfb/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9uXB9+bC+ObC+ebC+ebC+ebC+ebC+ebC+ebC+ebC+ufD+ufD+ufD+ufD+ufDinFajnJejnJei29adVg8blEyblI0cFg9cFk/ZlI7VkQzVUQzVEMyVEMyUz4uUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVkAsWkAtWkAtW0AuW0AuXUEvf2NL1LWP99ap+deq+deq+tir+tir+tir+tir+tir+tir+deq+deq+deq+deq+deq+dep+dal+dOf+NCX9syQ88mL7sWI6MGG47yC3bV90qdtw4hC1opEr2YxmFsxjVYvjlgvlVwxjVMpiE0smWVOr39suIp5vZCAvpKCvpOCvJGAwJ+NxaqYxaqYxKiXwaWUvJ6OspKDl3VkdlRCh2RMf1w+iGNHiWNHjWdMrIhk99eq6sylrohwkGhVdkgvkFYwwXw50okx/btI8LRH8sJL+td8/em5++e//e/L/vXU/vja+/fY39m+nZN/a15PY1NGgWBTnG5gqHdmrX5pr4JosoRqtYZutolxtY11sYx1qH5qkV1Ci1E2omc51Z487rY92Jkn57ZR4cZ11sSO+/TX/vfa/vTT+/DL9+rF9ObC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9+bB+ejB+efB+efC+ebC+ebC+ebC+ebC+ebC+ebC+ufD+ufD+ufD+ufD+ufD+ufD+ufD+ufE+ujIjHJcjnJejnJeh2tUcVQ2blEyblM2cFk+cFk/ZE85VUQzVUQzVEMyVEMyUz4uUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVUAsWkAtWkAtW0AuXEEufmJK1bSN99ap+deq+deq+tir+tir+tir+tir+tir+tir+tir+tir+tir+tir+deq+deq+deq+deq+deq+dep+dal+dOf+NCX982Q88mM7sWI57x+1JBAyH46oV4tr29GmmM6r3lPp29Bhk0hiVAvk19Gp3VgqXhkq3pnrX1qsYJwtop4wqORxauYxauYxauYxauYxKqXwKSSpHxnhF9LhmJJg15BimZJl3BVmXNXn3lU1bOF7c6kwKGGlHdicU82fk0zqGs9rm0kz48s2p4t37A01a5a8+Ks/vXS/vja/vrb8u7QwLigfnJiYlRHX1FEX1FEbVhLoHVjroBosINps4VstodwtYt0s452q4hzn3xrl3JikWZSeUgyhFAxqHIqzpc35q9MzZ06471i6smA+OS0/PHL+OrG9ebC9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9OXB9eXB9+fB+ejB++nB/OrB++nB+ufC+ufC+ufC+ebC+ebC+ebC+ufD+ufD+ufD+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezXjnJejnJejnJegWVNb1IzblEyb1Q3cFk/b1k/X0w3VUQzVUQzVEMyVEMyUz4uUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVUAsWkAtW0AuW0AubVE8x6eD99Wp+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+deq+dep+dal+dOf986U8b142IY7o1sfm1srsXA1xYRDqm47pGw+i1MnjFg1oG9VonBYonJbonJdonNfpHRhqHtovaGMxKuWw6uWw6uWwKmUuqOPr5aCo4BpflpCh2NKgVxBimVJjmdLkGpMqYReyqd56see1LWRln1kiW1XglU/iVAp1Z1F5qg82J47w5JEzKpR382K8ejF/fjZ7ebKoZeCa15PX1FEX1FEX1FEX1FEYlNFjG1YsINptYZutolxtY11r4x1o4Btl3Nkkm1ekWxckmhUeks1fkw2wIU/9blD7LFB5q9K7LRdy6JQ1Kpr+ue9+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+uvE+urE+urD+unC++nB/erB/uvB/evB/OnB++jC+ufC+ufC+ufC+ufC+ufC+ufD+ufD+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZjnJejnJejXFde15DblEyblEyb1Y6cFk/blg+XUo2VUQzVUQzVEMyVEMyUj0uUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVUAsWkAtW0Aua086uJh18s+i+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn+NWn9tGi1p1iw3c0nF4qjVcrtHs+tXw9pWw9klotk1sslWM/k2JNkmRQkGVTkGVWkGZXkWZXk2pbsZOAwaiUu6OPspuHpo99mYJxhW9ff2ZWiWdPhmFJh2JIk29TimNHkWpMrIdg4L2K68iZ7tCptJmBj3BegVdCjFM0s3k51Zc1ypAv2qxK6cZn8dWH/eq/8uXJoJKAZlhKX1FEX1FEX1FEX1FEX1FEYFJEeWFQr4NstYtzso12qIVwmnZlkm1ekWtclG1cm3FeonVgnm5VkVo7w4ZH56RF7KpQ2JhMxINBxYpIvYZH9dur/uq+/uu+/uu+/uu+/uu+/uu+/uu+/uq+/eq9/em9/Oi8/eu//u3C/u3D/uzC/uzB/uvB/uvB/uvB/OnB++jC+ufC+ufC+ufC+ufC+ufC+ufD+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZj3NfjnJei29adVg8blEyblEzcFc7cFk/bFY+WUc1VUQzVUQzVEMyVEIxUjwtUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVEArWkAtZkk4poJq5L2W7cac7cac7sed88yg9M6g9M6g9M6h9c+h9c+h9c+h9dCh9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi9tCi882e1ZtjtW04h1EpfU8sonBFqXdHp3ZIkl41kVw2kF4/iFpJjGJUjGNVjWRVjWRWjWRWkmlYq4dys5SArI57qYt4pIVzmHpof2NScVNCimdOjmlQgFtBnHhcpoFlnHpcroxq0699vJtu69W12MSplXNgiltIj1k6tX47wIEy4ac/361E47NW1aZW06x2zbqceWtWb2JNb2JNb2JNb2JNb2JNb2JNb2JNeGdSpoVtrYlyn3tolG9fk25emXJhpHllq31nrn5nrn9nqnddk1w3rnFD15FRvXcwpGAmo14rpGIsunw+5cCH/t2n/t2o/t2p/d2p+9yo+Nqn9dak9NWj8NGf8tSk9tyu/Oi7/uvA/uzB/uzB/uvB/uvB/OnB++jC+ufC+ufC+ufC+ufC+ufD+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3ajnJejnJeh2tUcVQ2blEyblI0cFg9cFk/alQ9WEY0VUQzVUQzVEMyVEIxUjwtUjssUjssUjssUj0sUz8rUj8rU0ArU0ArVEArZEk3lHBjupCEw5mKxJuKxJuKxp2M0KiS0qqT0qqT1KyU2reZ3Lmb3Lmb376d48Wg5Mah5Mah5sqj6Myk6Myk6Myk6c6k6c6l6c6k6M6k6M2k6M2k6M2k6M2k5cmfsYtapGA5f0oofFEzlGZDlWc9hlk0flAufUstgU44hFVFh1pLj2RSl2xWo3ZYrYBav5BdwpZqsY13sIx3r4x3r4x3r4t3qYZxkWtZlXBWkGxRhWBGiGNJj2xRpYdloH9gtJBlwaN3y7mV6Nq8x6yZi1tIhlA1llw2t3VFwYI22J1M3KBSyI5Kzptg1beOgW9RdGNHdGNHdGNHdGNHdGNHdGNHdGNHd2VJkHRcmHRil3Fgn3dkrIFrtYhwuItyuYtyuItxtYhvrH5li1k8klQ8qWM3vnY3uXQzunYyyYA055tG77Vr9MJ/8sWH78iQ7ciT6caS6caS6seS7s2Z9Nin+uS4/eq+/uvA/uvB/uvB/uvB/OnB++jC+ufC+ufC+ufC+ufD+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3ajnJejnJegWVNb1IzblEyblM2cFk+cFk/ZlI7VkQzVUQzVUQzVEMyVEIxUjwtUjssUjssUjssUj0sUz8rUj8rU0ArU0ArX0k1k3Bit46Du5GGvJKHvJKHvJKHvJKHvJKHvJKHvJKHvJKHvZSIvZSIvZSIv5aJwZqLwZqLwZuLxqKPyaaRyaaRyqmS0bOX0rWYxquMvKGCtZt8s5l6sph5sph5rJFxkmtKjVE3i1IwpXVMuY5ntYdlnW1Kj104fkwweEUzfUw6m2hJtYJWw5Bb0p9e26hg3qph06VquZR5tpJ6tpJ6tpJ6tpJ6tpF6r4hwmXNamHNZmHRZkGtRsYxys5FnrY1pqo5pwqh8xbOPjoFn0cKypn1rfEg1jFI7sG5Kt3VBsG44uXdExYRUwn1JwpFogWREb1Q2blQ1blQ1blQ1b1U2clg6fmZJmINns5uCroZws4dvt4txuYxyuIxytolwsIRsqH1mn3ZflWxVg1M4k1c+sm5CtW0vv3k2wH021Io3+KpS7rRq572C5sGM6cWQ7MmS8c6V9dSb+d2o/ea3/uq//uvA/uvA/uvB/uvB/OnB++jC+ufC+ufC+ufC+ufD+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ajnJejXFde15DblEyblEyb1Q3cFk/cFk/ZE85VUQzVUQzVUQzVEMyVEEwUjssUjssUjssUjssUj0sUz8rUj8rU0ArXkk1kXBht46Du5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5KGvJKHvJKHvJKHvJKHvJKHvJKHvJKHvJKHvJKHvJKHvJKHvZOHvZOHt46BrIR3nXdpi2ZXfFhJcU4+bEg3hFdDiE86ilA0l2A7mWlEiV89lGA6rHJClF04klo9rnRIw45YzJhe16Jg3qpg36xj47Z06cufyaiRvJeDvJaCvJaCvJeCu5eCsohzm3FUoHdarodsrIdtnHpirYxtzK+SyrKXtp2FqJF90ce03dPGtZF+g048eDwui0colVEpkk0ltHFFxYNUxYRJyZljimc9fl41fl41f183hmhBoIViv6mK3syw8+TI9OLHyaSKuIxytYlwsIRsqH5mn3ZgmG9ZkmlSjWNLiFxEgVE2gUcqzotc1Y9C6KlG4qo65p5H6qRM7sFs78qJ9NCU+Naa+9ui/OKt/ui4/uu//uvA/uvA/uvB/uvB/OnB++jC+ufC+ufC+ufC+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ajnJei29adVg8blEyblEyb1Y6cFk/b1k/X0w3VUQzVUQzVUQzVEMyU0AwUjssUjssUjssUjssUj0sUz8rU0ArXkg0kXBht46Cu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGu5GGupCFuI6DsYh9p35xj2RWjVZDkFU3kVY3mFw3mmU0mWxArnpI4ath16JdmlwyzopPzJVZ1qFe3qpi4bFr68aR9+XF+/Pc28SwvZqGvJiEu5iEu5uGu5+IspZ9nn1kkW5XoH5krIhsp4VrnH5nzbOd6tTAoIp2uqSQ18e05NbGqoBpfUc0eDsuk1Anq2c5rWk7sm9AvX0/3Z5U2qRkw5hjuJFgupZnxq6D28uo9OTI/O7T/vDV/vHW/O/Wzragkm1biGNShWFQi2hTjWlRjGhPi2ZMiWJJh1xEg1E4kVg3w4FP0Yw98bRQ/MlY6LVexopA5sJr7MqN/N+o/uWy/ui6/uq//uvA/uvA/uvB/uvB/OnB++jC+ufC+ufC+ufD+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ajnJeh2tUcVQ2blEyblEzcFc7cFk/blg+XUo2VUQzVUQzVEMyVEMyU0AwUjssUjssUjssUjssUj0sUz8rXUcyjGpZsYd5tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9tYp9sod6eU03j1ZCkl4xy5RC87xjpG9GoGo+z5tJ6rlftIJPl2E4xY1J3qtn6MKK9Nu2/O/X/vjj/vjj7+HMw6OPu5uGu5+Iu6KKuqKKsZd/nn9plXdiooZxsZWBuaGOvaWRvqiV076r0r6sx7GexrWk697NroJpiFI6g0YsvHpBr2wxxYRHyYhP5KZY5KtQxo1Q0aV027mM7Nmx+/DO/vHV/vHW/vHW/vLZ+e/X29O9k4R1W0E5WD01WT42X0Q6a09Bel5LiGxUj3JYkHFXil9DsnZUyYZVvnozx4kz8L5X479komwx7MV2xahx++W1/ui9/uq//uvA/uvB/uvB/OnB++jC+ufC+ufC+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ajnJegWVNb1IzblEyblI0cFg9cFk/bFY+WUc1VUQzVUQzVEMyVEMyU0AwUjssUjssUjssUjssUj0sWUQwhGJQpnpqqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqn1tqXtshVA8ekcuhVYwzJtA67pXnm09l2c/0qNa16db1a18jmFGqYFR5MOg+uvT/vTf/vji/vfh/vTc+OrQ0Lifu6KKu6KKu6KKuqKKr5R9nX9qnH9qsZWBu6KPx7KizLinw7Kiy76x7d/R1MKx0MCx0LampnNci1I6l1s287hgunY4255F05hHxIY24bJUo2811LSJ9ufA/fTT/vLW/vHW/vLZ/fPb7eXPta6cd3BiYFNIVj01Vjs0Vjs0Vjs0Vjs0WT01Y0c8dllJlHFbiVxAunxZzItavHk+uHc34KpJ3rlfqnw91KVe79CT/eS4/um//uvB/uvB/OnB++jC+ufC+ufD+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ajXFde15DblEyblEyblM2cFk+cFk/alQ9WEY0VUQzVUQzVEMyVEMyUz4uUjssUjssUjssUjssVj8vdVdFnnNkpXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhpo3lqn3hqjmhVd0k1fUs0uo1c1apv0Kp4mmxMrIBay6h+5suntpV3n3lasY5x8+LK/fLa/fDW/O3R/OvN++nL48+zvqaOu6OLuqKKuaGJqY13nX9qpop1uJyIwquayLWkyrenvq+gyb2x8uba4c/CuZaFqHdknGVPiE02omU+7q9Wo10p0JBBzY9Dp2cs7r1lw5VazKh3+OvH++3R/vLY/vXc+fHb1tC8kox8aGFTYFlMXlRIVz83Vjs0Vjs0Vjs0Vjs0Vjs0Vjs0Wj83iWhcnmVMs3NQzo1ctXM5r28y3KNC9shj3bRvtINK7M6F/OWx/erB++nC+ujC+ufC+ufD+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3a/u3ai29adVg8blEyblEyb1Q3cFk/cFk/ZlI7VkQzVUQzVUQzVEMyVEMyUz4uUjssUjssUjssVT0uc1REnHFipHdopHdopXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhppHhppHhpo3hqoXpsnnttmnhqjWtZdks5dEU0nnhd38Khx7KSt5Z7l29bwZ14/e/T5NO4uZp4q4tmzraU+unM/OrO/OrO/OrN/OrN8+DEybKZu6OLuqKKt5+HpIdxoYNuspaBu6CMxrCgybWlyLamt6mcyb2x8eTY1bepr3tqq3Vkpm5Yklg9q25E6q9Yi0oexoc+669jpmc36Llm4LdvvpNcwqiC8uXK/vbf7ujTta+ed3BiYltOYFlMX1hLX1ZKWEM6Vjs0Vjs0Vjs0Vjs0Vjs0XkI6dllOo4BxrHRYqWdFvHlQo2g5mFki0pZI78B189aevJtoxKZ2+Oa++ejE+efE+ufE+ujI++nN/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/ezah2tUcVQ2blEyblEyb1Y6cFk/cFk/ZE85VUQzVUQzVUQzVEMyVEMyUz4uUjssUjssVT0uc1NEm3FipHdopHdopHdopXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhppHhppHhppHhppHhpo3hqoXpsnntunXtumnlqlXRkgl1MbUUzgV9Lqo501cKl+/La2seypoNypYt07eLL8+bRyK+QvqN/3can+ufP/OnR/OnR/OnR/OnR+ufP2cOrvKSMuqKKtJqDoYNtqIp1t5uHvaORx7OiybWlxLOjsqWZyLyw5tPHwpqOtod6tYZ5sIBunGBEmFwo7bpokVslx5JF9sRqxJFTwJFRzadllHFHybGK/Pbe6uTPn5iIaGFUYFlMYFlMYFlMX1hLX1dLWUY9Vjs0Vjs0Vjs0XkI6dllOmnlqs496vJV7uIhvrXhfilU6ilk7iVAnqnlSv6B7+fDU1MKlsZZ469u69OTA++nL/OvT/ezX/ezZ/ezZ/ezZ/ezZ/ezZ/ezZ/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/eza/ezagWVMb1IzblEyblEzcFc7cFk/b1k/X0w3VUQzVUQzVUQzVEMyVEMyUj0uUjssVT0uc1NEm3FipHdopHdopHdopXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhppHhppHhppHhppHhpo3hqoXpsnntunntunXtumnlqlXVlj21cdE07dFA9ooVtrpV9xrOh/O/f38y7sJSCuqeS7OLN+/Hc4M60yrGP4syt+ufP/OnR/OnR/OnR/OnR++jR7dnCxKyVuqKKr5R9oIFsrpF8uZ2JwKiVyLSkybalvq6gsKSXxLWpzKyguIt/toh8tYd4rn5qpHRZqH5VwZxmrH1IyZ5ovZliqYNRrYZi3cOet5d1t5Nt2M6vm5ODZl9SYFlMYFlMYFlMYFlMX1hLX1hLW0tAVzw1XkI6dllOmnlqs496vJZ7v5Z6v5R9tIh0qoBqjmRMkGRImWhJpn1fuJx51MSp7eHLvp5+18Wl9OjO+erY+uvZ+uvZ+uvZ+uvZ+uvZ+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uva+uvaeV1CblEyblEyblI0cFg9cFk/blg+XUo2VUQzVUQzVUQzVEMyVEIxUjwtVT0uc1NEm3FipHdopHdopHdopXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhppHhppHhpo3hqoXpsnntunntunntunXtumnlqlXVllHNigl5McEk2knNdq5J7pZB7xbSj++7g7d3Nwq2a0MKu7+TP/vPe9unS2sSk482u+ufP++jR++nS++nS++jR++jR+eXO18Gqu6OLqY13oYJtspaCuZ6Kw6ybyLSkx7Wlt6mbr6KWt6CUuY6Ctol8tYd4rn5rpXderIduuqKK7t3Cvpt7v5x88Ni8spd6wZ+C4c2z3sSqxqeG2s24wLesgnpuZl9SYFlMYFlMYFlMX1hLX1hLX1FGdVlOmnlqs496vJZ7vpd5v5Z6wJV+vJB8rIJuqoBrmG5VnW9TonRZsI1wv6WG1MSp3djHtJp/18Oj+PDa+Ora+OrZ+OrZ+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+OraclU3blEyblEyblM1cFk+cFk/bFY+WUc1VUQzVUQzVUQzVEMyVEIxUz0tb1BBm3FipHdopHdopHdopXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppXhppHhppHhpoXpsn3tunntunntunntunXtumnlrlnVllXVkkG9edU48fltHpox1pY96pZF/xbSk++/h9+rb2Mm22Mu38OTP/vPe/fLc59W4486v+ufP++jR++nS++nS++nS++jR++jR7NjAvqaPpIdxpYdytpqGu6CMxrCfyLWlxLKjsqWZr6CUtJCEtol9tYh5r39spHVdqoVsu6KMy7Sf7ODK5dO5yK6R49G659W+x6qRx6yU28Sr1bqd7+HU9evj49nQsqmfdGxgYFlMYFlMYFlMYFhMa19RqYh0vJZ7vpd5vpd5v5Z5wJV+wZSBtIl1qX9rqYBqnnNZonNXpHhdtph7yrOWw7aiaWNbYFVJwLKY+PPc+Ova+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora+Ora"
  }
});
