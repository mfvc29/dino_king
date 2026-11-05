/**
 * Mini Ampelosaurus (Tipo Agua) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte oficial de Dinosaur King:
 *   assets/dinos/arte/agua/ampelosaurus_der.webp
 *
 * Características anatómicas del Ampelosaurus:
 *   - Titanosaurio rechoncho y tierno con colita enroscada en «C» hacia abajo.
 *   - Cuello erguido y estilizado a ~65°, cabezoncito alegre y expresivo.
 *   - Racimos de cristales facetados dorados / amarillos (osteodermos) a lo largo
 *     del lomo, cuello, cola y costados, con material facetado y degradado luminoso.
 *   - Patitas cilíndricas rechonchas cerradas en cúpula dentro del cuerpo (cero huecos).
 *   - Mandíbula inferior estilizada y articulada para rugir, con dientecitos de marfil.
 *   - Ojos grandes anime con iris azul agua / turquesa brillante y destellos de luz.
 *   - Proyección lateral de textura oficial de ampelosaurus_der.webp con piel turquesa/aguamarina,
 *     pecho y vientre claro continuo.
 *   - Esqueleto con piel deformable (M.pielConHuesos) y animaciones completas (Reposo, Caminar, Rugir).
 */
registrarMalla({
  id: 'mini_ampelosaurus',
  categoria: 'mini dino',
  nombre: 'Mini Ampelosaurus (Agua)',
  icono: '🦕',
  origen: 'assets/dinos/arte/agua/ampelosaurus_der.webp',

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

    function bloque(x, y, z, rx, ry, rz, curva = 0.5, nombre = 'Bloque', segA = 12, segB = 10) {
      const sW = M.seg(segA, 8);
      const sH = M.seg(segB, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const l = Math.hypot(px, py, pz) || 1;
        const d = Math.pow(Math.abs(px), 2.5) + Math.pow(Math.abs(py), 2.5) + Math.pow(Math.abs(pz), 2.5);
        const f = 1 / Math.pow(d, 1 / 2.5);
        px = (px * (1 - curva) + (px * f) * curva) * rx;
        py = (py * (1 - curva) + (py * f) * curva) * ry;
        pz = (pz * (1 - curva) + (pz * f) * curva) * rz;
        pos.setXYZ(i, px, py, pz);
      }
      geo.translate(x, y, z);
      return M.pieza(geo, nombre, sW, sH);
    }

    function punta(camino, radio, nombre, segL = 12, segR = 10) {
      const c = M.curva(camino);
      const tSeg = M.seg(segL, 8);
      const rSeg = M.seg(segR, 6);
      const geo = new THREE.TubeGeometry(c, tSeg, 1, rSeg, false);
      const pos = geo.attributes.position;
      const P = new THREE.Vector3();
      for (let i = 0; i <= tSeg; i++) {
        const t = i / tSeg;
        c.getPointAt(t, P);
        const r = radio * Math.max(0.001, 1 - t * 0.96);
        for (let j = 0; j <= rSeg; j++) {
          const k = i * (rSeg + 1) + j;
          pos.setXYZ(k,
            P.x + (pos.getX(k) - P.x) * r,
            P.y + (pos.getY(k) - P.y) * r,
            P.z + (pos.getZ(k) - P.z) * r
          );
        }
      }
      return M.coserNormales(M.pieza(geo, nombre, rSeg, tSeg));
    }

    function almendra(rx, ry, rz, nombre = 'Almendra', segA = 16, segB = 12) {
      const sW = M.seg(segA, 10);
      const sH = M.seg(segB, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const k = 1 - Math.abs(px) * 0.35;
        px *= rx * 1.05;
        py *= ry * k;
        pz *= rz * k;
        pos.setXYZ(i, px, py, pz);
      }
      return M.pieza(geo, nombre, sW, sH);
    }

    let semilla = 77;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return (semilla - 1) / 2147483646;
    };

    // Cristal prismático facetado con caras planas (base embutida en la piel)
    function cristal(base, dir, largo, radio, nombre, lados = 6) {
      const d = dir.clone().normalize();
      const a = Math.abs(d.y) < 0.9 ? V(0, 1, 0).cross(d).normalize() : V(1, 0, 0).cross(d).normalize();
      const b = d.clone().cross(a).normalize();
      const giro = azar() * Math.PI * 2;
      const irregular = Array.from({ length: lados }, () => 0.82 + azar() * 0.36);
      const anillos = [[-0.22, 0.9], [0.42, 1.0], [0.74, 0.86], [1.0, 0.0]];
      const sesgo = a.clone().multiplyScalar((azar() - 0.5) * 0.25 * radio);
      const pos = [];
      anillos.forEach(([h, k], fila) => {
        for (let c = 0; c <= lados; c++) {
          const ang = giro + ((c % lados) / lados) * Math.PI * 2 + (fila === 2 ? 0.25 : 0);
          const r = radio * k * irregular[c % lados];
          const p = base.clone().addScaledVector(d, largo * h)
            .addScaledVector(a, Math.cos(ang) * r).addScaledVector(b, Math.sin(ang) * r);
          if (fila === 3) p.add(sesgo);
          pos.push(p.x, p.y, p.z);
        }
      });
      const m = rejilla(pos, lados, anillos.length - 1, nombre);
      m.material = M.materialFacetado();
      if (typeof applyRenderStyleToMesh === 'function') applyRenderStyleToMesh(m);
      return m;
    }

    // ---------------- 1. CUERPO CHIBI CONTINUO Y 100% CERRADO ----------------
    // Eje medio titanosaurio: [z, y, semiancho, altoHaciaArriba, altoHaciaAbajo, forma]
    const EJE = [
      [-0.78, 0.58, 0.000, 0.000, 0.000, 2.0],  // Punta de la colita cerrada estirada hacia atrás (estilo Amargasaurus)
      [-0.75, 0.54, 0.038, 0.040, 0.038, 2.0],  // Remate estilizado curvando suavemente arriba
      [-0.66, 0.48, 0.070, 0.075, 0.070, 2.1],  // Cola media estirada hacia atrás
      [-0.52, 0.47, 0.115, 0.125, 0.115, 2.1],
      [-0.38, 0.47, 0.165, 0.175, 0.165, 2.2],  // Base de la cola
      [-0.22, 0.48, 0.220, 0.240, 0.240, 2.4],  // Cadera
      [-0.05, 0.47, 0.250, 0.260, 0.270, 2.5],  // Vientre rechoncho y panzón
      [ 0.12, 0.50, 0.230, 0.250, 0.250, 2.4],  // Pecho y hombros
      [ 0.22, 0.56, 0.160, 0.180, 0.160, 2.2],  // Base del cuello
      [ 0.28, 0.68, 0.120, 0.130, 0.130, 2.1],  // Cuello erguido (~65°)
      [ 0.34, 0.80, 0.110, 0.120, 0.120, 2.1],  // Cuello superior
      [ 0.40, 0.92, 0.120, 0.130, 0.130, 2.2],  // Nuca
      [ 0.48, 0.96, 0.145, 0.165, 0.135, 2.4],  // Cabeza / Cráneo chibi
      [ 0.58, 0.94, 0.125, 0.135, 0.120, 2.3],  // Frente del hocico
      [ 0.65, 0.91, 0.085, 0.095, 0.080, 2.3],  // Hocico tierno redondeado
      [ 0.70, 0.89, 0.000, 0.000, 0.000, 2.0]   // Punta del hocico cerrada en domo suave
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
      for (let k = 0; k <= 400; k++) {
        const u = desde + (hasta - desde) * (k / 400);
        const d = ejeCurva.getPointAt(u).distanceToSquared(p);
        if (d < dMin) { dMin = d; mejor = u; }
      }
      return mejor;
    }

    function uEnZ(z) {
      let mejor = 0;
      let dMin = Infinity;
      for (let k = 0; k <= 300; k++) {
        const u = k / 300;
        const d = Math.abs(ejeCurva.getPointAt(u).z - z);
        if (d < dMin) { dMin = d; mejor = u; }
      }
      return mejor;
    }

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

    function haciaFuera(u, fi, atras = 0) {
      const { T, U } = marcoEje(u);
      const fuera = U.clone().multiplyScalar(Math.cos(fi)).addScaledVector(X, Math.sin(fi)).normalize();
      return fuera.multiplyScalar(Math.cos(atras * grad)).addScaledVector(T, -Math.sin(atras * grad)).normalize();
    }

    // Malla continua de alta densidad para estilizar curvas y silueta
    const COLS = M.seg(72, 20);
    const FILAS = M.seg(360, 60);
    const cuerpo = (() => {
      const pos = [];
      for (let r = 0; r <= FILAS; r++) {
        const u = r / FILAS;
        const { P, U } = marcoEje(u);
        const [w, hA, hB, p] = seccion(u);
        const ex = 2 / p;
        const z = P.z;

        // Suavizado tierno de cadera y hombros
        const hombro = 0.045 * Math.exp(-Math.pow((z - 0.12) / 0.18, 2));
        const muslo = 0.050 * Math.exp(-Math.pow((z + 0.22) / 0.18, 2));

        for (let c = 0; c <= COLS; c++) {
          const fi = Math.PI + (c / COLS) * Math.PI * 2;
          const s = Math.sin(fi);
          const co = Math.cos(fi);
          const musculo = (hombro + muslo) * Math.pow(Math.abs(s), 1.6);
          const lx = (w + musculo) * Math.sign(s) * Math.pow(Math.abs(s), ex);
          const ly = ((co >= 0 ? hA : hB) + musculo * 0.4) * Math.sign(co) * Math.pow(Math.abs(co), ex);
          const pto = P.clone().addScaledVector(X, lx).addScaledVector(U, ly);
          pos.push(pto.x, pto.y, pto.z);
        }
      }
      return M.coserNormales(rejilla(pos, COLS, FILAS, 'CuerpoAmpelosaurus'));
    })();

    // ---------------- 2. ESQUELETO Y RIGGING ----------------
    const MANO_X = 0.18;
    const PIE_X = 0.19;

    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['Cadera', 'Raiz', 0, 0.48, -0.22],
      ['Cola1', 'Cadera', 0, 0.47, -0.38],
      ['Cola2', 'Cola1', 0, 0.48, -0.54],
      ['Cola3', 'Cola2', 0, 0.52, -0.68],
      ['Pecho', 'Cadera', 0, 0.50, 0.12],
      ['Cuello1', 'Pecho', 0, 0.68, 0.28],
      ['Cuello2', 'Cuello1', 0, 0.80, 0.34],
      ['Cabeza', 'Cuello2', 0, 0.96, 0.48],
      ['Mandibula', 'Cabeza', 0, 0.92, 0.46],
      ...LADOS.flatMap((s) => [
        ['Brazo' + L(s), 'Pecho', s * MANO_X, 0.44, 0.14],
        ['Mano' + L(s), 'Brazo' + L(s), s * MANO_X, 0.16, 0.14],
        ['Muslo' + L(s), 'Cadera', s * PIE_X, 0.42, -0.26],
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
    const colgar = (nombre, obj) => {
      const h = typeof nombre === 'string' ? hueso[nombre] : nombre;
      if (!h || !obj) return obj;
      h.attach(obj);
      return obj;
    };

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

    // ---------------- 3. PATAS RECHONCHAS CERRADAS (CERO PIEZAS ABIERTAS) ----------------
    // Cada patita nace cerrada en cúpula semiesférica dentro del cuerpo para que nunca haya huecos
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
        // Cierre superior hermético en cúpula suave dentro del cuerpo
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

    // ---------------- 4. RACIMOS DE CRISTALES FACETADOS AMARILLOS (OSTEODERMOS) ----------------
    // Racimos dorsales sobre el lomo: cristal central grande (6 lados) flanqueado por cristales laterales (5 lados)
    const uLomo0 = uH('Cola1');
    const uLomo1 = uH('Cuello1');
    const ALTO_LOMO = [
      [-0.20, 0.055],
      [-0.14, 0.085],
      [-0.07, 0.115],
      [ 0.00, 0.125],
      [ 0.07, 0.105],
      [ 0.13, 0.075],
      [ 0.18, 0.050]
    ];

    ALTO_LOMO.forEach(([z, alto]) => {
      const u = uEnZ(z);
      const hb = duenoEn(u);

      // Cristal central prominente en el lomo
      const baseCentral = enCuerpo(u, (azar() - 0.5) * 0.08, -0.018);
      const dirCentral = haciaFuera(u, (azar() - 0.5) * 0.10, -8 + azar() * 18);
      colgar(hb, cristal(baseCentral, dirCentral, alto, 0.022 + 0.018 * alto / 0.12, 'CristalLomo', 6));

      // Cristales laterales flanqueando en racimo
      LADOS.forEach((s) => {
        const fi = s * (0.32 + azar() * 0.12);
        const aLado = alto * (0.55 + azar() * 0.22);
        const baseLado = enCuerpo(u + (azar() - 0.5) * 0.006, fi, -0.015);
        const dirLado = haciaFuera(u, fi * 0.7, azar() * 16);
        colgar(hb, cristal(baseLado, dirLado, aLado, 0.016 + 0.012 * aLado / 0.09, 'CristalLomoLado', 5));
      });
    });

    // Cristales a lo largo del lomo de la colita curvada
    for (let k = 0; k < 9; k++) {
      const u = uLomo0 - ((uLomo0 - uCola3) * (k + 0.5)) / 9;
      const f = 1 - k / 9;
      const a = 0.035 + 0.045 * f;
      const baseCola = enCuerpo(u, 0, -0.015);
      const dirCola = haciaFuera(u, (azar() - 0.5) * 0.15, 12);
      colgar(duenoEn(u), cristal(baseCola, dirCola, a, a * 0.42, 'CristalCola', 5));
    }

    // Cristales a lo largo de la parte posterior del cuello
    const uCuello1 = uH('Cuello1');
    const uNuca = uH('Cabeza');
    for (let k = 0; k < 7; k++) {
      const u = uCuello1 + ((uNuca - uCuello1) * (k + 0.4)) / 7;
      const f = 1 - k / 7;
      const a = 0.032 + 0.040 * f;
      const baseCuello = enCuerpo(u, 0, -0.015);
      const dirCuello = haciaFuera(u, (azar() - 0.5) * 0.18, 22);
      colgar(duenoEn(u), cristal(baseCuello, dirCuello, a, a * 0.40, 'CristalCuello', 5));
    }

    // Cristales más pequeñitos salpicados en los costados / costillas
    for (let k = 0; k < 12; k++) {
      const s = k % 2 ? 1 : -1;
      const z = -0.18 + azar() * 0.32;
      const u = uEnZ(z);
      const fi = s * (0.62 + azar() * 0.42);
      const a = 0.024 + azar() * 0.022;
      const baseCost = enCuerpo(u, fi, -0.015);
      const dirCost = haciaFuera(u, fi, azar() * 15);
      colgar(duenoEn(u), cristal(baseCost, dirCost, a, a * 0.48, 'CristalCostado', 5));
    }

    // ---------------- 5. CABEZA, MANDÍBULA ESTILIZADA Y DETALLES FACIALES ----------------
    // Mandíbula inferior modelada con alta resolución de vértices
    const MAND_PERFIL = [
      // [z, y, semiancho, alto, forma]
      [0.44, 0.932, 0.130, 0.038, 2.2],  // Comisura de la mejilla
      [0.50, 0.922, 0.120, 0.042, 2.2],  // Mandíbula media
      [0.56, 0.912, 0.100, 0.040, 2.2],  // Curva hacia el mentón
      [0.61, 0.908, 0.072, 0.034, 2.2],  // Barbilla delantera
      [0.65, 0.916, 0.042, 0.024, 2.0],  // Curva suave del mentón
      [0.67, 0.924, 0.000, 0.000, 2.0]   // Punta cerrada
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
        const hActual = cy > 0 ? h * 0.40 : h;
        const px = w * Math.sign(sx) * Math.pow(Math.abs(sx), ex);
        const py = y + hActual * cy;
        posMand.push(px, py, z);
      }
    }
    colgar('Mandibula', M.coserNormales(rejilla(posMand, colsMand, filasMand, 'MandibulaBebé')));

    // Labios superiores estilizados con sonrisa amable
    LADOS.forEach((s) => {
      const labioPuntos = [
        [s * 0.138, 0.945, 0.44],
        [s * 0.126, 0.938, 0.50],
        [s * 0.106, 0.934, 0.56],
        [s * 0.076, 0.932, 0.61],
        [s * 0.042, 0.934, 0.65],
        [s * 0.005, 0.936, 0.675]
      ];
      colgar('Cabeza', M.tubo(labioPuntos, 0.008, 0.005, { segLargo: 28, segRadio: 10, nombre: 'LabioSuperior' }));
    });

    // Dientecitos redondeados de marfil colocados en la mandíbula
    LADOS.forEach((s) => {
      [0.52, 0.56, 0.60].forEach((z, idx) => {
        const xTeeth = s * (0.092 - idx * 0.018);
        colgar('Mandibula', bloque(xTeeth, 0.932, z, 0.006, 0.008, 0.006, 0.4, 'DienteBebe', 12, 10));
      });
    });

    // Fosas nasales en lo alto del hocico
    LADOS.forEach((s) => {
      colgar('Cabeza', bloque(s * 0.030, 1.035, 0.59, 0.010, 0.009, 0.010, 0.4, 'FosaNasal', 12, 10));
    });

    // Ojos anime grandes y expresivos de agua
    LADOS.forEach((s) => {
      const ojoGrupo = new THREE.Group();
      ojoGrupo.position.set(s * 0.135, 1.035, 0.475);
      ojoGrupo.rotation.y = s * 0.42;

      // Fondo blanco del ojo
      ojoGrupo.add(almendra(0.052, 0.048, 0.014, 'OjoBlanco'));

      // Iris azul turquesa / aguamarina brillante
      ojoGrupo.add(bloque(s * 0.004, 0, 0.006, 0.038, 0.038, 0.008, 1, 'IrisAgua'));

      // Pupila azul marino noche profundo
      ojoGrupo.add(bloque(s * 0.004, -0.002, 0.012, 0.020, 0.022, 0.006, 1, 'Pupila'));

      // Brillos especulares
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

    // ---------------- 6. PINTURA: PROYECCIÓN Y COLORES DE AMPELOSAURUS_DER.WEBP ----------------
    const TEXTURA = this.textura;
    const proyectar = M.proyeccion(TEXTURA, 0.90);

    const C_TEAL_BASE = new THREE.Color(0x569893);
    const C_CREMA_VIENTRE = new THREE.Color(0xd2ece8);
    const MARFIL = new THREE.Color(0xeee3c6);
    const cColor = new THREE.Color();

    // Tonos degradados para los cristales facetados (del ámbar cálido a la punta luminosa)
    const TONOS_CRISTAL = [
      new THREE.Color(0xc98a22),  // Ámbar dorado profundo
      new THREE.Color(0xf0bd45),  // Amarillo citrino cálido
      new THREE.Color(0xf7d872),  // Amarillo brillante
      new THREE.Color(0xfff0b5)   // Punta cristalina clara
    ];

    // Pintar cuerpo cerrado con proyección lateral y vientre aguamarina suave
    M.pintar(cuerpo, (i, p) => {
      proyectar(p.z, p.y, cColor);

      // Si cae fuera de la silueta de la imagen (negro), usamos color base teal
      if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) {
        cColor.copy(C_TEAL_BASE);
      }

      // Vientre y garganta más claros continuos en la parte inferior
      const u = Math.floor(i / (COLS + 1)) / FILAS;
      const cIdx = i % (COLS + 1);
      const fi = Math.PI + (cIdx / COLS) * Math.PI * 2;
      const co = Math.cos(fi);

      if (co < 0 && p.y < 0.72 && u > 0.14 && u < 0.92) {
        const factorVientre = Math.pow(-co, 1.5) * suave(0.72, 0.40, p.y);
        cColor.lerp(C_CREMA_VIENTRE, Math.min(1, factorVientre * 0.88));
      }

      return cColor;
    }, g);

    // Pintar todas las piezas secundarias
    const COLOR_PIEZAS = {
      pataDelantera: 0x6ca39e,
      pataTrasera: 0x4f8e89,
      pieDelantero: 0x629c97,
      pieTrasero: 0x478681,
      mandibula: 0x5a9a95,
      labio: 0x437e79,
      fosaNasal: 0x316460,
      parpado: 0x3d7671,
      iris: 0x0ea5e9,
      pupila: 0x071e3d,
      brillo: 0xffffff,
      ojoBlanco: 0xf4f9fa
    };

    const piezas = [];
    g.traverse((o) => { if (o.isMesh && o !== cuerpo) piezas.push(o); });

    piezas.forEach((o) => {
      if (/^(Diente|Garra|PuntaEspina)/.test(o.name)) {
        return M.pintar(o, () => MARFIL, g);
      }
      if (/^Cristal/.test(o.name)) {
        const cols = o.userData.rejilla ? o.userData.rejilla.cols : 6;
        return M.pintar(o, (i) => TONOS_CRISTAL[Math.min(3, Math.floor(i / (cols + 1)))], g);
      }
      if (o.name === 'OjoBlanco') return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.ojoBlanco), g);
      if (o.name === 'IrisAgua') return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.iris), g);
      if (o.name === 'Pupila') return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.pupila), g);
      if (/^BrilloOjo/.test(o.name)) return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.brillo), g);
      if (/^Parpado/.test(o.name)) return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.parpado), g);
      if (o.name === 'LabioSuperior') return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.labio), g);
      if (o.name === 'FosaNasal') return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.fosaNasal), g);
      if (o.name === 'MandibulaBebé') {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, p.y, cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.mandibula);
          return cColor;
        }, g);
      }
      if (o.name === 'PataDelantera' || o.name === 'PieDelantero') {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, Math.max(p.y, 0.18), cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.pataDelantera);
          return cColor;
        }, g);
      }
      if (o.name === 'PataTrasera' || o.name === 'PieTrasero') {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, Math.max(p.y, 0.18), cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.pataTrasera);
          return cColor;
        }, g);
      }

      // Por defecto proyectar con salvaguarda
      M.pintar(o, (i, p) => {
        proyectar(p.z, p.y, cColor);
        if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.copy(C_TEAL_BASE);
        return cColor;
      }, g);
    });

    // ---------------- 7. ANIMACIONES CHIBI (THREE.AnimationMixer) ----------------
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    function giro(nombre, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set(x * grad, y * grad, z * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack('Hueso' + nombre + '.quaternion', tiempos, valores);
    }

    function sube(nombre, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      const [x0, y0, z0] = hueso[nombre].position.toArray();
      for (let i = 0; i <= n; i++) {
        tiempos.push(i * (dur / n));
        valores.push(x0, y0 + fn(i / n), z0);
      }
      return new THREE.VectorKeyframeTrack('Hueso' + nombre + '.position', tiempos, valores);
    }

    const sen = (t, c = 1) => Math.sin(t * Math.PI * 2 * c);
    const cos = (t, c = 1) => Math.cos(t * Math.PI * 2 * c);

    // Reposo: respiración suave, bamboleo dulce de la cabeza y colita enroscada meciéndose
    const dR = 3.2;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      sube('Cadera', dR, (t) => 0.008 * sen(t)),
      giro('Pecho', dR, (t) => [1.5 * sen(t), 0, 0]),
      giro('Cuello1', dR, (t) => [-2.5 * sen(t), 0, 0]),
      giro('Cuello2', dR, (t) => [-2.0 * sen(t), 0, 0]),
      giro('Cabeza', dR, (t) => [3.0 * sen(t), 3.5 * cos(t), 1.5 * sen(t)]),
      giro('Cola1', dR, (t) => [1.0 * sen(t), 4 * sen(t), 0]),
      giro('Cola2', dR, (t) => [2.0 * sen(t), 7 * sen(t), 0]),
      giro('Cola3', dR, (t) => [3.0 * sen(t), 11 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro('Brazo' + L(s), dR, (t) => [s * 1.5 * sen(t), 0, 0]),
        giro('Muslo' + L(s), dR, (t) => [-s * 1.5 * sen(t), 0, 0])
      ])
    ]);

    // Caminar: trote alegre y patoso de bebé dinosaurio
    const dC = 1.1;
    const PASO = 22;
    const caminar = new THREE.AnimationClip('Caminar', dC, [
      sube('Cadera', dC, (t) => 0.015 * (1 - cos(t, 2)) / 2),
      giro('Cadera', dC, (t) => [0, 4.5 * sen(t), 3.0 * cos(t)]),
      giro('Pecho', dC, (t) => [0, -3.5 * sen(t), -2.5 * cos(t)]),
      giro('Cuello1', dC, (t) => [4 * sen(t, 2), 0, 0]),
      giro('Cabeza', dC, (t) => [-6 * sen(t, 2), -5 * sen(t), 0]),
      giro('Cola1', dC, (t) => [0, -12 * sen(t), 0]),
      giro('Cola2', dC, (t) => [0, -20 * sen(t), 0]),
      giro('Cola3', dC, (t) => [0, -28 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro('Brazo' + L(s), dC, (t) => [s * -PASO * sen(t), 0, 0]),
        giro('Muslo' + L(s), dC, (t) => [s * PASO * sen(t), 0, 0])
      ])
    ]);

    // Rugir / Celebrar: se para en sus patitas traseras, alza la cabecita, abre la boca y bate la cola
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

  // Imagen de referencia reducida ×3, sin tinta (RGB en base64) para proyectar colores fieles de ampelosaurus_der.webp
  textura: {
    w: 173, h: 130, k: 3, esc: 0.00290, x0: 268, y0: 385,
    datos: "hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jI56op+Hq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNvbqh8fTd+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+//l+/7k5efOtbWdsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YuLWa6d6m++yq++yq++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq9eSi7NiW6tWT6tWT6dSS2siKppxtgH5ZeHZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUgYFhoqWKqauSpaSOpKGMpKGMpKGMop+KhIBsrqSI+ObA4M+utaaPzMKn8+7E9/HE+vrWudC/ZZOXeqWreqiweaushba0stfXzOXn0+nspr7CeI+TkairuNHRz+zp0/Dr0u/p0+/qzujnx+Hjx9/ix9/iyuDk0Ojuhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jo97o6CHq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtrKZ6+7X+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+//l+/7k4OHIsrKbsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCY0cqg+Oqq++yq++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq9+ak7tuZ6tWT6tWT6dSS4c2OxLZ+nJRogH1ZeHZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUeXhWk5V3qKySpKaLm5l/oZ6HpKGMop+Kgn5rioNr08OZ8N2r0L+R7unD+ffQ7+3D1ePKgqypWIqNbp2ibp+oZJ+lbKaooc/SxeHmy+PoqMHFeJKWjaert9PS0O7o0e7o0Ozoy+Xlx+Djxd3gwNXZxtne0Obt1u71hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jpB7pKGIq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNsKuS3+DJ+f3n+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+/7k4OHIsrKasK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YvLmb7+Kn++yq++yq++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq+emn8d6c6taU6tWT6dSS6NSS4M2NxLZ+mpNnfHpXd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUgoJioqaKp6uQj49viIVkl5R4n5yGiYZyop+IqqB2wrBn48hfzr991d7CkLavbaClSIOKRYOKPHyHLG17K2l5N3F/TX2Lia63udrittTYl7zAgqivfZqgw+HdxuLhx+Dixd3gu9DUqrzCtsfOy9/m0+zz2/D2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2lJR+p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrqmP1dW9+Pzm+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+/7k3+DHsrGasK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Ys7GY2tGi+uuq++yq/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq+uqo8+Gf7NeV6tWT6tWT6dSS6NSS3cqMt6t3kItifHpWd3ZUd3ZUd3ZUd3ZUd3ZUd3ZUeXhWk5V3p6uRkZR6fn1ZfntVi4hlzsyv8O/V4NyzwbNz2MNmv7iGZ5GUPISRQIGJNnaCKXJ9HmZ4H1tsJ1lkR3R8eZ+nncHHgqqyu93heqiqibzAp8jTl7nAvtfbus/Tn7K4kqOqrr/GzODn0erx1O3z3/H3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNyMeu9vrk+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+fzi09S7sbCZsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YvbmZ5dmh+uuq++2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq++up9uWj7tqY6tWT6tWT6dSS6dSS59KR2ceKt6t3kItifHpXd3ZUd3ZUdnVTd3ZUd3ZUgoJioaSJk5d/h4dthIBbkoteua52+eyv9+2rtL+Vc5d7UYeFL3eDLXeDLHF7KnR9I3R8HWdxJVxmPGtqXoV7gJqTqsfEaJWZeaqxkMHKaKmvfbK6pNDZpL/Ei56miZqiucrRzeDn0Ojv0Ovy2e704vL4hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNwb6k8/bf+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+fviy8y0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66XrKqTrKaE4teh+uys/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq9+el79ya6taU6tWT6tWT6dSS6dSS59KR2ceKurGBj45pd3ZVdnVTd3VTd3VTeXhWk5V3mZ2EnJyFl5J3w7N70bdry7dkz9GMXo+ON3yGO4COR4yVRoyVM3iDOYCLQIuVL3aALmVrTn14mr+tpbuvaIB4Snh6NnZ/Y5uqaKexbKmyebG4oczSs8/WxNfezeDnzeXs0Ovy0uvx3/H35vX6hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNu7id7/Ha+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+fviy8y0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66XrayVmJV8pZ9+2dCf+Oyv/O2s/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq+eqo8uCe69eV6tWT6tWT6dSS6dSS6dST6daX08ubjIxsdHJTeHNQeXRQenRRlpNr0dCr4d66ysep2NWorqdwd4djaZSDQoWVP4OVR4uaT5SgUZaiRIWSQ4GOTYuaPoOPMm91PHFwibexcZmXO2RlNWlwJWZyMXGAOHiFaamzfLe+iLrBt9Teyt/myuLoz+rxzurw2O7z5PT56vj7h4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p3l5aAqqWLq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNt7OX5ufP+f3n+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k+fvhy8y0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xrq2Wmpd/jIdumJN20Mib+e6z/O+w/O2s/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq++up9OOh7NiW6tWT6tWT6tWT6tWT6tWT6teY0cmahYVpbWdLdmZEfGhErpxnx7Zm1cFv18WForKRRXd1PnmHRYaPUpWlQoaXUJWkU5mmUJajRIiUS4mWVpSiQYWSL293N3Z6M250N2x1NGt1N3J+M3iCJm14L3WAL3R8U5GZf7O9oMrWq83XxeLpyOXsz+nv4PH36ff66vn6rrGWio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iYx4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtbGV39/F+fzm+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k9fjexcWusK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xr66XtLGVoZx/jIdul5J10Mib+fC3/fK1/O+u/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq++yq9+ak7tuZ6tWT6dWT6dSS6tWT6tWT6teY0MiagoJoZGFKf3FOzLRw4cFd4rtT0cWGXpGHPYKQUJCfTI6bVJekQYWTTpWiUZmmR5GdPIKPTYiXVpShRYuWOXuFQoKKMHF4MG54O3iDXZqmX56oUJSdT5SdPIKKM3V+PniEXZCdgbK+ibjCo8jN1ezx5fX56fn64fby6e7Fqa2Sh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtLCU1tW59/vk+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k8PPZvLuksK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66XsK+YwsCi1tGqo56AjIdul5J10Mic+vG4/vS5/fG0/O6t/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq+emn79yb5dGR6dSS6dSS6tSS6tWT6teY0MiagoNpfXxhzb6F0r53v7V4gJmDUo6Va6m0WZqpRoiWR4uWT5OgS5OgPYiUOoaSNXuJU46eWpyoUpiiU5agSYuTO3yDT46WYp+pZqOuZ6WwZKSuWZqkW5ymSoqWMXN/LGt2ZaGsdLC6j7/HyePo4vL04Pbx2fPu9vvQ3eK8oKOLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Uzsyv9Pfg+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k8PPZu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yurme6eS53Nato56AjIdul5J1zseb9u21/vW7/vS4/fCy/O2s/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++2r++yq++yq++yq9OWkxriC0L6D59KP6dSR6tSR6tSR6taW2M+a1dSp2N6/iaSZaJKSb6Gsd6+9WZilWZyoUZShUJWhOn+MOH+NOYGPLniCPYaSUJmlSpGdR4eQRoKMTYeRVpacZqWwaqWxaaSwaKSwYJ+pXJymWJWhU5GdRIqUOICJQIePUpihc6y0ttrfx+Dgz+vnzero9vvQ9frP3OG7oKOLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Tycao8PLa+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k8PPZu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yt7Wc5eC38+2/3Nato56AjIduk45zu7SN8umz/vW7/vW7/vO2/O+w/O2s/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++yq++yq+uuqzMCLiX9asqNu2saE48+J48+J48+I38dy0syGl7GgeqarjbzFg7XEXJelRYeTUZSgT5ShTZKfPoSQPIOQNnWBRICIXZ6jYZ+pbauyaZyhf6eufKGnXJCTV5efbqe1a6WxaqaxZaGsXJumU5OdWJqkVJmkS5OcQYuUPYeQV5GblLa+w9/lwOPnuNbZ9vvQ9vvQ9frP2d65lpqDhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2i415op+Hq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+TxcGj5+jP+f3n+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k7vDWurmisK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsrGZ3Ney9O7A8+2/3Nato56AjIduj4pwubOM8umz/vW7/vW7/vW6/fK1/O+u/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++2r++yq++yq7+Cik4tkbGZJlYtgzMCH0siP0seNzciUnLSfhLO7m8bMg7jEZqKtTZGcU5qkSI2ZRoyZOH+NQIiVQIWOTICIaYqPp8/NqNLQqtLQrdLRs9LTrszLmbS2b5mfWpGcY5uoY56qZJ6qUo+aVJSeXJ+oVZulS5OdSpOeOoWQN3qDZZSaia62ncfSeZuj9/vR9vvQ9vvQ8/jNyc2skpWAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jo97o6CHq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Tw7+h4ODG+fzm+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k4uTLtLOcsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCZ1NGt8+3A9O7A8+2/3Nato56AjIduj4pwubOM8umz/vW7/vW7/vW7/vS5/fG0/O6t/O2r/O2r/O2r/O2r++2r++2r++2r++2r++2r++yq+uuqyb6JbWhLamVMlZ+OmLazmLOxjrCwea61k8PQg7bBW5qnY6OuS46ZT5ehQ4yWSZGgLniLOoWUQ4SMZYmNd5KThqKhjKimsM3JtNPQs9XQttbSudXTl7G0eZ6jaZSdaJGaXX2FNmNtRX6FTYyPVpuhU5qjR42YPYSOMnyBQoSJWZCYeKu3bZCW9/vR9/vR9vvQ9vvQ8vfNyc2skpV/hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jo97o6CHq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6f19a69/vk+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+//l+/7k4OHIsrKasK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yycan8uy/9O7A9O7A8+2/3Nato56AjIduj4pwubOM8eiy/vW7/vW7/vW7/vW7/vS4/fCy/O2s/O2r/O2r/O2r/O2r++2r++2r++2r++yq++yq7+GilIxlamVMlJmIkLG0irK8kLPBm8TMg7TAVJGcXKCpZ6eyYaSwT5miQY2WPYqXMn6POH+MR36DjaywiaaogJycjaennbi2tdTQttXTuNbVutfWrMXFkKmqkqiql6msd4aKVXF3SH+CSYOGU5SaV5ylSo+aPYOMNH2CQ4WLY5yifq+2hqyv9/vR9/vR9/vR9vvQ9vvQ8vbNwsami496hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jo97o6CHq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fz82w9Pfg+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+/7k+/7k4OHIsrKasK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yv72h7ei89O7A9O7A9O7A8+2/3Nato56AjIduj4pwr6mG5Nyq/fS6/vW7/vW7/vW7/vW7/vO2/O+w/O2s/O2r++yq++yq++yq++yq++yq++yq+uuq18yVioVmm52ImLOtiLa4pMrRnMbKaKGqU5afTpWdYKCtS4+cTpiiO4mSNoSPO4iRXJaefKSposHFmbe4fpqbfpmZka2ssc/MttXTt9XUuNXVqcTEkaqqkqmqmqyvhZWYZXp9TYCCSYKGU5SZWJ2mT5SePYONNn6DT4qQapmfdqGlha6v9/vR9/vR9/vR9/vR9vvQ9vvQ6/DHs7eaio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2jpB7pKGIq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fysep8PLa+f3n+v7o+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+/7k+/7k3d7FsrGasK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yurie6uS69O7A9e/B9O7A9O7A8+2/3Nato56AjIdujIdupaB/5Nup/fS6/vW7/vW7/vW7/vW7/vW6/fK1/O6u+eqn+Oml+Oml+Oml+Oml+Oml+Oml9uej2c+avcSul7m4mMTLjb3JWZGgV5Sga6u3a6q3Xp6rO4GOM4ONM4WOM4SMT5Gac6GoqMjLqsjJlbO0jKmre5iZe5iYlbOystHPt9XUt9XUqMPDkaqqkqmqm62wkaKlbX6CUX2BSYKGU5SZWJ2mUpehP4WPRYWLZZSabJiedaCjhK2t9vvQ9vvQ9/vR9/vR9/vR9vvQ9vvQ6u/Gs7eaio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2lJR+p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fxsKj5+jP+f3n+f3n+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+/7k+fzizs+3sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YtbSb4dy19O7A9O7A9e/B9O7A9O7A8+2/3Nato56AjIdujIdupp9+5t2p/vS6/vW7/vW7/vW7/vW7/vW7/fO49emo5teS2cqI18iH18iH18iH2cqI49KB59mUtcu9nsjJn83PY5ymYKCuZaSwZKGvXpyrS42bQImWOYuUNYGMUZCdX4yVn8XGqMnHqcbIjKqrk7GydJGTY4GBZoSFj62ssM7Nt9XUq8fGkaqrkqmqm62wmKqtd4eLVH2BSYKGU5SZWJ2mVJmjRYmSWo+Wa5edbJiedaCjhK2t9vvQ9vvQ9vvQ9/vR9/vR9vvQ9vvQ9vvQ6u/GsLSYiIt3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fxMCh4ODG+fzm+f3n+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l+//l+/7k+fviy8y0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsrGZ29ax9O7A9O7A9e/B9e/B9O7A9O7A8+2/3Nato56AjIdujYhutKyF7uOr/fO5/vW7/vW7/vW7/vW7/vW7/fS66uCqqKGBi4dwiYRuiYRtjIdvsK2HvMmvpcXEosvRf7W8Y6KqUZSgY6SvVJajS42bR4uZQouZPYmVSYqWYY+dm7y9qMnDp8fBocHAg6KigZ6ehJ+ffpmZfpiZg52emrW1tNHQr8zLk62tkqmqm62wnK2whJWZVn6CSYKGU5SZWJ2mVpulVJKaZ5Wca5edbJiedaCjhK2t9vjH9vvQ9vvQ9/vR9/vR9/vR9vvQ9vvQ9vvQ4OW/oKSLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fw7+g19a69/vk+f3n+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l/P/l+/7k+fvizMy0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCY0Myr8+2/9O7A9e/B9e/B9e/B9O7A9O7A8+2/3Nato56AjIduj4pvtq6F7eCn/PK2/vW7/vW7/vW7/vW7/vW7/fS64dutoKuch5GLhY6Hh4+JkZ2ZoL7Cp8zYiLnEaaSsaqizaae0ZKezNX+KNYCLPYOQO4KRTIiWbp6on8XHqMjEqMfCo8G+osG/mLKxnrO0mq6xiqCihJuchJqciJ+gory9r8zMla6vkqmqm62wnK6xkKKlWoOHSYKGU5SZWJ2mV5ulYpiga5eda5edbJiedaCjhK2t9PO59vvP9vvQ9/vR9/vR9/vR9/vR9vvQ9vvQ9frP3OG7oKOLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2lZV/p6OKq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fw7+gz82w9Pfg+f3n+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l+//l/P/l/P7k+fvizMy0sK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCZzsuv8+3C9e/B9e/B9e/B9e/B9e/B9O7A9O7A8+2/3Nato56AjIduj4pvvbOJ8uSo+++z/vS6/vW7/vW7/vW7/vW7/PS70tu8nru8mre6nLm8oL7EnsPNkcLNZ6Sta6q0ba24bau4VZqlPYWQO4WRQomXQYiXYZWfn8THqsjFrMrEqcbDo8O/p8LAsMTEqry9o7a4ma6wiqCihJqchJqciaCin7q6mLKyk6mqm62wnK6xl6qtY4yQSYKGU5SZWJ2mWJulZZmga5iea5edbJiedaCjhK2t8++s9vjH9vvQ9vvQ9/vR9/vR9/vR9/vR9vvQ9vvQ9frP3OC7nJ+Hhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p3l5aAqqWLq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fw7+gysep8PLa+f3n+v7o+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l/P/l/P/l/P7k+vvhzMuzsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yurqk6unX9/PQ9e/B9e/B9e/A9e/B9e/B9e/B9O7A9O7A8+2/3Nato56AjIdulY9zy8CQ8uSn+e2w/fO4/vW7/vW7/vW7/vW78u66ssa7mLm9oMDEosjLmcjQaaSvZaWvaqu1bbC6VZ6oOoGLPoeRRZGbSZObVpSbn8nMqsrKrMrHq8rErcbEtc3MtdHPs8rJrsDBp7m6oLS3ma2wiqCihJqchJqciJ+hjqankqmqm62wnK6xma2wZ5GUSYKGU5SZWJ2mWpukaZifa5iebJiebJiedaCjhK2t8+2n9fW99vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9PnPzNCukpWAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iYx4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fw7+gxsKj5+jP+f3n+f3n+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l+//l/P/l/P/l/P7k9vbcwsGpsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCZ0tK/+/vt+/nh9fDE9e/A9e/A9e/A9e/A9e/B9e/B9O7A9O7A8+2/3Nato56AjIdulpBzy8CR8+Sn+Oqs+/C0/vW7/vW7/vW7/PO6ytG4ka+ynMDHn83TeLC2YqCrXpynaqm1XqStQ4+YQ4uVTJWeTpWdZKKomcfIqczKq8vKq8rJsMnHuMvLvNDRvdfVuNPRs8fHqry9o7a4n7O2ma2wiqCihJqchJqchpyekaaom62wnK6xma2wZ5GUSYKGU5SZWJ2mXpqjapiea5iebJiebJiedaCjhK2t8+2m8/Cv9vnK9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8vfNyc2skpWAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fw7+gxMCh4ODG+fzm+f3n+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l/P/l/P/l/P/l/f7k8/PZu7ujsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yu7qk7e3d/v7x/v3t+PXJ9fC99e/A9e/A9e/A9e/A9e/A9e/B9O7A9O7A8+2/3Nato56AjIdumpR12s6Z9eao9+mq+u6x/PK2+/K1/PK23N27iKqrmMbRebC6X5yma6u0YaGuY6WxR46ZQIyXSZKcUpiiXJyjm8rMq8rJrcvJrc3Kss3MwdTTv9HRuszNvdPTvdjWutLRr8HCp7m6obS3n7O2ma2wiqCihJqchJqcjKGjmqyvnK6xma2wZ5GUSYKGU5SZWZ2mYJqia5iea5iebJiebJiedaCjhK2t8+2m8+2o9fbA9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8vfNx8yrjpF8hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nJqDqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fw7+g19a69/vk+f3n+v7o+v7o+v7o+v7o+v7n+v7m+/7l+/7l/P/l/P/l/P/l/v7k8/PZu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCZ0tK/+/vu/v7x/v7w+fjU9fO39fK49fC99e/A9e/A9e/A9e/A9e/B9O7A9O7A8+2/3Nato56AjYhupJx63dGb9eao9+ip9Oem8OSf7uSersKrgrC1g7/GaKauWZqibbC6XqSwW6GuSZGdQo6YTJihWZafj7y/sdPNsdHLtdTOutPQytvazd3cxtbVvs/Pus3NvdXUvdjWtszMqr2+o7a4oLS3n7O2ma2wiqCihJqch5yelqmsnK6xmq2wb5WZSoOHU5SZWZ2mZJmga5iea5iebJiebJiedaCjhK2t8+2m8+2m9PGz9vrN9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ7vPKtbibio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iox4nZuFqqWMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fw7+gz82w8/fg+f3n+f3n+v7o+v7o+v7o+v7n+v7m+/7l+/7l/P/l/P/l/v/l/v7k8/PZu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yu7qk7e3d/v7x/v7x/v7x7+7V4t+o8/Gy9fO29fG69fC+9e/A9e/A9e/A9e/A9O7A9O7A8+2/3Nato56AjYhupJ174dSd9ueo9eak7uCZ1dirhbGskMXIaqeuZqStWJmjbrO9WaCtRo6aRpCbSpWeWJaeb5uitdXXt9fRt9jRvtjTzd7b0uLf1OPhzt7dxdbVv9DQu87OvdbVvNbUsMXFp7m7obS3oLS3n7O2ma2wiqCihJqcjaKkm62wnK6xfJ2gTISIU5SZW52laJifa5iea5iebJiebJiedaCjhK2t8+2m8+2m8+6p9ffE9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ6u/Gs7eaio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2i417n52Hq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fw7+gyMWo6evW+f3n+f3n+f3n+v7o+v7o+v7n+v7m+/7l+/7l/P/l/P/l/v/l/v7k8/PZu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsbCZ0dG++/vt/v7x/v7x/v7x6+rZpaB4xsKM8O6w9fO19fO29fG79e+/9e/A9e/A9e/A9O7A9O7A8+2/3Nato56Ajolvs6qC692e9eWg59uFnrungLa/fbvBaKiua6qzXqCqW6KrT5ejTpilTpqkU5miWYeNsNDRu9bUt9rTt9rTxdjU1+Lh2ebk1+bj1eTizt7dxtbVwdHRvdHRvdfWudLRrL/Ao7a4oLS3n7O2n7O2ma2wiqCihpyelKiqnK6xfZ2hTISIU5SZXZykaZiea5iebJiebJiebJiedaCjhK2t8+2m8+2m8+2m9PO49vvP9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9vvQ6u/GsLSYiIt3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3kJF/pKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwr6fvrudsbGe5ejV+f3n+f3n+f3n+v7o+v7n+v7m+/7l/P7l/P/l/v/l/v/l/v7k8vLYu7qjsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xr66Xsa+Y3t3M/v7x/v7x///y/v7x9PPkn5p6hoBWw7+J8O6w9fO09fO19fK39fC89e+/9e/A9O7A9O7A9O7A8+2/3Nato56An5p85t2p9eiowMmhbZ+ofbrGbKm1ZKWtcbG7cLO9SZCaRY+bSpSiTZOfQX2Gl7zCvtvawt3Xvt3Xv93X1unl3Ofm3OXk2+jl2ujl1+Xkzt7dxtbVw9PTv9TTvdjWtMzLp7q8obS3oLS3n7O2n7O2ma2wiqCijKGjmqyvfZ2hTISIU5SZYZuja5iea5iebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8++s9vjH9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9vvQ4OW/oKSLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIt5kpKBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwr6fvrqcf31rkJGE5OfU+f3n+f3n+f3n+v7n+v7m+/7l/P7l/P/l/v/l/v/l/v7k6enPt7aesK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xr66Xr66WqqaO3NnJ/v7x/v7x///y/v7x+vrsrqqOeXJMhX9Vwb2I7Oms9fO09fO19fO19fK49fC88+688+y58+y58+y58eu43depysag9/G+4+S2eqmjY6Guaae0ZaOwX5+pc7O/X6KuPoiROoOQQYaVQXyKZJafrtPXv93bxNvYxdvY1uzn3vPu3e/r3Onn3OXl3Ofl2+jm2Oblz97dxtbVxNXUwtbVvNbUr8TEo7e5oLS3oLS3n7O2n7O2ma2wjKGklKiqgJ+iTYWJU5SZZZuia5iea5iebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2n9fW99vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9frP3OG7oKOLh4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iox8kpOBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwr6fwLyei4hzVVRKj5CD5OfU+f3n+f3n+v7n+v7m+/7l/P7l/v/l/v/l/v7l/v7k7OnNwb2gsbCYsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xr66Xq6iQoZyC29jH/v7x///y///y/v7x/f3wyMWtfHVPeHFKgXtSrKd26OWp9fO09fO19fO19fO18u6s7+eV7uOJ7uOI7uOI7OKFz79by7x7pLynYqGnY6StX6GtYaGuZKWvWJ2nT5ihSpSdUZqmUJCeSX6JlsHGt9zZvtzZxdrXz+Dd4/Lw5/j15Pby3vHt3Ozp3Obl3Obl3Ojm2Oflz97dxtbVxNXUwtbVudHQqb2+obS3oLS3oLS3n7O2n7O2ma6wkqapi6WoVIiMVJOZZ5qga5iea5iebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m9PCw9vrN9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9frP3OC7nJ+Hhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5i419kpOBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwr6fwr6flpN8T05EUlFHj5CD5OfU+f3n+v7n+v7m+/7l/P7l/v7k/v7l/v7l/v7m8OvQ1Munv7uesbCYsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yr66Xr66Xr62Wo5+Fnph929jH/v7x///y///y/v7x/v7x2NbBgnxXeHFKeHFKfXZOqqV16OWp9fO09fO09fO09fOz9O+l9eSE9uB39uB29t909tZq0MiNd6GfZKWsS4+VRYqUWJumaq23WaGrSJSdSpWeTpegSIOMe6ers9jVud7VvtzXxdvWyt3Z3u3q5vTy6fn25/n14fTv3e7r3Onn3OXl3Ofl2efkz9/dxtbVxNXUwdXUtMrJpLi6oLS3oLS3n7O2n7O2n7O2m6+yjqeqVYmNVZKYaJiea5iebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+6q9/fL9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9PnPzNCukpWAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8i41+kpOBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwr6fwLydlZJ3UVBFS0pBUlFHj5CD5OfU+f3n+v7m/P7l/v7k/v7k/v7k/v7n/vzr8OnR2M6p0smlv7uesbCYsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+YsK+Yq6iQnZZ7npd929jH/v7x///y///y///y/v7x6unYjIdjeHFKeHFKeHFKfXZOp6Jy3dqg9PKz9fO09fO09vO09vGr++2V/eiJ++WK6NaFkaqZW5OfX6CoWJ2lW6CpZ6qzYqaxVZ2oPYmTSZOcUJefVouOtdvYu9rSvd3VvdvUwdrVxtzX0eTg4fDu5vXy6vn36vr35Pby3vHt3Ozp3Obl3Obl2ubk0N/ex9bVxNXUv9LRrMDBobW3oLS3oLS3n7O2n7O2n7O2kquuVoqOWJKXapiea5iebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2n9/PD+PvW9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8vfNyc2skpWAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9i41+kpOBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwr6fwLydrqqImJZ0Xl1QS0pBS0pBUlFHj5CD5OfU+f3m/P7l/v7k/v3k/Pvl/vvq/vjp8OjQ3tWt2M6n0smlv7uesbCYsK+YsK+YsK+YsK+YsK+YsrGaubegwsCpq6aMmpN3npd929jH/v7x///y///y///y/v7x9vXlsKyNfXdQeHFKeHFKeHFKenNMlY9j2dad9fO09vS19vS09vSz+ver+u6h5d2err6fYpikTZGdVZmkWp6nU5WhYqSxWqCrRY+aQYuYS5GbUIeQgamqtNjVw93ayd7bxtzXv9nUwdrUxt7Y0ubh4fDu5vXy6vn36/v45/n14fTv3e7r3Onn3OXl2uXk0uDex9fWxNTTuszMprm7oLS3oLS3oLS3n7O2n7O2mbCzZpOXW5KXa5eda5edbJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m9fC2+vnc9/vT9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8vfNx8yrjpF8hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8iox9i41+kpOBpKCJq6aMq6aMq6aMrKeNrKeNrKeNrKeNrKeNrKeNtK+Twr6fwLydrqqIqKWAzsyykpGETk1ES0pBS0pBUlFHkpOG8vbd/P7h/f3j+/rj/frp/vjo9O3a5+HG9O277eSy39ar1Mumv7uesbCYsK+YsrGaubegxsSt2da/6+fQ4t3FpqCEmpN3npd929jH/v7x///y///y/v7x/v7x/f3t7u7TsKyKgntVeHFKeHFKeHFKeXJLo51w7uyy9fS19fOz9fOy+fes9/Ows8mscKGhVJOiQIeUTJCdXaGsaa24YaSxXaKvRY6cQY2aRYiRap2jn8nGtNjVwtzayuLfydvYxdjVv9jTwdrUxt7Y0ubi4fDu5vXy6vn36/v46vr35Pby3vHt3Ozp3Obl2+Xk0+DeyNfWw9PSs8XFora4oLS3oLS3oLS3n7O2n7O2gaKmY5SZa5eda5edbJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+6r+vbW+fva9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ7vPKtbibio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9i41+i41+kpOBpKCJq6aMrKeMrKeMrKeMrKeMrKeMrKeMrKeNtK+Tv7ucrqqIpqR9zcus7uzZ0M6+bGthTk1ES0pBTUxCc3Jf7u67+PfI+vjg/Pnp/ffl8uvU39fA7uzW/fTD/fGy+e+17eSx2tGou7aYxcKq2da/6+fQ9vLb/Pjh/Pri0M2ynZZ6mpN3npd929jH/v7x///y/v7x/v7x+fns4eDN8/LT9PPYxsOkhoBbeHFKeHFKeHFKg3xU0s+d9fO07+id7eaY6t+B8+ulnr+qRo+TQIeVTZShXqOwZqu3X6SvVZynT5ejQ42YRpObU5OZc6KloMnGttfVv9nYxd7bx9/cx9zZxtnWwdfTwtnUxt7Y0ubi4fDu5vXy6vn36/v46/v45/n14fTv3e7r3Onn2+Xk1uHgytnYwdLRrsDCoLS3oLS3oLS3n7O2n7O2lK2xcJqga5eda5edbJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2n+PPH/Prl+PvV9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ6u/Gs7eaio15hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8iox9i41+i41+k5OBp6OKraeLraiLraiLraiLraiLraiLraiMtLCTr6uJpqN8ysmn7OrV9fPh9/Xi1tfGmZmLa2lYioVf08qJ9+qS++mc+/PU+vTc8OjN2NC23drF+frn/PTF/eqb/eqe/e2n9+mqyr+V8u3U+/fg/frj/vzk/v7l9vbduLOYmpN3mpN3npd929jH/v7x/v7x/v7x+fnsyMa7sK6Y7evE/Pzf+fjeyMWmhoBbeHFKeHFKeXJLo55z8fC58+mj6tmJ58xpx8WKWouGL4OHO4ORT5ajYqm2Zay3XKOtU5ulP4qTO4eQR46VYpqfmcbFsdLRu9jXvNfVvtjWwNnXwtvYxN3ZxtvYw9jUw9rVxt7Y0ubi4fDu5vXy6vn36/v46/v46vr35Pby3vHt3Ozp3Obl1+HgzNrZvs/PqLu9oLS3oLS3oLS3n7O2nbK1faGmbJiebJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m9fC2/fnl+vve9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9vvQ6u/GsLSYiIt3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9iox9i41+jI1+m5qCtK6GurOGvLWIvLWIvbWIvbaJvbaJ08yasK9+yMei6unR9fPh+/nm+/nn/P3q9fXiy8iqqZ9lzsJ29OSD/d9x/eun9OrH1s6zycSs8PHe+/3s+vTJ+uiT/OiT/eeU+uGLz8aS+/jg/fzk/v7l/v7m/P3k7e3TsqyOm5R3mpN3npd929jH/v7x/v7x+fnsx8a7h4R7trOY7Oq/9/bT/v7j+fjeyMWmh4FceXJLeHFKgnxT0c6b+fa559ucwLR7e5eIMHByPIONPYOSVJmnVpuoXKGuWJ+sTJaiP4qVO4aOW56kapecp8zLvNrYv9vav9nYvdfVvNbUvNbUvdfVv9jWwtrXwtnWxNvWx97Z0ubi4fDu5vXy6vn36/v46/v46/v45/n14fTv3e7r3Onn2uPiztravc3Npbi7oLS3oLS3n7O2nrO2hKSpbJiebJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+6r+/bZ/fvo+PvW9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9vvQ4OW/oaWNiIt5hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8iox9i419i41+jY5+lZFzmI5hqZ5srqNvv7R9w7iA0MWG6NyM1tN8zMqm9fPf+/nm+vjm+Pbm/P3q/f7r8fLcnJVue2880cBn+t1d9+Bx++uwycOm1dW/+fvq+fvq9/XT+OWT+eSK+uWL89x0yL6C+vnc/f7m/P7l9PXc397D4d+/2NKorKWEmpN3npd929jH/v7x+fnsx8a7hIF5hYJ2zsyq7eu+8O7E+/rc/v7k+fne1NGzlpBsfHVNhHtRophd9/GZ8+qop7eeS4qONH2FNHuGR4ybWZ2qXKCtZaq3W6KuQ46aPouVR4qTYJOal7q8tdTUwdvYwNvZxNrbwtjZvdbVu9XTu9XTu9XTvNXTvdbUv9jVwtrWxt3Y0ubh4fDu5vXy6vn36/v46/v46/v46vr35Pby3vHt3Ozp2uXk0dzcucnKo7a5oLS3n7O2n7O2jKmtbpmfbJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPH/vrs+/vh9/vS9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ9frP2+DCp6qZiYx5hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9iox9i41+iox9hoZ0cWhKal46bGA7dWlCeGxEn5Jc6diC8uaAubB4+PXZ+vfk9vXk9fXi/P3p/f7q+/3mwr6bbWE0wK5Z+N5d9txU+eWH8Oi70NG8+Prp9/no+PbY+OaX+OKI+OB+9NxnzMF99/XR+frg6+vRx8Wo1dO28OzH7OSu2NKlrKWEn5h929jH+Pjrx8a7hIF5fHlwurqj7ezF7uy/7uy/9fTP/v7j/v7k/fzi4t6/tap7tKVtoI1M89Zyz8mLXo2COX+ERo6aQYeUXaKxRoqYU5ekVpmnV5yqOYSRO4qUYaCpa5ecq8rKutnZvNvZwN3cwNvcxNvdxdrcwtjZvdbVu9XTu9XTu9XTu9XTu9XTvdfUwtrW0OXh4fDu5vXy6vn36/v46/v46/v46/v45/n14fTv3O7r2+jm097etcXGobW4oLS3n7O2lK2xcZugbJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m9fC2/fnm/vvr+fva9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ7/PQ0NTFq66fjpF+hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8iox9iox9iox9iox9hIFrcmhGbmI/bmI/bmI/d2tGz8B69+N68OCHycCS+fjj9PTg9vbh9vfa8/TI9vnO7ezEsqh528lo9txa/NxX+N5j+OyUycup+Pni+vvi9/XW8t6Z9N2H89ps+Ntj2c1++vjI7OrQwLyg0c6x9/bc9e/J6Nuh6+Kr2NGlr6mK1tTDxsW6hIF5eHVspqSS6uvK9PTN7uy/7uy/8e/F/Pze/v7k/v7k/frd7eS118iHx7htxLVvhaGQRoOIRYuVRIyZTpOhTpOgWp6qYqSyXJ6sTJOfP4qXO4qSaKarfqmsvtzbu9jXt9zVweHbweDawN7aw93bxtzcxdvcwtjZvdbVu9XTu9XTu9XTu9XTu9XTvtfVzeLf4O/t5vTy6vn36/v46/v46/v46/v46vr35Pby3vHt3Ovo09/essPFoLS3n7O2mK+zdJyhbJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+6r+/bZ/vru/Pvl9/vT9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ8/jQ3eHP0dXKtbmqj5KAhol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9iox9i41+jY+AtLWjr6iNiH1dhXpahnpZjYFb2cmG+OB59+B459Z85+Ow9fbV+PXk9O7I7eWU7uaO/PrV9e/L5dB+9dhf+t5g+d5h9N1kxb6B+vfN+vve+fXV7NWb5cmA17tR279T7d9t+PCj3tirzMmq9/bb/vzh8OO149KW5tid6eCovLaL2NbCk5CFe3hvlJKE3t7A9/jV9fXQ7u3B7eu+8O7C/PvW/v3g/v3h/vra+vPE5Nqf0smQjaKIRYSNPoWSQ4qWSZCbWJ6oXKGra665Zqi0WaKrP4mTO4aQRo+Ua6Glr9XVv93cu9jXweDeyunlyunkx+bhxOPcw+DaxN3bxtzcxdvcwtjZvdbVu9XTu9XTu9XTu9XTvNbUyN7c2uvp5fTx6vn36/v46/v46/v46/v46/v45/n14fTv3O7qzt7drsDCoLS3m7G1eqClbJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPH/vrs/vvs+vvc9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9frQ5enP1trO0tbLvMCymJuKiYx5hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol3iYx8iox9i41+m52N4+XS5+XQqJ+Bj4NcjH5RkYFOpJFV79Z7+uJ48+JszsNx/fnH+/Xc+vbf8+ms7t949uai+fTMv61o6Mte99tg+d9j995fyLlg+O2u9vTE+fPJ5s+O17prza5Uy61S9N1k8N989eyh08+l/fza/PjT8Nmf4sqJ3cqK3s6Px8GP+fTT2de5zMqs4OC/9vfU9/jV8/PO492v6ea48O3B/PrR/PTF++64/vG8+fK33d6pkKuaWoyUNn6LRo6bRo2ZWZ6oYqewTZKaZqqzY6eyS5SePYiSNn6JY6Kng6+xvtzcvdrZvNnXwNzaxuLfyOXiyujky+rmy+nkyObhxuLext/dx9zdxtvcwtjZvdbVu9XTu9XTu9XTu9XTwdnX0eXj4PDu6fn26/v46/v46/v46/v46/v46vr35Pby3fDszuDercHDnrO2gaOobJiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9fC2/fnm/vru/fvo+PvV9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ6/DQ19vP1dnO1NjNys3AwcOxqauXkJOAiIt4hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2iIp5iox9jY+Avb+u+fnn/f3r6ObJxb+PraFsqphfvKZosJdK1cBb1cNMspxU++6z+vO6+vrf+/XR9+WV7NVw9+yU4c6HwKNG7NFY+uFl+OBc0btM8t+T9uqg+vLG49GM0bFTp4g7xatY+OBj8dxm8+yM8+60/fzT+/XF8t2b69GN3MN8yrJm/PO8+vK79/O68eyy8fC/9vfS+PnV8O7HyLiGybqG39am/PnM8ey16teK+uaM8+iVs8ScUIeNP4qRP4yUQ4uXOYCMW6GrVZukVpukS5CaWp+qRI6XPYeRQoaSgbS7qcnOvdraudrXvtvavtvXvtvYwN3Zw9/cxuLfyOXiyujkzOrmy+nlyebiyOHgyN7extvcwtjZvdbVu9XTu9XTu9XTvNbUxdza2evp6Pj16/v46/v46/v46/v46/v46/v45/n14PPvzuPgrcHDi6mtbZiebJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+6r+/bZ/vru/vvt+vve9/vS9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8fbQ29/P1trP1dnO19rP5OfY8PHd2tzIvL6rn6KOjI97h4p3hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4l3jpCApqiX5+jV/v7s/v7t9PXa5uW34d6t3dSd28iIy7Z2noRIq45FtJlU9ueq9uiV+++s/fbI/PPI8uKQ6dJs3seEo4RB07ZQ9t1g+d9Z5ctQ69V8/OuP+e627uOw1bhqrZE9uKFH9+Nq9uN3+u+f9vGz+vbE+fC18uCY6tKF5sZq9+J29eaB6uN73diTt7J74t6h8fC++fnP8/PIuq56oI1Rsp1f+e2c7eqpqZhR1cBi5eObfKGTP4CMQImSO4WOSI6bT5ahTJSeV52oYqeyYKWwSY6ZNoGKO4SOVZeimMLLw9zhut3at9vXv9rawNvav9vZvdrXvdrWvdvXwN3Zw9/cxuLfyOXiyujkzOnmzOjmyuPjyN7fxtvcwtjZvdbVu9XTu9XTu9XTv9jWz+Ti5PXy6/v46/v46/v46/v46/v46/v46vr34/by0OThn7q8cJqgbJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPH/vrt/vvu/fvq+PvX9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9frQ4eXP1trP1trP1trP2dzR7vDf/P3o+vvm7e7Z0dK+srWhlpmGiYx5hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2hol2h4p2j5F9o6SP5ejS+/zo/v7t/P7u9vni6ei75uW05uCp4M2Kzbt8pYtJ6clr9N1p4c9959yS+OaK/eSP+uuc9+mf6NaQ076ErJBMt5hE6c1f+N9Y7tNX5Mty++mM+eqe+PHOxLV9w6xPvZ1A79di9+aM9ued/PW8+fTL+fLB8+OX4Mde5sde9uJq8eV98uufuLSIqaNw5NiI6t2J+fjJ2tizpJ5yi30+nos7+uN18eaEpphF08mFi6qWQ4OIOoSNPoGNNHiDV5+pVZ2nYKexYqmzVp2oSpGeP4aSPouUOoOMbay3qtTbwNndu9vXxuHgyN3exNrbwdrawNrZvtnYu9fUudbSuNXRtM7Ltc7LuNHOu9PRvdbTvtjVv9jWvtTTvM/PvdDRvtTUu9PSutTSutTSvNbUx97c2+/s6Pn26/v46/v46/v46/v46/v46/v45/j1yuDefqWqbJiebJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9/G9/vrq/vru/vvu+/vj9/vT9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ5+zQ1trP1trP1trP1trP3eHU9Pbj/f7p/f7p/P3o9/jk5OXRx8m0qauXkJOAiIt4hol2hol2hol2hol2hol2h4p2jI56mZqDsrGV1M+r2tCksaR8+PbY/f3r+/7u+vvn7OW14tiZ38+F7dWN3sqLsJdU27xZ+uJs+eOBy8F48uaT+ueE+ueI8+F96tuFrptfxK1Pyq5MuJhD9Npg17pOyLBY8eCa+eqj9/TK6uS2zbxnxaJL07RU6NN81L1h9uih+PXU+PfV7eGe38Zn2LtU9eNw7+CN6+Km7+zN6+O179iF6tJm7uqpy8iiwb2TgnhBv7BY9Nts+d17oZZahZ2NTomVLHqENoSMOH6JPIGMS5KcUZiiTpagT5ahV56qSZCdRYuZOIeSQoqRkMjPt9zeu9nZvNnVzN7dzt/fy93dxdjYuMvLp7m4mKalkJ2bjZqYgoyJgImHgYmHgYqIgoqIgoqIgouJg4uJgoqIiJGQk52claGgobGwpLe1rsTCssnHu9PRy+He4fPw6vr36/v46/v46/v46/v46/v45fb0osLEbpmfbJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9e+y/fnj/vvu/vvu/vvs+fva9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ7fLQ2NzP1trP1trP1trP1trP4uXX+frm/f7p/f7p/f7p/f7p+/zn8/Tf2tzIvL6rn6KOjI97h4p3jI56mZqDsrCV0Mup6OC29Oq49uuv9Oag6NeCsqZ+9fLU+frk/fvf9eu64tGI38hr28Rg5tOE0LluqY8+4MZZ9t1z9uWAw7Vn9umG+ueG+eZ89ueJ4dCD38lgy7BFxKVLxqtDyq9M48xix7Jm+e6u+PfA9/XH4daS071vzLdv38l838JZwq1Z9/LF9/rU8/XN5tmexa5U9eGA5M6AxLR1+vrY+vXU8d2U7M5h8+WQ0MiQ7Oez1s2J5NqG7d+O3s+Je5R+QXmGOX6KNoOMNoGKSpOdV6CqTZWfXqWvSI+ZW6KuT5ajSZCdRYyZO4ePba6yqNbXu9zbudjWvdvXzeTg0eThzNzaoayqhIuJeoB+d3x6dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnx6eH58eX99f4aEgouJjZmXk6CeqLi1v8zK2+nm6Pf16/v46/v46/v46/v4xt7ed6ClbJiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9O6t/Pjb/vvu/vvu/vvu/Pvl9/vU9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ8/jQ3eHP1trP1trP1trP1trP19vQ6Ovb+/3o/f7p/f7p/f7p/f7p/f7p/f7p+vvm7e7Z0dK+u7yl0M2u6OG49Oq49uuw9emn9eig+Oqe+umb9d2C8eB+1MmN7+y29e+6+/TB7d2c4MZ5zLNQ07pdz71uoo480LJO2sFQ5tJZ6NhyzcJo+OWG/Oh++emJ+uqU7ths0rdN0LNOv6RHx7Na79pi3cJf0cWS+vbA7u2m9vG08++66+O34M6W2rpW5MZewbNv/ffD9u2q+PG84M+H5s1817pltaRh+fjK+fXH+/G49NJz7NVx0cJs7uKa59R78eKG1NmrepuTOXiFLHmEMX+JPIeSQYuUUJehYqmzUJeiWJ+pRIuVRYyYQYiVSZCdRoyZV52iicC/t9vXvNvZuNbVwuLdyeXg0ebiucfEfoSCdnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5eH58fIF/j5aUq7WzydXT3uzq6Pj16/v44fPxlbi7bZiebJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2o+vbR/vvt/vvu/vvu/vvt+vve9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9frQ4+fP1trP1trP1trP1trP1trP2t7R8fPh/f7p/f7p/f7p/v/q/f7p/f7p/f7p/f7p/P3o+vvl/Pvg+fLE9Omn9Oee9+ed+uec++Sa+eCW89eH79Nn8d1zwLJx9+mb9eqW9equ6daQ1L9nz7ps08N/s59IxqpFyq5A1LhL2sJN2sNauZ1N4Mdi6NZt8+KG8dxl279T07lPzbNPqJNI9OJ58tBiw6tf5dma6dyM0MKB3tuk3duy8ujC3MZv3LxQ1b5g1ch78dxr9uaM9uif38l/0LVTvKRX/vS79uaK+OqY+d+L6M1g4ctp08R/y8aCp7mOZpeVO3yLN4aSOI+WNoqUPYqUUZmjUJiiVZymZKq1UJaiWKCsQouXQoqWR46bTpSgXp2knMLDwd7XvNjWwdzczOXj1Onm2OjlpK6reH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5eH17f4WDkJiVq7WzydXT3OvpudPUcpyibJiebJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPF/vvp/vvu/vvu/vvu/fvo+PvV9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ6u/Q19vP1trP1trP1trP1trP1trP3+LV9vfk/f7p/f7p/v/q/v/q/v/q/v/q/f7p/f7p/f7p/f7p/f3k+vbQ+Omt+OCb+N6X99yS8tmJ6tN94stg9t9k5dFq3896+uR8+eR/9+SQ5NOH4daa8Oa43M2MzrZoxqRFyaZHzbFFzrBPsZBGrY5Hz7hg4sx77NRq4sZb2b9WzrNMsJRJ8d+Q+uB25MJftZ1Ix7Rv28NnvKhcxbqB+/HI7eCm17tg1LRXtZ1L9ddh+OBw+OaU3M2N28d717x2/OWN9+Bt9ON38uij7NyP6NmNnKyNY5SSRoaMN3uGNoOOPZOdMIeRNomVOISQSI2ZXqKtT5SfZaq1VZuoT5ajRI2ZQ4uXR46ZQIeRd6qwrsjMvtnXvtjXzOTlz+Tj1unm3u7r0d3bkpiWeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5eH17f4WDkZmWo7Kxd5qebJedbJiedaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9/K8/vrm/vvu/vvu/vvu/vvt+/vg9/vR9/vQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvQ9vvQ8fXQ2t7P1trP1trP1trP1trP1trP1trP5ejZ+vzn/f7p/f7p/v/q/v/q/v/q/v/q/v/q/f7p/f7p/f7p/f7o+PXX6eCu6Nyj6NiR4M9828t018dr685e/uBl5s1n9d52/uBm/eBo+OJ59+Wc9OOm+PC68+u64c2PyrJgv6ZEzq1SspNDxaVK3Lpk3L923sJz17pZ6c5o1rtUyqhZy7tu++WL7MpY4MFe071m28Rb2btWwKph+uyy+fGz48170rJTkn817tt18uN49uWV8Oaj8umq+e6y9uWM8+Vy4uCJn7uVtsOa8uqqj62aQXyOMneJLXiFOYyWNIyVN4qXOomYSpKfSYuYXJ6qT5OeTJGcVpypP4eTP4iUQYqWTZakSY6WgaiqxdrdvNbXvdnWz+Xk1Orn1O/l3vLv6fj21eLgqrOxho2LeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5eH18dIKCbZKWbJiddaCjhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9e+y/fng/vvs/vru/vru/vru/frp+PnS9vvQ9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvR9PnR3+TQ1trP1trP1trP1trP1trP1trP2dzR7e/e/P3p/f7p/f7p/v/q/v/q/v/q/v/q/v/q/v/q/f7p/f7p+/zl6OfC3tyv3tqq29SU3c9+3815275Z9tlq8thyzrVd+OBq+eFj9txe6Mxm2cRr9d6H9+mf7+qu3dWc1MN+xqtUoYg1zrNL3rhO0bNq1r92zrRR28Fb38Ne0rNTxrZo9eGB4chb4str28RxsZtF175QvaNL++SV+ueX69yDzrpdrZREyLRZ9eKU6tuA6t9+9uyY+PK46uetvMeRhKqTVZaWXYZ+gqSWSoWPKXJ+JXiCNYqULoCLNIaRNIKRSZKjS5CfaKq3bbC8UZWgXKCsSY+bRY2ZRI2aQIuYQIybd7G2kbKvvtrXudfSwNzY0ebj1uvo2PLu5Pj36vv66/v55/X00t7cqrOxho2LeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dXt5coWGbZSZdZ+jhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9O6t/PjZ/frm/vrr/vru/vru/vrs+fXR9vnL9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vR9vvS6OzT1trP1trP1trP1trP1trP1trP1trP29/S8/Xi/f7p/f7p/f7p/v/q/v/q/v/q/v/q/v/q/v/q/f7p/f7p8/PX4N603tuu39uk5NmO38t+0rtf1r5S89ti3cZdu6JR5tVn8N9n38dU1b5k5Mxs+eKL9OaOzMSG+e++39CVtaRjtKFDz7Fhv6dnybd62sZ628Bp2L1YzK5NqplQ485p4cpk59eF9uCI8914o41BxrBa481v+uR/7t5108N0pJFRvqlh4tGF3spd4cxc++mT6Oeykq6iVoWOeqKZXZCRQn6GOn2LK3mIJXiCLIqRLoWOJXaAJ3WBOYSSVZyrWp2rXZ+rYKOuTZGcTZOeOICMRo+bQouZSpahSpWccJ2dvtjVvtrXutjSxuHd0uTh1+nn2u/w5Pn55/v66fv66/v66/v65/b00t7dqrOxho2LeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dXt5dXt5dXx6coaIdpyfhK2t8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2o+vbQ/Pjg+vXc/vru/vru/vru/Pbf9vLC9vrO9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vR9/vS7vLU2NzP1trP1trP1trP1trP1trP1trP1trP5ObN+vrb/f7p/f7p/f7p/f7p/f7p/f7p/f7p/f7p/f7p/f7q+/zn6+rI392w3dqf49SB5tCC0r9g0bhT38RT+N5k4sxiwrNn0L1e3sFc3sFw0LZa4sNf8Nlq5dR02s169+yj5tmX1MV/59SH9+mZ9PO59vPG7Nur2MF1x6xSs59Q0b1mx7951ciI9dp/+d9z6NN5taRhuJxN1cRi6td4laN7S3JxXoFzsbaE4sZr48dvzMeOfJ6PSIaIWYiIusiraJSPM3N+NHiFMHyLMIuTLo2VK3+JK3iDMX2IT5mmXqWyZ6u4YqSwU5ikV52pPIKPQYqWQ42ZRpGdQY2YVpufhaimvNrUvNnVvNrVx+Dc0uTi1ebk2e3t4/j55vr65vv65/v66fv66/v66/v65vb10d/dqbOyho2LeX59dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dXt5dXt5dXx6eI2Mg6mp8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPF/Pnh9fDJ/fjn/vru/vru/vnr9+/D9fTC9vvQ9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vS8/jW3eHR1trP1trP1trP1trP1trP1trP1trO4OHA9PG4/Pzf/f3m+vvl+frl+frl+frl+frl+frl+frl+/3o/f7r+vrj6+a53taPy7hV0btm4MtzyatLyqpI2rpM7M9c8t9/1Lpc0K9Y4MF1zLNX1rZO3sNQ175Zpo465NV39eiN9eeZ9eSI7t9u9u+e+fTC1syn8ue+18ODtqhqj5VoX4Jzkpdr0LJR4cVb8dpv+OyZv6pf0MVznq2CUIKAOnyBKnJ/UoB9i5d1kaOEYpWTQ4aRQn2LPnN5R36CK2t4JGt3M3uHN4SRK4GLLoSRK3uGRZCaSpSdXaWxV52pVJikYaSwRoyZQIeUQIiVQYuYRI6aRJCbRY6ZXpKcpsnHu9vVvNrWwN7ayOLe0OTi0uXj1unp4/f35vr65vr65vv65vv65/v66fv66/v66/v65vb10uDftcC+kJeVfIF/d3x6dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dXt5dnt5d359fpiX8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9/K8/frj9fDI9/LT/vru/vru/vru+/TW9eyz9vjJ9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vR9/vS9vrX4+fS1trP1trP1trP1trP1trP1trP1trO4OG/8e2q+fbK+fLD29ivyMinv8GkvcCjvb+jvcCjv8Gl0tW5+/zn/fzl+fPO5tqa0Lxqzbtj4ct8uptCz7BY0LFM2rpF4spR4L9SyahD0bVnzrRjyqpD6MlY0bZTvKNNwqhQy7Ze8d6E1cJk7Nlr8t9s4dJv6+Ka+vbK8uvGoqyRQW10MGx5dI1zzLZb1LpU1LpS1MRwm6h7fJ2NZZqehaqec6CeXpqiSpGdWY6dfqecWJWSN3+KL3B9LXF9KW9+L3WNK3OBMnyJQo2aNYCPQI2eQIyXUZulYqu1UJSfRYqVTZKdP4WQR4+bRI2ZN4GNPIeVQIuXQY6ZUpWgaYyat9nXvNvXvdvYw+HeyuXgzeTg0+Xk3Onp5vLy6Pj45vr65vr65vr65vv65vv65/v66fv66/v66/v66fn42+nov8vKnKSigIaEeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5d39+8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9e+y/fnf+fXV8Oq5/Pjn/vru/vru/fno9uy59O+39vrO9vvQ9vvQ9/vR9/vR9/vR9/vR9/vR9/vS9/vX6+/V19vP1trP1trP1trP1trP1trP1trO4OG/7+yl9fPB/fjM9+uq6d6ezMeTtLSLqqyHrrGLwMGVuLV/z8iZ+vO//vjH+PG05tmS2s2J49CN17ptsJRMzrNPyKpF0rRG0rA83LpR2cJsz7t1yK9T0K9PzK5Yp4dC2LZRzrJcx7Zozrleu59Dz7RV6tRr8eWC/fa5/fKx4eGoZ5SSPn2MUHt0k6F3pq13q7aCfpp+R3uEToCOc6Cd3+GzeZaLWpWcR5OfdKem0OC4Y5CIL3R/LHJ8NH2HJW96MHuHMXyHMnuHQ4qXL3SDX6KubbC8UJOeYaSvWZ6pTJGdWJ+rRY2ZMnuJLXeENH6LOoWSPYmWQZKbZaCllrWzuNfUvNrWvtzZx+PhzOTg2Ojm6O7v7fDy7vDy7vHz7PP16fb35/n55vr65vr65vr65vv65/v66fv66/v66/v66vr54vHwydbUqbKxho2LeX59dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt58+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m9O6t/PjZ/Pjf7eet9vHQ/vru/vru/vrt+fHN8+ip9fTB9vvQ9vvQ9vvQ9/vR9/vR9/vR9/vR9/vS9/vX8vbX29/Q1trP1trP1trP1trP1trP1trO4OG/7+uj8O6z/fzg/vbF/vCo++yk8OSg39ec29ee3tSX2caFvqFbup5R9+R/9+R89ud/8ueO8+OY4tKKxK9du6FMzrJLyqpGw6JF3sNy6tuPz8OO4dSW075yy7NZq5BEzLddt7J6maBzybNmz7RS0LRYt55I8t5y8txx69lzys2SYZKVRn6FfJ2Qkq2bZ5KWVIydTYyXV4OQZp+oYp2cjLSqcqqtT46WSIuYVY6LaZeSRoeTM32GNX6ILnmDNH+KRJCbSJOgLHaDNX6LRYuYZKezbbG8U5eiRouWUJWhSpGdOoKOMHqFOYOROYSSPomXQo2cQo2bSpOebp2kuNbTvNrXvdvXwuDdyufk1Oro6e/w7vDy7vDy7vHy7vHz7vHz7vHz7fL06/T26Pf45/n65vr65vr65vv65/v66fv66/v66/v66/v65vb10uDftcC+kJeVfIF/d3x6dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt58uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2o+vbQ/vrl8eu67uex/Pjn/vru/vru/ffj9emy8+qs9ffH9vvQ9vvQ9vvQ9/vR9/vR9/vR9/vS9/vX9vrY4eXS1trP1trP1trP1trP1trP1trO4OG/7+uj7Oml+/vc/v3h/vS7/vCm/u+l/e6l9OWb6deX2L1/0LJyw6VXtptC+d5o/OBv+eBw9t948OCN3sx2wahXyKtOza9I0K9c4sx77Nt/0MiH+vbH9e3B38+JtKhieoFiRXBuUXpuxLFtza5Rya9PuKBR1Ltg9Ndm6N2Pe6SXQH6KW4J23dKY9+qnv861bqCsZKKwaqOuZJyxY6Ssaaaub7K2ZaStWpelQXqKQn6RQIuWOYWOMXyGRpGcPomVRpGePYeULneEYqq3ZKu3UZSgXqOvWJ6pV52oSY+dVJypQYuYN4KNMHuJLXiFN4GPOYORQIuXcq24mr3EutjVvdvYvtzayefiy+bk1+rp7fDy7vDy7vDy7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7PP06vb35/j55vr65vr65vv65/v66fv66/v66/v66/v66fn42+nov8vKnKSigIaEeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt58uyl8uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2m8+2m8+2m8+2n+PPF/vvm9/PO6uKf9vHQ/vru/vru/vrs+O/F8+aj8eyy9PfJ9vvQ9vvQ9vvQ9/vR9/vR9/vS9/vX9/vY6OzU19vP1trP1trP1trP1trP1trO4OG/7+uj6ead9/bQ/v7o/vvZ/vO1/vCm/u+k+ume/Ous69aV1rxzx6tKvqNItJg/991y+t9t9eFx9umf7OCd4dCD2cRxzr1ky7ht3MV507NVz8Nt/vGw+/HF9ey2kp98R2hpS3J3RW9xoqN0w65ex7JXybJUvaZP5NOGjKSPSJOeNH9/XIN1u7Fy1suKrsCvXpOhVJCbXpqkb6qzcKq0cqu2dbG6aaaverjDbKm3W5qnS46aNn6IPYSRUZqmPIaTPoeVTpelSpKeTpWhUJekUJSiXKGuUpqmVZ6qS5OhNX6MK3aEJnF+MXyKPYeVQouZP4iUVJugeqisttLTu9nXvdvXwd3bz+bm0ejo1ujo6+/x7vDy7vDy7vDy7vDy7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7fL06/T16ff45/n55vr65vv65/v66fv66/v66/v66/v66vr54vHwydbUqbKxho2LeX59dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt58+6r8uyl8uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2m8+2m8+2m9/K8/vvl+/fc6uOh7uev/Pjn/vru/vru/Pbd9Oir8eSi7Oew8/bJ9vvQ9vvQ9vvQ9/vR9/vS9/vX9/vY8PTW2d3Q1trP1trP1trP1trP1trO4OG/7+uj6OWY8/LB/v7n/v7o/vnS/e2l/Oma+uWT/Omk9uSc5tGDx6xIxatJuJ1Jp4tBx7JS5NR96d+e7+eu+/Cj9OSKxMSOa4NuoKV0yrJYqphE79WF/O6j9u6rqbeTjp+FzNGta4mEQGpxcIhzpqt1urZ5n6d9iqSLRoKMPYaSLniANHF+WoSHd56Xe6q5TIiTaKOvdq66fbO+kcTRhrnFdq24aKKtca24YJ2qZKOvTZCcVJulOoGNQYmXPIaUNn+OT5imYam1UpilXqWyVZuoQomWSpSgPIiTPYeVNYCNJHF+MoCNP4uYQo6bO4WSQ4qWbqOkjrWxsc/Ju9nVutjUvdvWyuPj1Obo4Ons6Ozv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7fP06vX26Pj55vr65vr65/v66fv66/v66/v66/v66/v65vb10uDftcC+kJeVfIF/d3x6dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt59/e48euo8uul8uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2m8+2m9e+y/fng/frk7+mx6OCZ9vHQ/vru/vru/vnq9+2+8uSh6dye496q8/bI9vvQ9vvQ9/vR9/vS9/vX9/vY9PjX3eHR1trP1trP1trP1trP1trO4OG/7+uj5+SW7uyx/f3j/v7o/v3j8eOo48p17Mxr9t148+aO9OSZ2sNhx6xExapJrpVDzbJYyKxe2cNzwqtVvKhT4Nl6lKl+MmZwZIJ1zLZtxKRVp4xB5tVrxcmMa4uBvb2C59WAqbmZMGZ0I2NxMmxyS4KCTYiQSIuUSIuSOHeAOHaBVJGcYZqpbaSvaqKuVpGXgbrEgLbCeq66grTBjb3Je7G7ebS+dbC8crC7YqKuPYCMPYSOSZCbVZypMXuIN3eIRYyZUpqmRo+aS5OfUJekTpejQYuWNH6JJnB9K3aDKnaDLHmGNYGPPIOTRY6aZKCpjbi5rM3JstLNuNjTudfUvdzZxd/d2+Xo5urt5+vu5+vu6ezv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7fLz7PT16ff35/n55vr65/v66fv66/v66/v66/v66/v66fn42+nov8vKnKSigIaEeH17dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5+fq89fKy7+ej8uuk8uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2m9O6t/PjZ/vvn9fDI59+W7uev/Pjn/vru/vru+/PV8+an7N6cxrqC29aj8/bI9vvQ9vvR9/vS9/vX+PvZ9/ra5+nX1trP1dnO1dnO1dnO1trP4uPA7+uj5+SW6eaf8fPN+frg/v7k9O7D175zyqlL1r5Wz8Fw8+677+Kh0b9pxbBVya5MwKZYxbNwxqlczKxIuapNl5xiWnt0YYmGTHZye454v65pvKRXq6hiY4VyKl9tna6FvcKKWId+J2lwLXGBNnqJPoOOQIWOP4OMXJ6oXZ2oYp6pebG+erG8a6Grib/JXZOdbqSveq+7jL/MkMPPjL7IcaawZJ2md7K8aKWwYqGtWJumVpymTJSeNHuHP4eTMG9+PYWRT5mkT5ikUpunUZqmSZKeKHF9L3iEIGh2N4CONYCNPYqXQY6bP46YV5egbpKZn8DAsNDOs9LQuNjUudjUvtvZx93e2eTo5Ovu5uvu5uvu5+vu5+vu6Ozv6+7w7fDy7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7fL06/X26Pj45/r65/v66fv66/v66/v66/v66/v66vr54vHwydbUqbKxho2LeX59dnt5dnt5dnt5dnt5dnt5dnt5dnt5dnt5+fq8+fm78u6t7uWh8uuk8uyl8uyl8uyl8+2m8+2m8+2m8+2m8+2o+vbQ/vvo+vbZ6eKd6OCY9vHQ/vru/vru/fno9uu38uSg18mKrqFu2dSi8/bI9vvQ9/vS9/vX+PvZ+vvh8/DX3NzD0NPEzdHDztLE3N/R8fDM8e2l6eST7ueT7Omw6+y/+PS7+PfC5dSV0rJax69NpJNW6Nyd9+aj8tuF4c12nZJObYFsSm9lhI5ooqFqc4xrR3h7U32H1NWgo7eYNG11VndxgJFzWX1yNGtxKGx5PXp9RIKCNHiGP4mTMneGPYGQQYaSP4OMSIqUXJymXJumcqy4dq66bqWwcqq1c6q1eK+6f7TAi77KjL/LjL/Lh7rEg7fBgbjCgrvFXZqlWZejW52pVJqlS5KcS5KeTZWhPoCORYyYPomUSpOfUJqlSZOePYaSNH2JJG15MHmHMnuJMXyKSpekSZWhSI2TYY+TnsTDpsjGttXTuNbUvN3YxOTgx+ThxN7e0eXn3evw4+3x5uzv5uvu5uvu5+vu5+vu6Ozv6+7w7e/y7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7PP16fb35/n55/r66fv66/v66/v66/v66/v66/v65vb10uDftcC+kJeVfIF/d3x6dnt5dnt5dnt5dnt5dnt5+fq8+fq8+Pe57+em7eSf8uuk8uyl8uyl8uyl8+2m8+2m8+2m8+2n+PPF/vvn/fni7ear5t6S7uev/Pjn/vru/vrt+fHN8+Wk7d+csKJqoJNi2dSi8/bI9/vR9/zX+fzd/fvp9+/D6N6fw7yQrquHo6OC1te7+/ja9eul7uB88eOG8t6U4cqL5dZ18eeL9++w59mV0L1z1cWM18BttJZO7cpo8NprsrV2L2RuJ2V1M296OHJ7MHF/KGt7PXV7iqiNcJmLPHyEJW6AJWt5L3aELXSCNX6ML3iFKnN+OoGMPoaRPYSRO32LNHaCVJWfc7K8ba25Xpypbaezg7rFZJumZZynY5qlgbjDhbzHi8HKir/Ii8DKh7rEg7jBgbrDf7nDYJ2oX5ypXaCrUJehRYyWPYOPQoiVSoqZQYCPK3aBR5CcUZqmQYqWOYKOMXuGOIKNOIGNQouXNX6IPoWNTouVYI+Vm8DCnsHAstLQutvWsNDMudnVxeXhu9jUvNLQx9zez+Lm1ufs3evw4+3x5uzv5uvu5uvu5+vu5+vu6Ozu6u3w7e/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7fL06/T26ff46Pr66fv66/v66/v66/v66/v66/v66fn42+nov8vKnKSigIaEeH17dnt5dnt5dnt5+vu9+fq8+fq89vS17eSi7eSf8uuk8uyl8uyl8uyl8+2m8+2m8+2m9/K8/vvl/vvn8+7A5t6T6OCY9vHQ/vrt/vru/ffj9emx8uSg18mKjX5NnZBg2dSi8/bJ+PvY/Pzm/vvq9u237uGZ3s2PyLWAtqZ00cSR/fPG+e/A6taC6tJt69KD2Lt60L5o9+dy++d76Nh+3NKGzsiK079u0bZZzK1R18dwd5B9Lmh6JGN1J2d4Jmh4KW18LXR/OICKMXqEM4CIP4yVO4WQOYKQN3+ONX6MKnOBN4CNVZ+qQYmVQ4qWQ4iWbK67dLbCYqKuc7C9XZqnerTCc6u4gbfDZ5+shb3Jdq67cam3cKezeK24bKGsf7O+g7jDgrbBfLS9ebK8cKy4Y6GtYqWwV5ynUJagVJilVJqnWJqoQoKRMn6IQYmVQouXKHF9M3yIO4SQO4WQPYeSL3iEQYWNT4OIVoyNg7KznMHDm72+s9PRu9rYs9PQs9TQstPPssnIus7Nv9LRxdjYy9/h0OTo1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu6Ovu6u3w7e/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7PP06vb36fn56fv66/v66/v66/v66/v66/v66vr54vHwydbUqbKxho2LeX59dnt5+vu9+fq8+fq8+fq88++v6+Ce7eSf8uuk8uyl8uyl8uyl8+2m8+2m9e+x/fnf/vvo+fXU6OGa5t6R6+Sq+fTg/vru/vrs+O/F8+Wi8OGevq52gHFDn5Fg5uGm+vfQ/vzp/fvh9Oy07+GZ5tWU3smI1r120Lli9uKA+PC49uuv79J96cyAybBm1MZt++Z29Ndo4L5Yx8J6b5J7naV60sJrzbxll6B1NGp5KWh6LXKBQoqXP4aTNXyINH6INX+FLnV6LnR8L3aFNn+POIGPNH2LNH2LOoORSZKfQImVU5unUZekTJCeXqGuZqm1VpekWZmmVZOgdbG/fbfEe7TAVY+caKSxaKSxe7bDZp6reK66erK9drC7dK64ea66j8LNiLzIdbK8ZKOuZKaxYqexUJahVJqmUZilQYeUO3aHNH2JMXuHImx3LHWBNoCLTZeiSpOfUZqnT5WfXJehgLGyg7i0jbi3mb+/ncHAr9DPt9fVtdbTrtDLqcfEtsvKwNHRwNHRwNLRw9bUyNvczuHl0eTo1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6ezv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7fL06/T16vf46vr56/v66/v66/v66/v66/v66/v65vb10uDftcC+kJeW+fq9+fq9+fq8+fq8+Pi68Omp6t+c7eSf8uuk8uyl8uyl8uyl8+2m9O+s/fnY/vvo/Pjf6+Sl5t6R5t6V7OW7+fTj/vru/PXb9Oeo9Oai7t6epZZfkIFHzbxl+u6r/PjW9/bZ9e/B7+Ka6dWP6NSQ2MR1xq5V9N5u8+B++vCl9eef59GIsZlLuqhYzbJY3rxU28Jqg5l3MHF5OXF3X4NzYYBtQXN2NHuGNXyKPIaSPoqUOICLRYuVLXJ7M3eAPoCIOn2DNXmFOYCOMHmHM3yKKnKAN3+NSI6dQYiWWJ+sTJKfYaWyU5elU5ilYqaxW52pVpmlVJaib7C7Zqexb6+5ZqWxXJuob6y6WJahbqu2U5KcSo6XSI2VaZ+qj73LhrbDca+4dbS+ZKSvZamyTJSeVZ2pSZKeUJmlQoORI2p2L3mELniDL3mEN4CMSJGcOYKNW52qU42WeqOpkL2/j7q7lsDAo8nJpMjHmr+9mbu5ncG+o8O/uc7NwNTSwdTTxdXVw9TTwdPSwdTTxdjYy9/hz+Pn0eXp1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6ezv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7fP07PX26/n56/v66/v67Pv67Pv66/v66/v66fn42+ro+fq9+fq9+fq9+fq8+fq89/a37uWj6t6b7eSf8uuk8uyl8uyl8+2l9O6p/fjQ/vvo/vvm8eu55t6S5d2Q5dub7ebG+fTk/fjn9uqz9OWf+umj5tWJzr9wtqVO9OWS/ffB+fXL+fLG7t+b5c5x5dGN1sVprZU/6dFq+eFz+OeCwsqNoax/t6Vfz7lkx7JmzLh0k5ZuPm1yIGFzJGNzJmZ1LnJ9MHaBM3qFM3iHRIOTSoiXQoOQP4SON3iCP4KLR4GMU4GORH+MMniFQYqWRo+bQYqYQoqZP4WUSI+eQoiXRYuaXKOvVZyoSI+cUpilS5CdUpijWp2pYqWwVpqlZ6q2U5WhUZOfVZejYaSwOn6JSY+ZSY+aSpGaeLbBdbC6bqq0b662c7G7cbC7aKu1VJijRYuXRo+bSZSfPIaROX+LQISRMnmGMnyHImp2PIaRVZ6ka5+pd6ClkL69h7KykLu9mMLCoMbGlbu5ha2rg6amiqmppLi5xNPVxdbWxdfWxtjXxtfWxdXVw9TUwtTTw9bVyNvczeHk0OPn0eXp1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6Ozv6+7w7fDy7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vLz7fT17Pf37Pr57Pv67Pv67Pv66/v66/v69/nF+fq9+fq9+fq9+fq8+fq89PGy6+Ge6t6b7eSf8uuk8uyl8+2l9O6o/fjH/vvm/vvo9/PO5+CX5d2Q5dmO6t+v7ufK+fTh8Oa45tN/9Nh48+GO3tCAybJdvadg8eOY8eWP9Omh8OehwL6FsrGD0r1ttp1MrZQ76M5g1M2HaJGDPXB4e5F7oql+hJiBXYZ9OW52N3KBPoCTOYCSPoKTMneDMXaCNXqIOHyMQ4OUToydX6WwU5ijR4yWRYuTUpSciLvGeay6SY2YM32HNn+LPoeVOoKRRY2bXKSyRo2cSpGfO4GOTJKfSI6bS5KeQYiUR46aUJaiSZCbSI6bRouXVpqnU5ekVJilSYyZO4WQN4ONQIWQZKKvfbnFdbK7a6mycbG5ebXAcq25b6y5bq25VJekTpejSpeiRpGcQIWSQoaTNnyJNH+KJm97J3F6UpKZZZCUlr29ire0ibS0kry9ncXFlry9kbe3fqemhqupnLm4s8jIv8/RwtHTxNPUxdXWxdfWxtfWxdbWxdXVxNXVw9XUxdjYy9/hz+Pm0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6Ozv6+7w7e/y7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vL07fX27Pj47Pv67Pv67Pv68/jS9/rD+fq9+fq9+fq8+fq8+fm78u2t6t+c6t6b7eSf8uuk8uyl9O6o/fe//vvi/vvo+/fc6uOg5d2Q5tiK7t6f7eK02tKl9vHD4c+F2r1m2MiAz8Z11LlXybFYu6ZS6NFm3clh0M59bJCCV3p6p6d0s6ZenZFQlpdhXoF4MXCAKmZ8L2h0QHmDOXmIOIOOO4GQOn+OOX+PM3qJMniHJm18MXeGN3uLNXmIMnSFPH6OVZelW52pYKOuYqWvaauzd7C6iLnHaqy2O4WOM3yIM3yJOoOQPIWTSZGgPYWTU5upTZShQ4qXRY2ZOoKOO4WRQYuWP4iUQIqVTpejQomWT5WiR4uZQIWSOn+MNXyIMnaDTIaUcaW1f7jEdrG8ZaOsZqavebS+isDLib7LhLnHcam3T5CdSZGdR46aUJejRIiVOX6LKnaBKXN/JWp0Q3V9lb3Alr+/jri3kby8mMHCm8LDj7W2hKysjbi2nMC+q8bEtszMu8/PwM/Rwc/Rw9HTxNTVxdXWxdbWxdXWxdXVxdXVxNXUxNbVyNvczeHkz+Pn0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6Ozu6u3w7e/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vHz7vT17ff37Pr58vjV9PjO+fq/+fq9+fq9+fq8+fq8+Pe57+io6t+d6t6b7eSf8uuk9O6o/fe7/vva/vvo/fnh8eis592N4tR/7tya1cSK28Zr++6k9O21r7qUgJuFrrB00rZhy7Vfxrt5tLyDpbB6epd8PXV6MXN9Rnx4WoR1QnBsMm1xJW13Kmx/NX2LN32LQYKRPXyLRoaWOYWQOISQMXuIKXB/L3WEKnB/MniHMHSEL3OCLnGBQ4aVVpqnWZ2qYKSvXqKtX6Osbamzf7G9b6+4Vp+lPYeQMn2IPYeTQIqYRIybOoORPYaUP4iUN4GMPoiTN4KNOYWQOoWQPIaTLnmER5KdQYmVQYmVSpKeP4iUMXyHMXOBR4STZ6CvZaaxdLO+aKWwYZ+qYJ+pbqexj8HKlMLKnsrVmMfTdau4YJ+tWp2rTZOgPIGOK3J+LHiDKnaAKWlzfKCplr2+kLm5kru7lL6+kLm7j7i4jLS0k7u7k767nsK/rcvKss3MuM/PvNDRv8/Rwc7RwtDSw9PUxNTVxdXWxdXVxdXVxdXVxdXVxNXVxdjYy9/hz+Pmz+Pn0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5+vu5+vu5+vu6Ovu6u3w7e/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz7vHz7vL08vjV8vjU9fnK+fq++fq9+fq9+fq8+fq89/a/8eq26+Cg6t6b7eSf8+ym/Pe1/fjC+/fU/ffU+O676t+c1MuB28+SxKdd4sha8Ntu6+qhirGiSYWQZ42EkJ95hZx+YI2GTYeQP3qFRoaQOn+KJGt1L3Z/MHaBKnB9N36MOH2NOn2NOXyIOXuHVZmiWqCoTpaeSJKaPoGPLG17KXB8M3mILnWEMnmIJGt5KG59OX+ON3yKU5ilUJajUZajXKKsUpihZKKrf7S+d6y2YqGqVJ2kNoOLNICLQo2aN4GPQouZO4SRO4SQMXuGNn+LNX6LMnuJN4COPYaUPIWTMXqGOoOPVZ6qS5WhNH6KLHWBLWp5ToWWaqq2Zaazaqm2Z6WwYKCrYKCqda64kcHInMbLp9HVoczPkMDIZZupUpGhTZGfM3yILXiDJ3N+I3J6MWtykr7Bkru7irK0jbi5lL/AhrCyiLGxjbW1lbu6mr68krGwgp6dhaCfiKGhlqysrcHCusrMv83Pwc7Rw9HTxNTVxdTVxdXVxdXVxdXVxdXVxNXVxNbWyNvczeHkz+Pn0OTn0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6ezv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7vHz7vHz7vHz7vHz8ffV8vjV8vjT9vnG+fq9+fq9+fq8+fq8+PjA+vjW9vDG7OGh6NuT5tuH+PGb+/Oq8eiX+/Cm+u22ztKpgaSUhqGWu7h/zMRz0dCKqL6dW5aeSYyZTpCeSoqXRICKQHyGSYiUS4uXV5mlT5WfS5KcUZmjP4WQUZajTZKiO4CPWp2taKq2VJagZqu0X6auRIyUSpKbTo+dNnWEM3mGL3ODLnSDLXOCLXSDKG59OH6NOX+OTJOfU5qnT5WiVJulV52nUJCZfrO+fa24dKq1bKy0TpSdPIKNQomWPIOQRo6bQYuXNH6JSJGdRI2ZO4SQPoaVPIWTPIWUQ4yaOIGOSpSfUZynMHyHLnqFLXaCLG17S4mYaqu3ba66a625ZqizYaOvXp6pYpulhre9oMvPoczPpdDRoc3Udai2SoWWOXyKKXR/KnaBKXWAJnB5Y5SamL/BmcDBk7y9iLO0ga6vh7Kzha+wjLS1lbi4o729couMQlhZPVNUPVNUQ1hZVWtrbIGCi52fqbi7u8jLwc/Rw9PUxNTVxdXVxdXVxdXVxdXVxdXVxNbVxtjYy9/hz+Pmz+Pn0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6ezv7O/x7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz7/Hz6e7N8ffV8vjV8/jR+PrB+fq9+fq8+fq89/a8+PfQ/fzi9e/C49SD28Zl59d/+emb89118d1r9eOHxtOwaqCjTY2TYJSWXpGQYZebW5WiWJ6rUZSdYqKpSIaTTI2bTpKgR4mVYZ+sVZSgaay0ZaixX6KrXJ6qaay6So6dRouaXKCtWZynXaCpXaGqWqCpRIuUPoWPTY2bQ4GQOHyJKm59Imd2Imh3IWh3M3qJJ258M3mHWaCtVZypUpilXKKtWJ6pVZSeiLvHjrrHgrG9e7O9WpqjQ4GOPn2LQ4iUNH2JNH+LO4SQRI2ZNn+LR5CcRY2bQYqYMXqJOYKQPYaTUZqnP4mVL3uHKnSAKXJ/MXqGUpmlW56pZqm1Zqm0WZunYqWxZaWxd7C6jr7Fp9LVptDTqtPVp9HWjL7IWIycLmt3KHF+JnKAK3qCUIyUlLnAo8HFnsLEk7y9h7KzgKysh7Kzh7KykLi5n8DAgJyecpaWXXt8S2VnRV1fRV1fRl5gR19hTGRmXXN1g5eZqru9wc/Sw9LUxNTVxdXWxdXWxdXWxdXVxdXVxdXVxdfWyNzczeHkz+Pnz+Pn0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6Ozv6+7w7fDy7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/Hz7/Hz7/HzoqWI4ufG8ffV8vjV9PnM+Pq++fq8+fq89va79fLC/PnZ/PnZ59+d1Mp54Nqe9uyo896L6NyQ2Nefl765bLS9ba60ZaOsV5WeaqixbKqyYaGoba2zbK2yaqu0Y6Wxa625XqCscLC9XZ2ncrS3ZKKpYJ6pYaCsUJGfW5+sVpqlU5ihSY6XZamxX6SrXqOsX6WvR4+ZPX+MNXODKWt6HmJwJWp5IWZ1LXSDKG9+NXuKQYeVSpGePoWSUZilU5qnW6GrVpWddqu0kr/Lh7bCe7O8W5qjSoKPUImXR4iUM32IRJCbRpCbPoeTSZKeQImVR5GcOYKQRI2bS5SiQIiXM3yKKHOAJ3J/JW58KXKAIGl2Ro6ZXJ+rWp2pZaizW56qV5upV5emeLC7jbzDjrq9lL/AsNHWrtPYmsnIcJ2sRXyHK3B+KHOAMnuAeJ6imrS7lK+0oMPFi7S0fqyqf6uqhrKxjrq5jre3gaGii6urh7KyncPEncDBmry+mry9m7y9nby+or/ApcDCrcbHuM/Qxtrbx9nax9naxtjZxtfYxdbWxdXWxdXWxdXWxdXVxdbVxtnZy9/hz+Pmz+Pnz+Pn0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6Ozv6+7w7e/y7vDy7vDy7vDy7vDy7vDy7/Hz7/Hz7/Hz7/HzbGxSnqCE4ufG8ffV8vfT7u+48O2o9vWz9vW39vC29Oms7+Cf9++4y9e4qcjFs9C9qsezirSte6yyd7C9crK3aqquZ6auaqewg7jEjcLNgLnCd7e9Z6itY6avWJ2oW6GsUpmjTpagV56oXqWvTpGda6y5XJyqTI6cYKOwUpeiTJGZVJmhUpegTZKaXaCrVZmkR42ZJmNzI2BwFVVkIGJwIGNyIGV1Ro2cK3KBOH6NPoSSSZCdVJuoUpilQomTWJ+ndrS+ap2pfqq2hbXBea+4b6y0U4+ZTYGPSoiTOoKLSpafO4WRUJmlVJ2rPYaUQImXNX6MSpOhRo+dQ4yaQYqYRY+dOoaTLniGIWp4KHF9W6SvWqGrU5eiYKWvV5unV5ypaam3dq+6kcDHkr7BqdTWutvgud3hpNLUgrXCTH2GLGp2LXZ7UYyPrs7Qvtnck66xgaGjfKSkf62rfqqpf6uqhrSxcpqZosHBsNLUmcTHudzfvd7gv93ewdzcw9zcxdzcyN3eyN7eyd7eyd7eyd7eyd7eyd7eyd7eyd3eyNzcyNvbx9nZxtfYxtfXxtbWxdbVxdfWydzdzuHkz+Pnz+Pn0OTo0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6Ozu6u3w7e/x7vDy7vDy7vDy7vDy7vDy7/Hz7/HzZmZNa2xSnqCE4ufG8ffV4eS8urZ51M2C6+OE8OeW6t2J5dVq+++hztzChbbAfbi8gbe9f7e7fLO7grS+frS8jsLLerK6iMbMYaWyWp2sUpimSpWgUpqmUZmlUJihUJehUZqkP4qUQ46ZV56rTZWjRYyZU5mlVJmmT5SiRouYUJWgR4yVXKGqPXqGSImVRYeTQYSSImRyJ2d2GFpoGWFtKG99Imh3LnWENXuKNn2MOX+NT5aiWJ6rUZekSZGbUZegZqCriLfFi7bDjLzHhrvEd665XJqjUIeURoSPQoqTOISNOYOPQImWSZKfQouaT5enPIWTL3iGNX6MTpelQImXQo2aP4qXNH6LNH2LP4iVR5CdWqKtVJumWZ+rVZunXKCucbG/XZageqmwoMvPqdTXvd7kwODnrdDWib3DUoWLL2pzM3l+fqess87QutbWqsfHfp+ffKCgiLGvgq+shq+tf6elj7GwyOPjq87VosnSxN/hyuHiy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Hhy+Dhy+DgyuDgyt/fyd3dydvbyNraxtjXx9nay9/hz+Pmz+Pnz+Pn0OTo0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu6Ovu6u3w7e/x7vDy7vDy7vDy7vDy7vDyZmZNZmZNa2xSnqCE4ujG6O7KoqJ4jotZ5taA1NCQ3c5/6ddj7+qav9XHfrK5g7u/ibvBj8DFoc3TpM3UhLe8h8DHVJSbVJuiQpCdSpemRJGfRI+dUZmnRY6aU5ymVJulVJ2nR5GbPISQRIuXQouZP4mVNn+LS5SgNHuHOH2KQYaSL3R+P4SOOHiEOXuHMXB+MnWCIWVyKWp3HFxpHGFvJm58I2p5KG59M3mINXuKQ4qYOYCNRIqXUZilVZymXaOsWZeig7XCe6m1ksTOhbfBb6GtW5qjRn2JVJCcPoWPPIeRU5yoRo6dPISTOIGPTpamOIGQSpOiPIWTQYmYQ4yaQoyZQIuZPIaUQIiXP4iWQ46bU5yoSpGdX6WySY+cVpuoY6Owa6Suj77Ff6qwn8jPrNLZveHpr9PbiLu/b6SoSXyDYJmeqs3QudTSv9zZvtvZlLSydJaVl7y6kLi1iK2rjq+uwuDfu9bWiK+6m8TOxuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuHixuDhxN3dwdjZv9XWxtvdzeHlz+Pnz+Pnz+Pnz+To0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu5+vu6ezv7O/x7vDy7vDy7vDyaWlQaWlQaWlQcHBWrbCS8PTSzc2ssqyBycqslq2rnZ9z0M6QvNO8n8TJjMHFn8vSqM/aps7alsXPebS8VZigUpqkS5ijTZ+qR5aiSpekUp6rPYiWU5ypSpOgRIyYPIOOOIKNNH2JMnuHN32KNX2MMnuHM3yINn+LNn2JJmt4MHSBL3SAKG16LXB9K2x4K2d1KWt3L3F9LnB8ImFvIGBvImd2LXOCMnmIMXeGNXuKOoGPUJajVZuoVZuoWqGrTpagVpqlWJWfhLfAf6+4gbC6hbjCY6KtRHqGX5qmQomTM32HNX6KNH2LUZqoRo+dOYKQOIGROYKRRI2bQImXRI2bPoiVPoiWQYqYPISTPISTQoyZWaKuR46bSpCdV52qWp6rX5+rYpyma5ujkr3FnMbOk7zDmsPLmMPLiL7Ce6+1dZ+locrKtNTRvNnUwd3awd3aqsjHgKKglLi1mbq4mbi2wtzcyOLjss/Qfa24fK21tdfYt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9jZt9fZutjav9vdxd/iy+LmzuPnz+Pnz+Pnz+Pn0OTo0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu5+vu6ezv7O/x7vDyhYRphYRphYRphYRpl5d29PXU9fLS5t2x0te8l7zEh66ulLW0lsLEoMnOs9fetNfgn8bVdK24SpKbUp2mVZ6qUpunR5GdUZunRZCcO4eRMXyHM3yKN4GNNYCMN4OPOISQOYKQM3yJM3yIN3+KL3eDNXyIOICMNXyHOX6NLHCBJmp7KGx8Km59KWl4Km15KWRyJmNwKWZzJWRvJmRxIGJwH2R0MHaFOoGQIGd2JWt6OoCPVp2pUJejQomWRo2ZT5WiWp+rXqGpjb7HmcbQmsXQk8LNYqGtWZWgV5KfSpKeQIiUR46bSZCePYSSSZCcUpmmUJinSZKgR5CeRI2bRo6cR42cQ4mXOoCPNHyKOYGQQYmXV52sU5emTpOgYaSvZaawaqq1drO8grrCcZ6pmMTPo8zWl8LKjL7EerW8dq+3eJebs9LPudXRwdvYxd7cxN3bvtrYlLezk7q2nL27utPT1+nqwt3emsTKb6izmczUvNzgu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfu9zfvNzfvNzgvt3hwd7ixN/iyODky+HlzeLmz+Pnz+Pn0OTo0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vu5+vu6OzvkJF4kZB1joxviYZmhoRd9vbH9/PL4dSU3tWSss/FksLHlcDEosrRtdfipc3ZgLTAa6axU5SfWqOsTJigT5ikSpOfP4eUN4CMOYOOPIiQPYaOQYGMOHiCQIONP4KMOnaCNWx5OHB9Mmh0N2x3OG53NGpzPnd/QXyFMGt7MW6AJ2Z4Jml6IWR1I2RzL3N+Mmx6MWZ1KmFuIlxpJmRxJGd1KnB/NXuKNn2MK3KALXSDLHOBQomVWZ+sVp2pWJ6rX6SyXKGvU5egjLzFnsjSoMrTirjBZ6WyV5ijRIGOV6GsX6WyVJupUJalUpmmUZejU5qnUpupTpelTpelSpOgRI2aP4OPRYOQM3J/M3uIMHmHOoKRRYuaU5enZam3V5qlWpqkYqKscq+6erW9b6avgLW+l8fRequzhL3Ea6ivdK62j7e6ttTRudTSwdvZxd3bxd3cvdnWoMO+lb24nsC80eno1erpt9rZeK2xZqewcqyzoMbJpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpMnMpcrNp8vOrc7QuNXYxN3gy+LlzuPnz+To0eXp1ujs3evw4+3x5uzv5uvu5uvu5uvu5+vu5+vu5+vubIyFc4VyeHRQeG9DeG5C9Oyz6+Gbyrxm4tKGvdPDlsXJqNXYqM7ZoMjWfLK+YKOtWqCrWZ+sUpmmVJ6oS5SfQ4uVRYyWSo+aTIuXTY2WS4OLWYKLapObZ5WbcaCmf62zg6+1i7e8kLzAnMjLl8PHi7a7hbC2fqmvdJqhdJ+mWYmSR4GNPHeELWx4JGp0KWJwKl1qKllmK1xpJ2ZyIWh0N3+MSZCfM3mIMnaFKXB9P4WSVp2qXKKuTpSgSpCaV5yoVpqnbKy0daWsh7G5hq+4gK20bau3WZqjSoSQQ42YXaOwY6q3XaSxXKOwWqGsW6KvWqOvVp+sVJ2qTpekTZakPYCLQnqCPXiBM3qHKnOBQoqZO4GQVpupWJ2rUpeicbS+V5ulVpeib6+3VpWdYaCncaexfrW+bKuxYqGrZ6Kui7e8ttTQuNXSwd3aw97cxN7cudXSrM3JnMC7tNPP0urpxuDgjr2/WZeeVpukZaSrlcPGoMvNo87PpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/QpM/Qpc/QptDRq9TVsdfZutvdwt7hyeHkzeLm0OTo1ujs3evw4+3x5uzv5uvu5uvu5uvu5uvuWoqMXImJdYx3npZjmolP2MVx6t53oaFcucq1qMbMqdDUlcHGksbPb7G4WaGoVp6mWKCqXKKuVpmmVJegU5WcZZ2ld6qyhre/jLO9lLrDn8TKo8jJqs/On8TEoMXGpsrKpcrIpMjIpMjKpszMosfKnMHGlLm+kre8l73AocfJlr2/lr7Ak7m+ZZGYTYKLO295MV9pM1xoM15qLGhzImlzKnN+RYybP4WSN3iGJmx4QomVWJ+rSo+bTJCbVZqjT5SeVJejZJ2mjr7DnsnRpM7Wl8TJcKy3XZyjSISOP4aQSI+cSY+bU5qmUJejVJunWqGuWaKsXaaxYqy3UZumOYKQLnJ9PHR9QHqEOH2LMXuIKXF/NnyLOYCORoyZSpGbRo2XX6WvTpOcR4yVUJadd7rBg7zGebS9ZaiuXJ2tXJqpeqittdPQu9nWwd/cw+Ddw+DdvdvYsc3KtdHPzOjlyuPiss/UUIiTUpWkWp+pcqq0grG4ire9k7/EmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdPVqdTVqdTVq9TWrtbXtNjavdzfxN/izOLm1Ofr3evv4+3x5uzv5uvu5uvuSXh/VYSIX4yMlKeKzsJ/s6NL7+CBp7eVncHJps3Qrdbchbq+ZaSrYaetXqWrVp+jVJ6iV5CZVoSObp6jkcHFncfKlby/lLq7l7y8mL28pMjHp8nIqszIp8rHqs7NpsvLmL2+iK+ye6SpdJ6ka5WcaZOYa5aacZygb5mfb5qfbpidc5yie6SnWYKGZ5GWX4qQWoKKVXmDUXiCPXB5KWhyJm16TJKhRIqXR4iWL3WAPISPTpWhUJWhYKSvZqqzVJiiZqayf7jAmsrPos7VoszVmMPIerS/W5mgQoOLNXyHL3WFPIONQYeUQIeUP4aSQYiUQYqWUpunR5CcM3yILXaELHR+Lmt3O3aEO36NNX+NNX2LLnWCPoSRO4GNSJCaPoWPSZGbW6CrY6izR4yWXaGqXZ6oZKewVZ2lWZuqXJupapOXudXSwdzawt7bw9/cxODdxePgsc7Lwt7bzunmwtzbkrm8R4qSOISRVaKqXpila5ymd6Wufqqzga21hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqtTVrNXWr9bYttnbv93gzeTn2eru4uzw5ezvMF9tOWh0SHh/Y5CLq7WHvLFl2dyiqsbBqM7TrtbZnc3UeLO6c7S+TpGfWZ2oYqKnVYSFd52gocPHnMHEn8PFoMXFnMG/nsK+osG9mLOvob25rcvItdTQuNbTstLQiKqqb5GTb5GWb5aaa5CUc5mcdZ6gdJuedp2hbZadbJada5ScZpCXbZadU3mAZIyRYY6SZ42UXHuFZ4yUV4GJLWVvIGVzRoybRYuZSouZM3eDQIeSZKm1UZahUpeiUZWfUZagUJGcd6+2m8vOptDXo8vTmsTKfbTAZ5+oPHeAKml2JGh5OX6NN3yNQomWSJCcSpGeQImXNH2KKnOALHWCLXaDJXR9JGVyMm98O3+NMoCLLnmELnB+OnuIK3F8SI+bQIiTRIuXTZSgSI+ZWqGrVJmjXaGqVZyjU5uiTZWgTpSce6Kkv9vYwd3awt7bw9/cxODdrszIrszIxePeyuLgl7y9R4eOMn2HMH+KPYqXRYaRUYqVWI6ZYZSfbJ2md6WtfaqygKy0ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqtTVrdXXs9jav97gzOTnKVxrK1xrLl9uRX6NbpSQi6CHnsC6tdTarM3Vo87XgbfAaKWvaKi1X6SxW5ijbZqfnsPBo8jGoMTCmby5nsK/rMjHssrLrMrHo767cYWBcISAoLu4tdPQuNfUsdHPiKqqb5CTb5GVaoyPV3NzYoCBfaGigqOmfZ6jdJmccZaZcpaZbJOUa5GUaY6VXYWMZpOYao6VXX6GZ4mRbI+UO3J7JWt6QYaWTZKgSomXMXJ/NXuFYKWwWZ2oW6CrTpOeVZqlX6Crhr3EmcfKqNHXocnQm8bMf7XCaZ6pNWt1LGx3JWl5Q4WWQIGSOX+KLnqBHW10JG96JG16H2h2I2x6K3SCLXmFIGVzNHF7P4KRKnmDM3+INnWCQnyKKWx3Imh1RYyZP4aSTJOfWJ+qYKeyZ624YKWvVJmjSpCZR4+ZU42Xi7G0wdzawdzaw97cxN/dxODehqShu9nWxuDeosDCU4yRKnZ/JnR/KXaCOX2LQoKNR4aQSoiSTomUUouWWI6ZYZSfbJ2md6WtfaqygKy0gKy0ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqtTWKWRwJl9tImFuQ4WLgKWftce5mbzEtdXcsMzViba+cK22cbC/aaWyYZukf7G1ncfFosfDo8bCqsjFrMfFpcPBq8jHtcvMsMvJory6Z3p2XW9riaGdtNHOuNfUsdHPiKqqb5CTbI6RWHR2TGVlVXBwfJ2ehKSnfZ6ic5iadpibd5iaeJmad5WYd5acbJKZY42TWX2CXXyCY4OJaYyPRHyBJGt3LnKCPoKQOXaGLGx5Km96U5ijY6izX6SvWJ2oT5OfbKu3d620nMrNqNHXpc3UmcTLd624Y5KcSm95SniHSnuJbJaZd6GkcJuhWI+VTJGUJm15IWl2LnaDJ299KXF/TpOgJGV2LGt2O36LK3uFLnyENXyFRHmJO3qHKW56JW56OICMRIuXQYmWT5ijUZqmQomUP4WQQYSQPH6IYY6ZjK+yuNHQwNjZw93dwdzclLCvlLOwrMvGnLq5THmCLneAKXeDKHWBLnuHMHR9OXiBPnuFQn+JRYONR4aQSoiSTomUUouWWI6ZYZSfbJ2md6WtfaqygKy0gKy0ga21ga21ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVLmt2LWt2L3KBQHyEnquSsK2Ms9DMr9LWrtTZibrDY6OwZqm4aaGsi7u8osnHrMvKt8nLrcjGrc3Js8zKp8PBqMfFtMvMssvKory6Z3p2W2xocISArMnGuNfUsdHPiKqqb5CTZ4eKUGpqTGVlUGpqdpSWhKSnepyfc5iZeJibepmcfJuce5ecfp6leJiedY6TcY6QXXZ6aouOY42OSXyBKWt2JGh3R4uaP4CPNHOBM3SAU5ijVJmjU5ijWZ6pVpqlea++lsLNp87UqNHXps/WlMHJaamqa5icdJWcgaeuh6yzl7zBpMbLo8XJi66xcZaZXpCZY5agXJKbaKKqerS8b661R36JTHmEQ4KJJnWALHmCLXeBP3eGO3iHLHJ/JnJ9MnyHQImVN4ONMoCKMoGLOIKMN32HQ4WPS4aGeZqhg6mrob/AqcbFq8nIo8HAeJeXl7W1mLazapGWK2FyGl1tLnqIKXaDKXeEN3uGP36IQX+JRIGMRYKNRoONRoSORoWPSYeSS4mTToqUUouWWI6ZYZSfbJ2md6WtfaqygKy0gKy0gKy0ga21ga21ga21ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVqdTVLmVyLGh2JWd4XoyQsrB7ral90eDUtNXSk8TFaKOrcLC+Yp6ohra6ps3Hs9HKutPRvNDRtsrKq8vHs87MqsXDpsXDscrLtMvMory6Z3p2W2xoZXdzor25uNfTsdHPiKqqbpCSXnx/TWZmTGVlTmdncpCRg6Snd5qddJiaeZmbfJucfZqdfpyif5+lepabepGVepGTcoeLYnx+cZKWW4SLNHF8H2FwQ4WWSIiVOneENHeBSI2YYqeyWp6qUpajVJekbKOyiLW/p87UqNLXoszTk8XMaqSlb5aZWH6Bi7K3f6mtgq2xgKuugauujre4mcDAmsLDjra1e6Khe56ebJGQhK6vdZ2eb46RUYaOMHmILnaBL3qFM3iENHWENXuILXmGK3aBJm97KnN9NH2HO4OON3yHNnqGOYGKX5SYgaapg66uncLDmb28k7a0bY6NlbW1or/Bc5KcL11vG1NnI2Z2L3uIL3uINYGOQoWRS4mUS4mUS4mUS4mUS4mUS4mUSoiTSoiTSoiTS4mUS4qUTIqUToqVUouWWI6ZYZSfbJ2md6WtfaqygKy0gKy0gKy0gKy0ga21ga21ga21ga21ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVqdTVqdTVqdTVqdTVqdTVMWZ0LWd1MHSFY5GRwLZvqaFq7PLdtNbOg7e6eLbAZ6axYJOVqs/LtdTNuNbNu9bQu9LSvM3PrsnHsc3Lr8nHpsTBrsnJtcvMo7y7Z3p2W2xoXW9rjaWht9XSsdHPiKqqbY6RV3N1TGVlTGVlTmdncpCRgqOmdZmbdpiaepmcfJudfZyfgKCnfZ2jepSZfJOWfZKVfJGUZn6CdpOZYYiRMm14I2NyQICSSoyYMWx4L296PoOOW5+rWp6rQ4eVSo2bdKy5nszVqdLXqdPZm8jOg7jBaZ2gd52fbpaafaaqeKOnc6Sme6qsfKutf6yth7K1lb7Bl77CmL3Bmr7BnsHFosTIgaSpY4mOQ3yFI2d3NHiDPIiSMX6JNnyJMnmGLHeEK3WBLXN/Lm97LW15I2VwLXiBPoOSUoqWdJqgeqWoequriLK0gqepfJqclKytnrq7haeuOGB2JFFpHVdqKGx8JXB9LnqHN4KQRIeTTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTYuWTouWUYuXVIyYWI+aYZWfbJ2ndqWufaqygKy0gKy0gKy0gKy0gKy0gKy0ga21ga21ga21ga21ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqNPUqNPUqNPUqNPUqNPUqdTVQnOAM29+J3CATIqRq65+vaRe6u7Tr9TQh7q7b6u0cq23eqKgtdPQt9XQt9bOutfOvNXSvNDRtsrKrsvIs8zKp8PBq8jGtcvMpL27Z3p2W2xoW2xofZKPtdLPsdHPiKqqaoqMUWxsTGVlTGVlTmdncpCRgaKldJmad5ibepmcfZydf5+jgKGoe5qfe5SYfpWXhZmccoiLaoWKdZWbT32HMWx3JmV0QICUTZCaPXqGOHWBMXSAP4SRTJCeWp6sVZemeLK+iLi/nsfMq9PbmsnQgLS+cJyicZeabJeaa5ibdaKlfKmsfKmtfaqtf6uwgauyj7m/kLm+kbq8mMHDmsHFmb7EeqGoX4mROXaBJmx7RImTTpmiTZaiSJCeO4KQNH+KNX+KLW98QnuKQXqHSYuUPIONSYmXaZSecpWbcZ2ffamrgKWpj6+0oLe6o7i7k66ySHKDIFJqHVZtKGV4L3WEJXB9KnWDNoGPS46aVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVZOeVpOeWJSeXJagZJymbqOsc6aveamxfKuzfqy0f6y0gKy0gKy0gKy0gKy0gKy0gKy0ga21ga21ga21ga21ga21gq62hbG4iLS6jrq/k7/DmsXJn8vNo87QptHTp9LUqNPUqNPUqdTVSniHMm19IW57N4CHapaNvcOTq7ulsNLZl8G9e6uva5yheZicrcrKt9TRuNbQudfPu9fPu9PSvM3PsMnHtM3Lq8bDqMbEtMvMpb28Z3p2W2xoW2xocISArsvIsdHPiKmpZYSGTmhoTGVlTGVlTmdnco+RgKKkdJiaeJibepmcfp2fgaGnf5+mepidfJWYg5ibgZaZZ36CcZCVXoeOPXN8O3R9L3R+NHqMSI2WQoCLNHF9PYGMUpekVZqoU5ioRoiYX5umlsnQnsjOm8bQjb/Hea65cJqhbI+TapSYYo2RbZicbJmcb5yhcJ2icJuhbpiebpiedJ2ihq+xj7i6lbzBgqivbZKbXIOMO3eCKW9+TZCbRYyWT5aiRIuYSI+dQYqXPoWRRoWSXZOggLbCdbS9Uo+ZXZCXb5WYZ5eXcZuae56fgqSmjq6xoLe6lq2yVniHJlFpH1BoJV51N3WIMXmIJG98IWp4SJGfWJunW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkW5mkXJqkXZqlYJymYZ2nZp6oaKCpbKGqb6GqcqOsd6aueaevfquzgKy0gKy0gKy0gK21ga21ga21ga21ga21ga21gq61hLC3h7K5irW8k73CnMXJo8vOqdHTrdTWNm15K2l2JG16JmlwQoOOWZCRdqiottXP0d6+psW5c5+iaoeOfpedmbKzvtXO0OLU0+XTzd/SydbJztfCzdnCyte/xdS9wtLFscO5e4p9cH5xanlua3x2psG8sdHOiKmpYX+BTWZmTGVlTGVlTmdnco+RgKKkdZiaeZibe5qcf56hgaKofZ2je5ibgJeah5uec4iLaISJYouQRnyCQHqAQHuBM3h/LnODRYqUQoOON3iDPICLR4yXWJ+rQYmVSpKdcbG6eK22jrvEj77JhL/FZKOmaJGTaYqNZ5CVY46SZ5KXZI+VaJSbb5uhcJyha5acZ5SXa5aaaZSXapSWb5eab5ebdp2iX4SLRHuFK3B/TJigZaq1SpCbN32JVJqlXqOuVZulZKKthbnEjr/IgLy/ZJqgcJ6gZ5CNc5iUeZ2ZgaOihKSmgqKleJKZUXJ+KFNoI01kJFRqKmV6OHyMNX2LIGl3NX6MUpupVZiiXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXZukXpukX5ylYp6mZaCocKiwc6qyeKuzfK20ga61h7C3jLS7lbvBl7zCl7zCmr7EpcXLqMfNqMfNrcvQtdHVt9LWutTYvNbaO3R9NXJ8HmRyMXOAPX+LSIqQV4uUq72W4th90d6ziLKvgaSnmq+uy9DB7u7V+/nb+/zc7urE6+Kt+O+1+e+1+e+1+O617eiw4+Gq2def1tWdy8uYur2Sw9Cysc/MjK6uZYOEUWpqTWZmTGVlTmdnco+RfJ+hdpiaeZmcfJudgKCkgKGofJugfpibhpuegpaZZH2BXYaLR36EQHuBP3qBPnmBPXeDKmp5RoqWPYCNOn+LN3uGOoCKUJmiTZmhO4WNSo6YebG8jLzIhrjDdrS7V5GVZ4mJZoSIZYyRY4ySaZKZbJacZ5OaZJGWb5yfbZqdZ5SXaZWZbJebbZibdp+idJ+gdp6hZoqOR3uDM3SEXaavVpymP4KOPoKOVZmkVJmiX6Ora6evkcHKnMrRicLCe6ysfaKjeJmZepiWgJ+bgaOge5ydVnV9OlpmLlRjJFVqJlZsKF5yL25/N32MLXSDLHSDQ4yaVZ6sYKKrZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6atZ6ataKataKataKataaataaata6eubaeubqiudKmvd6qvga6yiLK2kbe6osLFr8vPttHVu9TYvNXZvNXZvNXZvtbavtbavtbavtbavtbavtbavNXZuNLVRHyFPHiCH2VzNHaELnB+SYqVQXqEfJqC0r5p49eco76+psPH3+XT/Pfa/vrb+/rZ7uzK4tSl7uCk+/C0+/C1+/G1+e+z7uen7Oem7Oem7Oem7Oem6uanz9q4rcvMn8LFmLq7i6ipdpCRY31+W3R1dZOVe56gd5ibepmcfZyegaGnf6CmfJmdg5udiJyfb4iMUnqARHyDP3mBP3eBP3WCQHOCPnCBK2d2QoaTPYGPPoOQP4SPOYCKT5ihR5ScSpWeXqOuZ6Ctd6m3e7C8U5OcXY+WYn5/X3+DW4KHZY2TX4iPcJmhbZigZpOYZZKVapmbZpOWapaZapWZb5qecpqfcZyecJmbY4iNO3R9MnKDUJKfVJmkQICMUZKeV5mkZKixaqq0da62mMbNo87Wib3AfrCxgKWmfpydeZiXfpyZfp6bWXp/OFhkNFVhLVJgI1ZsIlluI2ByNHiINnyLImh3KnKBRIybT5imY6OtaKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraKSraaSraqWsaqWsbamvb6qwcKuwda6yd62yeKyxf66ygq6yh7Czi7GzjrKzkrS1l7i4ob/BrsrMt9HUvdXZvtbavtbavtbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/QXuEPHiAJ213L25/JWV0QICPP3+LQHuCiKCD1tqnqsnCt9HF8/LS+/fX6+nJzcqsw7mV18SQ7d+j+/C0/PG1/PK39e626+Wl7Oem7Oem7Oen7Oen4OKvuNDHqcnNosfJqszMstDSsc3QpL/Enbe8mra7jrC0gqOlfJuefp6hgaKofZ2jf5qdh5yff5ebUn2EQHeBQHWBQXKBQnB/Q259Q217Qm57Nm16QYWTQIaTQIeUQIeUN3+LRo+bTJahSZOcT5WgUZiiXqSrUpyjTZeeW4mNWG9uYoSDYYaHZ4uQeJujZouSZIuSbZedbpqgaZWbapaaapOYb5ebcZqee6KldKChbpWXao6TQHiGRIqZVpmlQIWQO3uIW5qnSIqWVJaia6m0fbS8pNPWpczTgq21hLG3hK2xgKCie5maepmWcY+PQGBrNVZkNVhnMlptKF50H1tuIF5wPX6ONHqJKG59P4eWQYmYYqu5W5ijX5efYZegYZegYZegYZegYZegYZegYZegYZigYZigYZigYpmhY5mhZJuiZ52kaZ+mb6WqcKerdauue7GzfLGzg7W2h7a3ibS2jLS1jbO0j7K0kbO0k7S0lLW1l7e3nr29qcXHtc/Su9TYvtbavtbavtbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6R4CFSYGFSYOLL26ALm5+Lm59SYmXOnqHRIWIfqehqci+0c+W7NeS2dOtvbibu7ieyb2W2cWP7d+j+/C0/PK3/PfB7uqz6eOj7Oem7Oem7Oen6eapyNe9rcvOpsjLo8jKrc7PtdLUs8/TrsjPrcfOq8jPpcfMnsHDlba5jKywhKSrfZugg5uefJWbXYONRXSBQ3B+RG58RG16RG56RG98RHJ/RnmGRH+MO3+NPYOQP4aTQIaTOYKOQYqWSpOfVp+rTJWfS5SeUpumTpalUpWeWouQXnl3co+Ng52ddY6QdI6PeJuafaKib5OYbJGYb5WdbZWab5iceKGldp6ifqSnf6Wpd5aabYyTRXuLR4+cVp2oQYiSP32KV5ejZKayZqi0aqazh7zGqdfdi8DHfayzha+2hq+1hKitfp6fd5aWXYCIPmR2PGN4O2R6OWR6LmR7IV1wJGFzPHyNM3mIMHeGPoWUP4iWP4eWR4qXUY+bWJKdXJKcXJKcXpSdZJihZpukaZ2mbqKpcKSqcqeseq+yfLGzf7S2hbq5hrq6ib28iru7i7m5jLe4jbW2jrO1j7O0kbO0krS0lLS0lbW1l7e3nLu7pMLDsMzNudLWvdbZvtbavtbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6l7y7nb++UIWJUYWKTYKKMG99M3OEImJyJ2d2S4uZUZOdRn6HdJyZxbdn3b9Vs6h24d2+z9zNycqs2cWQ7d+k/PK3/fnD+PjH6OOs6eOj7Oem7ein7eio2+C4s83Lq8rOo8fKpsrLsNDRtdLUsMzRrsjPrcjPqcnPpMjLpMfKpsfKpcTImbq+gaKnb5GXXYiSU4SOU4WOUoSNT3+KTHyISHuHRXuIRHuIQ3yJP3uIMneCQYiRQIeSP4eSP4uVPoiTQYiSVpukcbS9VJulSpSgTJCjVZOhWJKcXoSGhKCejKWlbYGCdY2MiKiliKipgKClepigeJegbpecdp+kdJyjcpqieZ+meZyjc5GWV3+INHKBSZSfV6CrOYGLQoSQRoeTWJqlZKSwa6ayj8XOlMrPcaqwfKuygq62g6+2ha61g6esb5GXSG+CPmh9PGd8OWV5M2J2LWJ3I19yKmd5O3qLOoCNN4GMS5mjSZagSpWgTJCdSIiVRoOPS4OPV42YaZ2meauygLK3g7a5h7u8ib69ir+9i7++i7+9jL28jLu6jbe4jbW2jrO1j7O0kLO0krO0k7S0lLS1lbW1l7e3mrq6ocHAqsjJtdDSu9TYvtbavtbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6mr28psXEwdbT3OfkUISKUYSJUIKFP3V5MnuCMHaENHiHLXKAQoaVTZGgTIeSiqCDzsN2vrdv2t+8utTQvsuw1sSI7eCj/PjD9vnO3ObK4d6r6eOj7Oem7eio7ey5xtjNrcvPqcnNosfJqszNs9HTss/SrsjPrcjPq8jPpsnNpMjKpcjKqMfKp8fKoMPHhq+yVIWKToCHUoSNVoiTWI2WWY+XWI+XVYyVUYeRTYOPSoKOR4OQPYKKPYOLPYSMPISMP4aQUJagWJihhr7FjcTJVpOeQoeVT46bWZKfWZKgX4+YjqqqjaWka31+do6Niqqnh6eoeZigcI6aX4GPR3GBQWx+OGB1M1t0L1dxOl5yRm15O3R8MnqEOIaQQIqVRIyWQYaRX6Ouaq24Z6awbqmzhb7GfLe6caine66vf66ygK20ga21gayzYYqVO2Z4N2R0NmNzNWNyNWNyMGR1JmNzNnOEPn2MNXmFM32GTZuiQpCWOoiPSoqWU4uWY5iidKeuf7K3hbi7iby9ir++i8C+jL+9jL28jLu6jbi4jbW2jrS1j7O1kLO1kbO0krS0lLS0lLS1lbW1l7e2mrq6n7+/psbFsM3NudPVvdXZvtbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6l7u6nb++rcrIzd7b6fDr9fjz+fr1U4aJVIaHU4OGY5OXUYyPI211LHKAJ218MXmHNH2KUpijVZGTbZmPdpeCosW5qMzOus2118Nu5NuK9vrL2ejQwtbO3duu6eOj7eio8u+53ebOs83QrMrPpsjLo8jKrc7Ps9HTrMjMrcfOrcjPqcnPpMjLpMfJp8fKqMfKo8XIncPGk7m9YpCXUIKHS36CS36DToCIUoSOVoiTWI2WWY+XWI+XU4uURoaRQIePO4CKP4KNLW94OnqGaKazcKe0lsTQnMrRXpKeVpKiXpWgYZiiXpWhYZWhi62xjKKjZ3l8cIqMdJaYWn6KPF92MlZvKFBoIk1lI1BpIk1mH0hmIUppLlNoN2NvPHd8Mn2HRI+aS5ahVJymTpOeRouWXqOtV5ylaaq0cbK6a6esb6OkdaeneKyrfK6vf62yfaqxUn+LNmNyNmNyN2RzOGZ1OGl5NGt8MWx6T4uaPH2JNneDMnJ/N3iEMHWAT5WeZKGse7C1hbi7iby9i76+i769jL28jLu6jbi4jbW2jrS1j7S1kLW2kbW2k7W2lLW2lLW1lLW1lbW1l7e2mrq6nr++pMTDq8rJtNDRutTXvdbavtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6mby7pMTCu9LQ2ebi7vPv9/n0+fr1+vv2+/z3WYqMYpCTcZ2geqWpfKiqXI+UMG16MnqIK3uFKHJ9NXeGPICMVZijSImRXpqecaeumL69wMmd0tic0ebHvdbOt8/U1Ni36eOj8u+47O/QwNTSrcrQq8rOo8fKpsrLsNDRr8zOqMPJrcfOq8jPpsnNo8jKpMfJqMfKpcbJnsPGncHFmrrCdJukXYmRV4aNUIGHSX2AR3t+SnyCToCJUoSPVomTVIyWQ4qSP4aPN3uGOn2JO3yHP36LaKSybqe0grrDhLm9VYaOZJieapafaJmjZJqjYpmibZqjZoOMQl5tPFxtN1ptKFFpJUxnJUpnI0plIEtkIE1lH0pkHkhjIktmK09mMF9tLnJ1NnuHSI2aWp6rVJmkWJynUZahRoyXTpSeYamxZaqyXZmhYJCUY4uOZo6QaJGSbpmadKKkV4WORHN+SHaBSnqFTH2HTH6JSn2ITYiTWJSgQ4KOMHJ9P36MOnqHTo+bXaCrb7C3isC/jb++jLu7jbi4jbW2jrS1j7S1kLW3kre4k7i4lLi4lba3lbW1lbW1lbW1l7e2mrq6nr++o8TCqMjHrszMt9LUvNXYvtbavtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6l7u6nb++rcrIy93a5O3p9Pfy+fr1+fv2+vv2+/z3/f35/v76cJ2gd6One6apgKmrgaSnfKOrZJCbPXyFKnN+LXSANnyJLHF+K257Pn+KVJScVpaeT4yVeKuxibW3fq6yi7q/n8fQtsy72Nim4+rMyNjUsMvSq8rOqMnNosfJqszNsdDRpsPGqsTLrcjPqcnPpMjLosfJpcfJp8fKoMTHncLGnr7FnbnEgKStX4uUXoqSXImRV4aNT4GHSXx/RXl7Rnl+SXyESYONS5WdPYaQO4KNOX2JNXWBOHaDQX+MY6Cta6eybaavbZyhbpydb5ibcZWdbZagZ5iiUoCNNVhrMFFmMFFmL1FmKVJpJE9oI01nIk1oIE1nH0xlHkljH0hjI0tmK1FoN2x2NXl9O4CMToycW56rW52pbbC7W5+qRYuWUZehSpObUJOdS3uGT2txTWVqTWRqTmVqT2htVHF2XouQYZSaYpWaYpWaYpWaYpWaXpSZYJujWZWeQoGMMnSAPYCOT5SgV5ynXKCrjcbPjLq6j7e4j7W2kLW3kre4lLm6lbq6lbm5lbe3lba2lbW1lra2l7e3mrq6nr++o8PCpsfFqsrJsc7PudPWvdXZvtbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6mby7pMTCu9LQ2ebi7vPv9/n0+fr1+vv2+vv2+/z3/f35/v76/v76/v76eaSoe6aqgKmrg6SlhKWqg6myfaiwfKuzZJmpQ3+NLHN9KG96JWp3LnJ9L3J6S42XT5CfVZemU5KjWpelVJOZZaiqaaWmmsrBrM/Jp8fTpMbNpsjLosbKosfJrc7OrcrNor3CrMbNq8jPpsnNo8fJosfIp8fKo8XIncPGnb/FnrrFnrnEiKu0WouUV4iRW4mSXYqSXImRV4aNT4GHSXx/RXl7TIySR5CYP4eSN32KL3F/L3F9LW56LWp4LGd1OHGARXiJW4eOa5SXcJuccpqddJacbpCZR259NVprM1ZpMVRoMFJnK1RrJFFqIVBnIU9oIE5nIE1oIUxpH05oI1FqK1ZuOnF8PIGFOYWNVJWhWqOtYaOva625cLS/SI2YQIeRRpCZSI2YXIyXU3F5SWFoRlxiRVthRVthRl5kXIWLaZyiaZ2iap2iapyhaZufZJWZbKarWZWbQYCKM3SAQYORV5upUJSiaKu3m8nVlL7AlLy8lry8lru7lrq6lbe3lba2lra2mLi4m7u6nr6+ocHAo8TDpcbEp8fGq8rKtNDRutTXvdbavtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6lru6m769rMnHy93a5O3p9Pfy+fr1+fr1+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76e6aqgKmrg6SlhKOmh6qzha61g7C3hLO/gbLBaZmjRnqAP3eALmp7Kmp9LHOCK3iEMHaEQoWTP4KOVZejSo6YYqWtUJKbaKawcKq0bKKug7fBlcjPksLGncXGrc7PpMHFpcHHrcjOqcnPpMjLocfIpMfJpcbJnsPGncDFnrvFnrnEnLnDkbK8YZKbUoeQU4eQVIeQV4iRWomRW4mRVoaNT4WMX5ymUIuXPHKCMXKAMHaCK296LG56JmRxLGd2M2t2N2duQG50UX2CZ5KUcJyccpydZouSPmNzNlxtNlxtNlttNFpsKVduIU9nH09mIU5nIU1lIk5oI09tIlJuLmJ0Pm9+Qn6FQ4eIOISHUZSdVJ6lW6GrWZ2pd7rGWJynUpiiTpujS5Odb6izb6GqYo6WT3J4QV1iP1pfQF1hWYWJap2ha5yga5mbbJaWbZWScZqUbqqhXpucRoKNPXyKTI2bV5uoT5Shaq25mMbSnsrLlru7lri4lre3mLi4m7u7n7+/osPCpcXFpsfFpsfFpsfFp8fGqsjJs87Qu9TXvtbavtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6lru6mLy7ocLAts/N1OPf6/Lt9/n0+fr1+fr1+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7gKqrg6Slg6Gjhqivhq22hLC2hLK6hLTEfq26ZJKYVIKHTX6GQnmGRoKRRYOSMXeDN3qFKWx3I2hzLXJ/M3qEOX2INHaBSYuVRYeRRIiQQIOMVZihaKyxg73CmcfLm8DFqMbNqsjPpsnNosfJoMbHpsfJoMTHncLFnrzFnrrEnLnDmbjCkra/bp2lU4iRUoeQUoeQUoeQU4eQVYiRVYeQWZGaZqKsV5CdOm+AIV9tI2d0JGl1ImVzIGFtHl5sMXB3PXF2Pm5yP25zSnd8Yo2QbpqaWYKKPGJzO2FyO2FyO2FyOmByJlNrIU5mIVBnIU9oIU5nJVNrJlduLWJ3SH2LTYCMTIaLSIaIO36BQIKMPIOLWaCoY6izYKOvY6WxWp2oV5yoaKi1dam0dKOsVYCFQGZpOV1fOFteOV1fU31/a5WVbJOQbpOOcpqTe6aehbGpgrCqbaKkU5CZP3uKSYmWVZqnVJqnVJmlgbO+r9TZnL6+nr+/o8PDp8fHqcrJqcrJp8jHp8fGpsfFpsXFqcfIss3PutPXvtbavtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6lru6lru6m769q8jGxNjV4uvn8vbx+Pr1+fr1+fr2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7g6Okg6CihaWrh6y1hbC2hLG3hLPAhLTDcqCqWoeMVoSJUYGKSH6LUYmXTIaUPnyFO3qALW91MG96NnCBOHWDOHaDQXyHOHd/OXuCO4OINH+FNYCLMn+JO4GLWJWfcaiyjb7HmcXLoMbJn8fHpMfIo8XIncLGnb7FnrrEnLnDmbjClLfAjre+famwWYyXVImUVImUVImUVImUVImUVImUW5ehYp6oToeTMWd3IF5tIWRyHWFuHmJwHWFuImp3OHuAQXl9RHh9Q3Z7QnR4R3Z7WYWJTHF+PmFzPmFzPmFzPmBzPWByJFBnJFFoIU9nIE5oIlBoKllwLWBzRX2JZJifY5eeUYqPQ3+DO3l/Kmp3P4SNTJOcXqOuXqKtZqi0XZ6qaam1i8DLfay2WH+DO2BiOFxeOFxeOFxeOFxeSm5ua4+LcpmTe6aehbGpjLewjrWxirCveKiqYJqjP3mHP36LWqGtUJmkRo6ZjMHLstfdrNDQrM3Mrc7Nq83LqcrIp8jGpsbFpMTEqMXHsczPutPXvtbavtbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6lru6lru6mLy7ocLAts/N1OPf6/Ht9vn0+fr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7g6ChhKOmh6qzha+2hLC2hLK6hLTEfq26ZJKZVoOHV4SLUIGLSoCOVYyZTYeUQ3+GPHuALm92NHB+NnCBOHSDPHeDQ3qEOnZ9PX2DQoWHPoSIQYGNR3+NPnaFOXKBOneDQoWPYZ6ngLe9lsXIocTInsLGnb/GnrrFnLnDmbjClLfAj7e+jrW7hamvV4WRQnaEQXWEQXWEQXWEQXWEQXaEVpKeYZynP3iFLWV0IV5uI2Z0HmJwGV1rH2JwLXmGPXuEQniAQ3h/RHl/RXl+RXl+RnZ9QmR1QF9yQF9yP19yPl5yOVxxKlRrJlJqH01lG0liIlBnM2F4QHKFWZGZa5yja5yiT4OKP3N8PG98Mm9/PH+KP4aQUZahb7K+Zqi0Y6Owc7G8oM7SgbO5aJWYTnZ4P2RmOl1fO11fO11fRWlpc5yWhbGpjLewjrWxjLGwiq+wiq+xg6yvaZylRHuINnOBWKGrUJulUZqkcqmzhbS3stjYrM7NqsvJqcrJqcnJqMbHqMXHscvPutPXvdbavNXZuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lru6lru6lru6lru6lru6mr28q8jGxNjV4uvn8vbx+Pr1+fr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7g6Gjhqivhq22hLC2hLG3hLPAhLTDcqCqWoeMVYOHVoWMTICLTYORV46bToiTRICFPHuAMXB4N3GBNnCBOHWDQHiFQ3qFOnZ9Pn2CQ4aGQIWJSISQSH+NPnWDOnF9QHmBSYOJVomRVIiVZJ2qe7O3krrBm7rEnLnDmbjClLfAj7e+jrW7iqyxhKSpXoaQMWRyLmJxLmJxLmJxLmJxLmNxT4uYUo6aMWt6LmR2I2FyHmJyIGRzHWFwK3B+LnGDPXqHQnqGQ3iDQ3eBQ3eARHh/Q3F7PmBzPF5yOlxxOFxxN1twNFpvLVZsJ1RrJVNrLFt0M2N6MWF3PXGDVY6WbZ+lbZ6kT32HPGl0OWl1OHWGNHeEMXiDVpumaKu2VpikY6SwdLK+rNjcibvAhbW5dqGlVnZ7SGJnSmJoSmJoT2lteZ6bjrWxjbKxjLCxjLCzjrC0j6+1i6uxcqKqT4WQPXmGV6GqUJymUZymgrjFnMrQoszNnL++rMvMq8nLqsbKsczPutLWvNXYuNLVr8zOpcXGnL+/mLy7lru6lru6lru6lru6lbq5lbq5lbq5lbq5lru6l7y7nsC/s83Lzt/c6/Ht9vn0+fr1+fr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7haWrh6y1hLC2hLG2hLK6hLTEfq26ZJKZVoOGVoSJVYSMSn+LUIeUWI+cToiSRICFPHuAM3F6OHGCNnCBOnWDQ3qGRHqFO3Z9P3+DQ4aGQ4aKTIWRSH+NPXOAPHJ8RX2DVIeNYY2VYo+eYJGhVYyUZZymhrK6mLfBlLfAj7e+jrW7iqyxhqariKercZadNGd0LGBuLGBuLGBuLGBuLWFvRHqKKmVyNG59K2p5JGd2IGV0IGRzIWV1LHJ/MXN7O3aAP3mFQHqGQnmFQ3iCQ3eBP217OFxxN1pwN1pvN1ltN1lsNVhqMFZpLFtxL2B3OGh/MWJ3PG2BPXCCV4+XbJ6kbJ6kUoOLN251MW50LnR8MXyJNn2KWJejWZ2mZai0YaSueLO8sdjdl8DDg6qtXnl+T2VrTWRpTWNpTWNpT2VrbIiLjK6xjrC0j7C1kK+1j660jKyxh6qtdJ+gXJGYR4aSWaGtTZejUpumaqizfLC1qtDVrsnPrMjMscvPuNHVt9HUr8zOpcXGnL+/mLy7lru6lru6lru6lbq5lbq5lbq5lbq5lbq5lLm4lLm4lrq6pcTDwdbT3Ojk8fXw+Pn0+fr1+fr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7iKu1ha+2hLC2hLG3hLPAhLTDcqCqWoeMVYKGV4WLU4OMSX+MU4qXWI+cTIaOQ4CFPXuBNXJ9OHGCNnCBO3aERHqGRHqFO3Z9QIGDRIaGRYaLToWSSH+MPHJ/P3V+SoGHW4uQY46YZZKjZ5KhWIeRW4iWZpShg7C5jba9jrW7iqyyiaisja2wk7O1hqmsPG56LWFwLWFwLWFwLWFwLGFvK2V0JWFuJ2RzHWFvI2l4IWZ2IWV1JGh4J2x3MW90NnB1OHJ3OnR8PXeBP3iEQXiDP2x6OVpsOVlrOllrOlpsO1xtOFxuLlhqLF1yQHOHN2qAP3CEQHGEPHCAWJCXbp+mb6CmWpGWOHh7OHl9OX2DN4ORNXuIUJCbUJWdV5ynVJiie7a9stbcq9DSgaGlXHV7UmluUWdtUWdtUWdtUWdtZoCGjK2ykK+1j660jKyxiKqthKiofKOhbpmaRXuCQ4KPWJ6sUJekUpilY6OufLO5l7/FsM7WttPWrszOpcXGnL+/l7y7lru6lbq5lbq5lbq5lLm4k7i4kLW2jbO0ibCxgqqtgKirfKSolbW4wtTT5+7q9fjz+fr1+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7hq62hLC2hLG2hLK6hLTEfq26ZJKZVoOGVYOHV4WMUIGMSoCOVo2aV46bSoSLQ3+FPXuBN3J/OHGCN3CBPHaERXqGRHqFPHd+QoOERIaGSIaMToWSSH+MPXJ+QnmBUoaLX4ySY5CdZ5SlZZCeW4eTY4qYbJOdcaGmgqyyiqyxjq6xk7O1l7e4l7e4iKuuP3N+MWl1NGx4NW16NW57Nm98LXF9Jmd1KGx6IWh3I2l5IGZ3H2NyJmp6LHJ8O3V8PnV9PXR6OnJ4OHF3OXJ4O3R8P297RGd2SWx7THGAUHeHUXuLUHyMT3yNSXuOPnKFN2p/QXGGQnKFQnSDUYeOb56leaSsbpujSYCHRH2EP32FNH6MNX6KSYiVXqKrVJmkXaGrdK62stTbtdjbm77CkLC0g6CkgJ2hgJ2hgJ2hgJ2hhaKmjq2yjKyxh6msgqaleqGfcZqbapiaZ5ecToSLQX+OU5imT5ajUpilR4eVVoyWe6ivosXNkbm6jLS0irOyirKyirKyirGyh66wgqqtgKerdZ+kc5yibJaeaJObZpGaaZKbhKastsrM5Ovo9vj0+fr1+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLC2hLC2hLG3hLPAhLTDcqCqWoeMVYKFVoSJV4WMTICLTYORWI6cVY2ZR4KIQ3+EPnuCOHOCOHGCN3CBPneERXqGRHqFPXl/Q4SFRIaHSoWOToWSR36LPnR+R36EWoqPYY6WZJKiapSlYY2ZYoqXbJCccZqgeqWohKmtj7Czlra4l7e4l7e4l7e4iKuuPXN7LmhyMGp0Mm14M3F9M3aDJ3J+JGx5Jm99J259IWh5LXOEIWh3JGh4KnV8N3p+PXuAQHqBQXiAQHd/P3V9PnV8UIKHYo6TZZKXZpKXZpOYZpOYZpOYZpSYSn2LOmt+P26BPmx/Qm+BQHB9TYCJeKCrfqOuep+pUYWOQXyGPnuGMX2JMYKLOHiESomWV5qjX6KrdK62rc/Wut3foMbInsHDnb/Bnb3Anry/nbu+nLu+mrq9h6msbY2OYoKBVHJxTW1uTG1vTG5xTG9yUoKHPHuKVJqnTpehUJmkTI2be7O+iLnBbqCkWI2PYpWXZZaZZ5WaZpOaZpKaZJCZYo6XYY2XYI2XYI2XYY6YZpGagKSrtsrL5Ovo9vjz+fr1+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLC2hLG2hLK6hLTEfq26ZJKZVoOGVYKFV4WLVYSMSn+LUIeUWI+cVIyXRoGHQ3+EPnuCOXOCOHGCN3CBQHeERXqGRHqFP3yBRIaGRoaITIaQToWSRn2JQHeAUIOJXoyRYY+bZ5SlapSjYYuYao6bb5WeeKGmgaerja6xlre4l7e4l7e4l7e4l7e4gqepPXN4LmhuLGdtLGdvLmlyL215I2x6Jm98KnOBLneFJ25+MXeIHmV0JGh4MnN/PHuCPX6DPX+CPX6CPn2BP3uBQnuBWIiNZZGVZZGVZZGVZZGVZZGVZZGVZJCTQnSBOm1/QnSGSHqLRXeHPXF/RX2NWoWVcJOffp6nZZKbR4ONQ4KNOYGMM36JM3iEPX+LX6GrZaawda63rM/XvN7iqM3Pn7/Cnby/m7u+mLu9lbq9krq8kLm7cpeYQVtcPFVWOlNUOlNUOlNUOlRWP19iSH2DOHiHU5mmT5mkTpmkS5OgP3+KP3V9QXV8ToWKWomSXoqUX4uVX4uWYI2XYY+ZY5KcZJOdZ5aga5egep+mpr7A3ufk9vjz+fr1+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLG2hLG3hLPAhLTDcqCqWoeMVYKFVYOHV4WMU4OMSX+MU4qXWI+cUYqURICGQ3+EPnqDOXKCOHGCOHGBQXiFRXqGRHqFQH2CRIaGRoaITYaRToWSRn2JRXuCWYiOYI2UY5Gha5WlaJKgZ42abpGddZyjfqarhqqtk7S2l7e4l7e4mLi5l7e4lra3cpygRnqBPnN6N290MWtvLWluK2x1JW58KXKAKnOBLXSDJ299NHyKLXSDLHOCN3SBQ3yIRn+KRX+JQoCHQH+FPn+EQICEWoyUaJKdaJKdaJKdaJKdaJKdaJKdZ5GcQ3SFP3OER3uMS3+PSn6NRnyJS4SUZpKffJ+mjauxiKirWo+VRIKMN3uENHuHL3iEMnmGZKizZKOubaawmcHJs9bap83RmLy/k7q9kLm8j7m7jrm7jrm7jrm7cpeZPlhZOlNUO1VWPFlaPl9hQG1wQ3p/Q4CHOnuKVJuoUJqlTZijRI+bRY2VN3Z9NGx2QHmDVoqWW42YYJGcZJagZ5mjapulbZylcpuieZugk6yuyNTT8PPv+fr1+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLG2hLK6hLTEfq26ZJKZVoOGVYKFVoSJV4WMUIGMSoCOVo2aWI+cT4iRRICFQ3+EPnqDOXKDOHGCOHGCQ3mFRXqGRHuFQoGERIaGR4aKToaSToWSR36JTICHXYuQYI+ZZ5OkbJWlapCfbI+ccZage6Spgaisja+xl7e4l7e4l7e4l7e4l7e4j7KzX5GWTISKSoGHR32EQ3h/O3N6J294JW9+I2x7LXeFNX+MJ3J+LniFL3mHMXyKOnqGQH2JRYCMSYOPSIGNSoKNWY6Xb56lcp2pbZembZembZembZembZembZembJalSnuMQnWGR3mKTX+QTX2NU4SQWYqTaZqicJWblK+ykKmkdpqZT4ePQX+IMHiENH2JLXWGSIybWZWiaKCrirvBstfdp9HZirW5irW5irW5irW5irW5irW5ibW5fKSoSmttRWdpTHR2UoGFVIeLVYuQVYyRVY2SQoSOU5yoTZaiTJWhQ42XOYOMPoaNTIyZVpajYpulaJ2nbZ+ocZ+ndJyjd5qfe5mdgp2gpLe43eTh9/j0+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLG3hLPAhLTDcqCqWoeMVYKFVYKFV4WLV4WMTICLTYORWI6cWI+cS4aORICFQ3+EPnmDOXKDOHGCOXKCQ3mGRXqGRHuFQ4KFRYaHSIaLToaSToWSSH+IVYaMX42TY5Gfa5WlbJSkbJCeb5KeeKCmf6erhqqtk7S2l7e4l7e4mLi5l7e4l7e4fqapUYiNS4SKS4SKS4OKSoKIRH6HLXOGImp9JGp5KHB9NXeFMneBOX+LMXqGMHyHR4eRR4WPRYOMRYKJUYmQdaWpp8jLudHWl7bBc5yscpurcpurcpurcpurcpurcZurWYqbRHeIPG1/TH2OZpanbZ2qZ5ehapqjeKGmk7Cuk6mhmqqka5WZSISONn+KMnyINn+OT5OjY5+tWpGdaZmjk7fAn8nUibW+iLW9iLW9iLW9iLS9iLS9h7S8f6yzXYyQV4iMWIqOWYuPWIqOWImNWYuPW46STYiPSpGdTJWiSpOgQYqVPIaQTpSgVZakWpyqbaCqeaGofJ+kfZqffJicfpmdj6apwM3M7PDs+fr1+fr1+vv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLK7hLTEfq26ZJKZVoOGVYKFVYOHV4WMVYSMSn+LUIeUWI+cV46bSoSLRICFQ3+EPXeDOXKDOHGCPHODRXqGRXuGRXyGRISGRYaHSYaMToaSToWRTYKKXIqPYI6WZ5OjbJWlbZOibpCddJmifaaqgaisja+xl7e4l7e4l7e4l7e4l7e4j7KzWYuQPnh/PXh/PXh/PXh/PXh/PHqCLnKCI2V3LGx8MnB/Nmp7Q32KSIiUPoKONICKO32ERoGIWI2TdqSpmcHCtdPVwdfbytvfvdDWeZ+tbpenbpenbpenbpenbpena5WlXI+cT4OOQHB7TX2Lapyuc56nVXqBaZSefZ+isLy4s7qysrWrmKunUImTMXyHLnmFM3yLRIiXTIeVVIeVXY2ZbpqjZpWge622e622e621eqy0eKqydKaubaGnZ5uhWImOU4KGT3uATHZ8SHF3Q2lvRWtxSHF3TYSJOH+JT5ikSZGdR4+dPYSSSI+dWJinVpakd6OpeJebeJSYfZmdhaGkn7S22eHf9ffy+fr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLPAhLTDcqCqWoeMVYKFVYKFVoSJV4WMU4OMSX+MU4qXWI+cVY2ZR4KIRICFQ3+EPXeDOXKDOHGCPHSDRXqGRXuGRX2GRIWGRYaHS4aOToaSTYSQUoWMX4ySY5Cca5WlbZWkbZGfcJOfe6Kof6erhqqtk7S2l7e4l7e4l7e4l7e4lba3bpicN3B3MGpyMGpyMGpyMGpyMGpyMm93KW57NniIMHOANXiEO3mERYKNTYaSQXuJNnqESICJgKqxnsHFsNHSudfYw9jc0eDj6/Dw7fDuor3FgKWyf6Wyf6Wyf6Wyf6WyfqSxYouaV4eWUoaSUX+LaZSgjqWkqK2sjqCjnKqlrK6jxcS3v72xrbKtXpGYN4SPLnyGO4OSQ4eWNnSBP3qGTIiSXJWcXpafWpacXZacXpabXZWZXpWZYJebZ5yfcaGkV3uAOVphNlVdNFNbNFNaM1FZM1JZNVVdQXB3L3eASpOeU5ynZqe0NG99SYyWbaSwXZWfeKerdJeag6Wom7y+u9PT5e3p+Pr1+fr1+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLXFfq26ZJKZVoOGVYKFVYKFV4WLV4WMUIGMSoCOVo2aWI+cVIyXRoGHRICFQ36EPHaDOXKDOXGCPXSDRXqGRXuGRX2GRIWGRYaHS4aOToWST4WPWomPYI2UZ5OhbJWlbZOibpGed5ylfqergaisja+xl7e4l7e4l7e4l7e4l7e4hKirSnuCL2dvK2VtKmRsKGNsKGNsKGNsJ2RtMXaDPYeTM32FN4GGP4mQRYmPea+6hrTEUYuXgK24p8bKs9PUutfZxdrd2eXo8fTz+vj1+PfzxNTXh6u3g6i1g6i1g6i1hKi1gKKvbY6ebZOfZZGZXYaRd5acoqmbr6qcrKyirbCiqqyZsLGdt7eri4+KVIOJOIWPMH+IM32KQ4iVQH+NNXWCQYOPTY2VVZegWZecXpaaZJqdbaKkdaiqfq6vjbS2oLq8fpWZOFVdMlBYMlBYM1FZNVRdOVpjRGpzT4KLN36HP4eRWaKqisPNaZegRoKGgbG4hrS5ibm8o8jLtdTU1OXj8PXx+fr1+fr1+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7hLTDcqCqWoeMVYKFVYKFVYOHV4WMV4WMTICLTYORWI6cWI+cUYqURICGQ3+EQn2EOnSDOXKDOXKDQHeFRXqGRXuGRX6GRYaGRoaITYaQT4aSU4eRXoyRY4+Za5WkbZWkbZGfcpagfKSpf6erhqqtk7S2l7e4l7e4l7e4l7e4h6qtYYyTUH6HTHuESnqDR3iCQneBPnWBOnWCMXCAMXeLPIiVVJefcqavTYmYUpedlcjRq9DfbJumYpehmMTIt9bXydzf4uzt9ff1+vn1+/nz/Pvx4+vklbW+hKm2hKi1hKi1hKazd5inbIydc5ijZo6Xao6WfJaaqq+ks7KktbWqubqupqiXe3xweXtyXGxqQHeBM32IKXqDLHaDTJSiTZWjP4aSSI+ZXqKsbK+5b6uud6ytfrCxg7O0jri5nby/qb3Arb7BnK+yTmxyPmRrQmpxSXR7UH+GVoeQWo2WVo2WQIOPOXuHWJqkgrG3nLy+WImPZ6Sll8HBkbi3sc/N4+7q+fv2+vv2+vv2+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7fq25ZJKZVoOGVYKFVYKFVoSJV4WMVYSMSn+LUIeUWI+cWI+cT4iRRICFQ3+EQn2EOnSDOXKDOXKDQXeFRXqGRXuGRX+GRYaHRoaITYaRT4aSWImSYI2TZ5KfbJWlbZOib5KeeaCnfqergaisja+xl7e4l7e4l7e4l7e4iayvYoyUUoCJUX+IUX+IUX+IUX+IUX+IUH+ITH6IPXuKMHiLRIuacqu2ncPOY46aPHmCea62sNHYss/Ya5ilcZ+mwtjS6e/s9/n2+/r0/Pvx/f3w/v7y+fvxus7Shqq3hKi1hKezgKKvbY2fbpCfc5iiaI6WbpCYiJ6es7aqu7uvvbyyvr20lJSKX2BYWF5ZRm92OnuJNn6LMH+JN4GNW6SwW6WwXKOvX6evYqmya6q0bqSngrGyjbi5ncLDqsTHrsDDr8DDvcvL1N3YkLCwXZCVXZKXXpOYXpSZX5SaX5SaW5OZUI2ZR4GQUIeUh6KjorCodaCiT4WJq8O82+TZxM3B8PHi+/vy+vv2+/z3/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7cJ6nWoeMVYKFVYKFVYKFV4WLV4WMU4OMSX+MU4qXWI+cWI+cS4aORICFQ3+EQXyEOnODOXKDOXKDQXeFRXqGRXuHRX+HRYaHR4aKToaSUIaSW4uSYo+Wa5SjbZWkbpGfdJmifaaqf6ishqqtk7S2l7e4l7e4l7e4iKuuaJCXVYKKVICJVICJVICJVICJVICJVICJVICJU4CJQHmEK3KCRYmadqSvr8vSlLS5TIaQaJqiv9jS4+7qo7y8hJ2aysmx8/Hn+vrw/f3w/v7y/v70/v71/v714+vnlbS+hKezhKayd5inaYmbcpaicJafa4+Xb5GZkaOht7msv7+zvbyyv761mpqRXGBaT2doP3eEOnuKM3uKMX6KQ46ZXaOuWaOsWqOtZ6y0VpuifbfBbpyhmcPCrMzOs8rNr8HEtsXH0drX7vLp+/zwwtXQZ5mdYJSZX5SZX5SZYJSZYJOZYZCaXImYW4iUZ5CVvsK04eHOssnFcJaYtbak59/N2dbCzcqx8vLn/f35/v76/v76/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7Yo+WVoOGVYKFVYKFVYOHV4WMV4WMUIGMSoCOVo2aWI+cV46bSoSLRICFQ3+EQHqEOXKDOXKDOnODQ3mGRXqGRXuHRYGHRYaHSIaLToaSUoeSXYySZpGcbJWlbZOicJOfe6Kofqergaisja+xl7e4l7e4l7e4iKutZI2UVYGJVYGJVIGJVIGJVIGJVIGJVYGJVYGJVYGJVoKIUoCHPnyDTISNmrGp6Ozdx9nRY5SafZ+cxMeo7/HR7vHkzMrCxLmmzMeu+Pjo/f3z/v70/v70/v70/v70+Prxus3Ph6i0gKKvbY2eaoucdZmkcJWebZCYcZKZnaqkuryvwMC1vbyyv762mJ2XUW9yRHWAQXiFP3mHNHqMK3WDUZeld7G/So6YWJ+pd7a/RYOKe7K7ncTKrczPssnLqrq9xNDO5erj+vvv/Pzw+vrt4+vigaqsYJSZYJSZYJOZYJOZYpCaZYyaYoqWZImNkqidxMSoy8mr7e/iwci8xcCszsez7unZ0My97ezk/Pv3/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7WIWJVYKFVYKFVYKFVoSJV4WMV4WMTICLTYORWI6cWI+cVY2ZR4KIRICFQ3+EP3qEOXKDOXKDOnODRHmGRXqGRXuHRYKHRYaHSYaMToaSVIiSYI2UapShbZWkbpKfd5ylfqerf6ishqqtk7S2l7e4l7e4iKutZI2UVYGJVYGJVYGJVYGJVYGJVYGJVYGJVYGJVoKJVoKIVoKIUYCGTHyDcI+Lt7ad6ebG5+/gkK6qr7inwbqU19Cq/fnn6OPZysKzzci39fTp/Pzy/Pzy/Pzy/Pzy/Pzy/Pvy4unllbK7d5inaIeabpCfdpulcJScbpGZdpWbp7Cnvb2xwcC1vbyyu721hp+gS4CMR3+MR3+MR3+MMniMNn2NV5Wkjb3NPXWDXJillsjTWI2UaZ+nqMzRtNHUlaepqK+t7vDm+/zv+vrt+fnu+/v0+fr1qcXFY5abYJOZYJOZYpCaZYybZYuaY4mReJWSvcOvzMqwxsOr7ezc393NzMe20s699PHj393Q6Obd9PTt/v35/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7VYKFVYKFVYKFVYKFV4WLV4WMVYSMSn+LUIeUWI+cWI+cVIyXRoGHRICFQ3+EPnmEOXKDOXKDO3ODRHmGRXqGRXuHRYKHRYaHS4aOT4aSWImSZZCabJWkbZOicpahfKSpf6ergaisja+xl7e4l7e4iKutZI2UVYGJVYGJVYGJVYGJVYGJVYGJVYGJVoKJVoKJVoKIVoKIVoKIUH+FW4SIn6uexcOq0tW0+vrs4+XXzcevx76kycOn+ffn+ffs2tXH3trM+/nx/fz0/fz0/fz0/fz0/fz0/fz0+PnytsjMcI+gaIeacpaidZqjb5KabpGZe5icrrWqv76zwcC1u7uym66uZJOgWI2cV42cV42cVIuaO3+SOX2NUJOejbzDSIaPT4+ZnMTJha20XZGXr8vK2uXivcSz7/Hf+fns+fnu+/v0/v74/v75/v752+fkdqKmYJOZYpCaZYybZYyaZIqXaIuOorCk0c63z8y03dzK6+re6Oba0M290s6+9vPm5ePW5+bd7u3k+Pjz/v76/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7VYKFVYKFVYKFVYOHV4WMV4WMU4OMSX+MU4qXWI+cWI+cUYqURICGRICFQ3+EPXeDOXKDOXKDPHSERHqGRXuGRXuHRYOHRYaHS4aOUIaSXIuUaZOgbZWkb5OgeaCnfqerf6ishqqtk7S2l7e4iKutZI2UVYGJVYGJVYGJVYGJVYGJVYGJVoKJVoKJVoKJVoKIVoKIVoKIU4CHUn+GgpyWwcKsysux3N7F8fHd9PHh0cmzysOs1NG39PTk/v718/Hn8O7j/fz0/fz0/v31/v31/v31/v31/fz0/fz03ePhfZema4ucdZqlc5egbpGZbpGZhp6ftbiswMC0wMC1p7KucpynYJSjX5OjX5OjXZGiUIaYR32KPHuFT4iSlrq/eamxUpOWpcG5x9HLjKSgs72n6OfZ2NnCzc629/fu+/v1/Pz3/Pz3/Pz3/Pz39Pfymrq8ZJGbZYybZYybZYuaZImShZ2YyMm00c621dO+6Ofa7Ovg6+rf2NXH0s+/9/Tn7+zg6efe7Ovi8PDo/Pz3/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7VYKFVYKFVYKFVoSJV4WMV4WMUIGMSoCOVo2aWI+cWI+cT4iRRICFRH+FQ3+EPXeDOXKDOXKDPXWERXqGRXuGRXyHRYWHRoaITYaQUoeSYY6Ya5WkbZOidJmjfaaqf6ergaisja+xlra3iKutZI2UVYGJVYGJVYGJVYGJVYGJVoKJVoKJVoKJVoKJVoKJVoKIVoKIVIGHUH6FZouNsLimyMmv0dS55ujQ6evV7u7a2NK+zcmx1tS59fTl/v71/v30/Pvz/fz0/v31/v31/v31/v31/v31/fz0/fz09/fwqLnBcZKhdpulcJSdbpGZbpGZjKGguLuuwcC1s7qzeJ+oYZSkYJSkX5OjXZGiUIeYSn6MTn6HVoSMeJybztXIyNvTja6pt76m6urQ3d3Ivr2a19nB4ODNwsSq7e7l8fLq8vLq8vLq8vLq8vLq8PHqw9LQcJWhZoybZYuaZYuYb4+Rsbqq0s+30M62393N7Ovg7Ovg7Ovg4d/S1dHC+PXn9fLm6+rg6+rh7Ovi9PTt/v35/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7VYKFVYKFVYKFV4WLV4WMV4WMTICLTYORWI6cWI+cWI+cS4aORICFQ3+EQ36EPHaDOXKDOXKDPXWERXqGRXuGRXyHRYWHRoaITYaRVYiTZ5KebZWkcJShe6Kofqerf6ishqqtk7O1iKutZI2UVYGJVYGJVYGJVYGJVoKJVoKJVoKJVoKJVoKJVoKJVoKIVoKIVoKIUX+GVYKHlKidxceuycuw3d/H6OrT6evU6OrT2Na/0M2y19W59fTl/v71/v71/v71/v31/v31/v31/v31/v31/v31/v31/fz0/fz009vbf6CqdZqjb5KabpGZcJKZmqmkvL2xur20iKarY5WkYJSkX5OjXZGiUIeYSn6MTn6HWISNZ5CXq7yvyMuz6/DeztTEv8Sp0dW35+jSx8iuzc6729vK0NG86erf7/Dn8PHo8PHo8PHo8PHo7/Dn5OjhjqmxZoybZYuaZouTlKeezs220M211dO+6Ofa7Ovg7Ovg7Ovg6Ofb2tjJ+PXo+/ns7u3j7Ovi7Ovi7u3k+Pjz/v76/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7VYKFVYKFVYOHV4WMV4WMVYSMSn+LUIeUWI+cWI+cV46bSoSLRICFQ3+EQn2EOnSDOXKDOXKDP3aERXqGRXuGRX2HRYWHR4aKToaSWouWapSjbpSid52lfqerf6ergaisjK6xiKutZI2UVYGJVYGJVYGJVoKJVoKJVoKJVoKJVoKJVoKJV4OJV4OJVoKIVoKIU4CHUH6FdZWSu8Gqxsmt0dO55ujQ6OrT6OrT6OrT39/G0tC019W59fTl/v71/v71/v71/v31/v31/v31/v31/v31/v31/v31/fz0/fz08vTuoru/dJihbpGZbpGZcpOan6ymu72yma6uZ5elYJSkX5OjXZKiUIeYSX6MTn6HWISNX4qUgqGhwsm12t3K9Pbp4OPSxcqt1Ni/7O/d0tXA2NnH3d3N2dnH6uvg7/Dn8PHo8PHo8PHo8PHo7/Dn7e/mtMXGa5CeZYuZeJWWvcKv0c620M22393N7Ovg7Ovg7ezh7Ovg6+rf4d/R+PXo/Prt8O7k7Ovi7Ovi7Ovi8PDo/Pz3/v76///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7///7"
  }
});
