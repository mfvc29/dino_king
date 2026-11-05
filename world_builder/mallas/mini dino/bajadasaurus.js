/**
 * Mini Bajadasaurus (Tipo Agua) — Versión Chibi / Cría compañera de dinosaurio.
 * Basado en el arte oficial de Dinosaur King:
 *   assets/dinos/arte/agua/bajadasaurus_der.webp
 *
 * Características anatómicas del Bajadasaurus:
 *   - Dicreosáurido tierno y rechoncho con lomo arqueado en joroba y colita caída.
 *   - Espectacular abanico de espinas cervicales anilladas en doble fila sobre el cuello:
 *     las delanteras se curvan hacia adelante por encima del cuello y la cabecita
 *     como una cresta protectora majestuosa y adorable.
 *   - Patitas columnares rechonchas cerradas en cúpula dentro del cuerpo (cero piezas abiertas).
 *   - Mandíbula inferior estilizada y articulada para rugir, con dientecitos de marfil.
 *   - Ojos grandes anime con destellos de luz.
 *   - Proyección lateral de la textura oficial con piel dorada/ámbar tostado, franjas y vientre suave.
 *   - Esqueleto con piel deformable (M.pielConHuesos) y animaciones completas (Reposo, Caminar, Rugir).
 */
registrarMalla({
  id: "mini_bajadasaurus",
  categoria: "mini dino",
  nombre: "Mini Bajadasaurus (Agua)",
  icono: "🦕",
  origen: "assets/dinos/arte/agua/bajadasaurus_der.webp",

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const L = (s) => (s > 0 ? "I" : "D");
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
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      return M.pieza(geo, nombre, cols, rows);
    }

    function bloque(x, y, z, rx, ry, rz, curva = 0.5, nombre = "Bloque", segA = 12, segB = 10) {
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

    function almendra(rx, ry, rz, nombre = "Almendra", segA = 16, segB = 12) {
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

    let semilla = 53;
    const azar = () => {
      semilla = (semilla * 16807) % 2147483647;
      return (semilla - 1) / 2147483646;
    };

    // Espina cervical con anillos 3D en relieve y conicidad natural de cuerno
    function espinaAnillada(puntos, r, anillos, nombre) {
      const m = M.tubo(puntos, r, r, {
        segLargo: 52, segRadio: 12, nombre,
        ruido: (t) => Math.pow(Math.max(0, 1 - t), 0.62) * (1 + 0.22 * Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * anillos)), 2) * (1 - t * 0.5))
      });
      m.userData.anillos = anillos;
      return m;
    }

    // ---------------- 1. CUERPO CHIBI CONTINUO Y 100% CERRADO ----------------
    // Eje longitudinal con curvatura orgánica en el lomo y transición continua y suave hacia el cuello
    // [z, y, semiancho, altoHaciaArriba, altoHaciaAbajo, forma]
    const EJE = [
      [-0.77, 0.58, 0.000, 0.000, 0.000, 2.0],  // Punta de la colita cerrada estirada hacia atrás (estilo Amargasaurus)
      [-0.74, 0.54, 0.036, 0.038, 0.036, 2.0],  // Remate estilizado curvando suavemente arriba
      [-0.64, 0.48, 0.068, 0.072, 0.068, 2.1],  // Cola media estirada hacia atrás
      [-0.50, 0.47, 0.110, 0.120, 0.110, 2.1],
      [-0.36, 0.46, 0.160, 0.170, 0.160, 2.2],  // Base de la cola
      [-0.20, 0.46, 0.210, 0.230, 0.220, 2.4],  // Cadera
      [-0.04, 0.50, 0.245, 0.265, 0.260, 2.5],  // Cima de la joroba del lomo
      [ 0.06, 0.49, 0.235, 0.250, 0.250, 2.4],  // Descenso suave y gradual de la espalda
      [ 0.14, 0.50, 0.210, 0.230, 0.235, 2.4],  // Hombros / cruz del animal
      [ 0.20, 0.53, 0.180, 0.205, 0.200, 2.3],  // Transición continua y orgánica hacia el cuello
      [ 0.26, 0.58, 0.155, 0.175, 0.165, 2.2],  // Base del cuello
      [ 0.32, 0.65, 0.135, 0.145, 0.140, 2.1],  // Cuello medio
      [ 0.38, 0.74, 0.122, 0.130, 0.125, 2.1],  // Cuello alto
      [ 0.44, 0.82, 0.120, 0.128, 0.120, 2.2],  // Nuca
      [ 0.50, 0.85, 0.135, 0.145, 0.125, 2.4],  // Cráneo chibi
      [ 0.57, 0.83, 0.115, 0.122, 0.105, 2.3],  // Frente del hocico
      [ 0.63, 0.80, 0.078, 0.085, 0.072, 2.2],  // Hocico estilizado
      [ 0.67, 0.78, 0.000, 0.000, 0.000, 2.0]   // Punta cerrada en domo suave
    ];

    const ejeCurva = new THREE.CatmullRomCurve3(EJE.map(([z, y]) => V(0, y, z)), false, "centripetal");
    ejeCurva.arcLengthDivisions = 1600;
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
      // Suavizamos la inclinación en Y-Z para que las rebanadas desciendan de forma 100% orgánica
      // sin pliegues hacia atrás ni cortes verticales en la transición espalda-cuello:
      const ang = Math.atan2(T.y, T.z);
      const angSuave = ang * 0.25;
      const U = V(0, Math.cos(angSuave), -Math.sin(angSuave));
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

    function uEnZ(z, desde = 0, hasta = 1) {
      let mejor = desde;
      let dMin = Infinity;
      for (let k = 0; k <= 400; k++) {
        const u = desde + ((hasta - desde) * k) / 400;
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

    // Malla continua de ultra-alta densidad para una curvatura orgánica perfecta
    const COLS = M.seg(96, 28);
    const FILAS = M.seg(480, 80);
    const cuerpo = (() => {
      const pos = [];
      for (let r = 0; r <= FILAS; r++) {
        const u = r / FILAS;
        const { P, U } = marcoEje(u);
        const [w, hA, hB, p] = seccion(u);
        const ex = 2 / p;
        const z = P.z;

        // Modelado orgánico de hombros y caderas musculosas de sauropodito
        const hombro = 0.045 * Math.exp(-Math.pow((z - 0.14) / 0.18, 2));
        const muslo = 0.050 * Math.exp(-Math.pow((z + 0.20) / 0.18, 2));

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
      return M.coserNormales(rejilla(pos, COLS, FILAS, "CuerpoBajadasaurus"));
    })();

    // ---------------- 2. ESQUELETO Y RIGGING ----------------
    const MANO_X = 0.18;
    const PIE_X = 0.19;

    const HUESOS = [
      ["Raiz", null, 0, 0, 0],
      ["Cadera", "Raiz", 0, 0.46, -0.20],
      ["Cola1", "Cadera", 0, 0.46, -0.36],
      ["Cola2", "Cola1", 0, 0.48, -0.50],
      ["Cola3", "Cola2", 0, 0.53, -0.64],
      ["Pecho", "Cadera", 0, 0.50, 0.14],
      ["Cuello1", "Pecho", 0, 0.65, 0.30],
      ["Cuello2", "Cuello1", 0, 0.76, 0.38],
      ["Cabeza", "Cuello2", 0, 0.85, 0.50],
      ["Mandibula", "Cabeza", 0, 0.81, 0.48],
      ...LADOS.flatMap((s) => [
        ["Brazo" + L(s), "Pecho", s * MANO_X, 0.42, 0.14],
        ["Mano" + L(s), "Brazo" + L(s), s * MANO_X, 0.15, 0.14],
        ["Muslo" + L(s), "Cadera", s * PIE_X, 0.40, -0.22],
        ["Pata" + L(s), "Muslo" + L(s), s * PIE_X, 0.15, -0.22]
      ])
    ];

    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = "Hueso" + nombre;
      b.userData.reposo = V(x, y, z);
      const p = padre ? hueso[padre] : null;
      b.position.set(x, y, z).sub(p ? p.userData.reposo : V(0, 0, 0));
      (p || g).add(b);
      hueso[nombre] = b;
    });
    g.updateMatrixWorld(true);
    const colgar = (nombre, obj) => {
      const h = typeof nombre === "string" ? hueso[nombre] : nombre;
      if (!h || !obj) return obj;
      h.attach(obj);
      return obj;
    };

    // Vinculación suave de la piel del cuerpo continuo a los huesos
    const uH = (n, d1 = 0.2, d2 = 1) => uCercano(hueso[n].userData.reposo, d1, d2);
    const uCola3 = uCercano(hueso.Cola3.userData.reposo, 0, 0.35);
    const uCola2 = uCercano(hueso.Cola2.userData.reposo, 0.1, 0.45);

    const TRAMOS = [
      [0, "Cola3"],
      [uCola3, "Cola2"],
      [uCola2, "Cola1"],
      [uH("Cola1", 0.15, 0.5), "Cadera"],
      [uH("Pecho", 0.35, 0.65), "Pecho"],
      [uH("Cuello1", 0.50, 0.80), "Cuello1"],
      [uH("Cuello2", 0.65, 0.90), "Cuello2"],
      [uH("Cabeza", 0.80, 1.00), "Cabeza"]
    ];

    const MEZCLA = 0.22 / LARGO;
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
    // Cada pata nace redondeada en cúpula hermética dentro del cuerpo
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
        // Cierre superior hermético en cúpula esférica dentro del torso
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
      // Pata trasera (nace arriba a y=0.60 dentro de la cadera)
      pataCerrada(s,
        [[s * PIE_X, 0.60, -0.22], [s * PIE_X, 0.40, -0.22], [s * PIE_X, 0.20, -0.22], [s * PIE_X, 0.05, -0.22]],
        [[0, 0.125], [0.35, 0.120], [0.7, 0.100], [1, 0.095]],
        ["Muslo" + L(s), "Pata" + L(s)], "PataTrasera");

      // Pie trasero
      colgar("Pata" + L(s), bloque(s * PIE_X, 0.045, -0.21, 0.095, 0.042, 0.105, 0.7, "PieTrasero"));
      [-0.048, 0, 0.048].forEach((dx) => {
        colgar("Pata" + L(s), punta([[s * (PIE_X + dx), 0.045, -0.12], [s * (PIE_X + dx * 0.9), 0.030, -0.07], [s * (PIE_X + dx * 0.8), 0.015, -0.03]], 0.022, "GarraBebe", 8, 8));
      });

      // Pata delantera (nace arriba a y=0.62 dentro del hombro)
      pataCerrada(s,
        [[s * MANO_X, 0.62, 0.14], [s * MANO_X, 0.42, 0.14], [s * MANO_X, 0.22, 0.14], [s * MANO_X, 0.05, 0.14]],
        [[0, 0.115], [0.35, 0.108], [0.7, 0.092], [1, 0.088]],
        ["Brazo" + L(s), "Mano" + L(s)], "PataDelantera");

      // Pie delantero
      colgar("Mano" + L(s), bloque(s * MANO_X, 0.045, 0.15, 0.090, 0.042, 0.098, 0.7, "PieDelantero"));
      [-0.044, 0, 0.044].forEach((dx) => {
        colgar("Mano" + L(s), punta([[s * (MANO_X + dx), 0.045, 0.23], [s * (MANO_X + dx * 0.9), 0.030, 0.28], [s * (MANO_X + dx * 0.8), 0.015, 0.32]], 0.020, "GarraBebe", 8, 8));
      });
    });

    // ---------------- 4. ABANICO DE ESPINAS CERVICALES ANILLADAS (CRESTA PROMINENTE) ----------------
    // Doble fila de espinas que se curvan hacia adelante por encima del cuello y la cabecita
    const uLomoPecho = uH("Pecho");
    const uNuca = uH("Cabeza");

    // Perfil de longitud e inclinación (grados respecto a vertical: + = hacia cola, - = hacia hocico)
    const LARGO_ESP = [
      [0.14, 0.09],
      [0.20, 0.16],
      [0.26, 0.24],
      [0.32, 0.28],  // Espinas cumbre más largas curvadas sobre la cabeza
      [0.38, 0.25],
      [0.44, 0.17]
    ];
    const INCLINA = [
      [0.14,  38],  // Las traseras apuntan hacia la cola
      [0.20,  18],
      [0.26,  -8],
      [0.32, -28],  // Las delanteras se proyectan curvadas hacia el hocico
      [0.38, -44],
      [0.44, -52]
    ];

    const N_ESP = 11;
    for (let k = 0; k < N_ESP; k++) {
      const z = 0.14 + (0.30 * k) / (N_ESP - 1);
      const u = uEnZ(z, uLomoPecho, uNuca);
      const Lg = M.interp(LARGO_ESP, z) * (0.95 + azar() * 0.10);
      const b = (M.interp(INCLINA, z) + (azar() - 0.5) * 5) * grad;

      LADOS.forEach((s) => {
        const ab = s * (9 + azar() * 3) * grad;  // Las dos filas se abren suavemente en V
        const base = enCuerpo(u, s * 0.13, -0.035);  // Base embutida profundamente dentro del cuello
        const dir = V(Math.sin(ab), Math.cos(b) * Math.cos(ab), -Math.sin(b) * Math.cos(ab));
        const curva = V(0, -0.16, b > 0 ? -1 : 1).normalize();

        const medio = base.clone().addScaledVector(dir, Lg * 0.55).addScaledVector(curva, Lg * 0.06);
        const fin = base.clone().addScaledVector(dir, Lg).addScaledVector(curva, Lg * 0.16);

        const nAnillos = 6 + Math.round(Lg * 15);
        const rBase = 0.020 - 0.004 * (k / N_ESP);
        colgar(duenoEn(u), espinaAnillada([base, medio, fin], rBase, nAnillos, "EspinaCuello"));
      });
    }

    // ---------------- 5. CABEZA, MANDÍBULA ESTILIZADA Y DETALLES FACIALES ----------------
    // Mandíbula inferior modelada con alta resolución de vértices
    const MAND_PERFIL = [
      // [z, y, semiancho, alto, forma]
      [0.44, 0.825, 0.125, 0.038, 2.2],  // Comisura de la mejilla
      [0.50, 0.818, 0.115, 0.040, 2.2],  // Mandíbula media
      [0.55, 0.810, 0.095, 0.038, 2.2],  // Curva hacia el mentón
      [0.60, 0.805, 0.068, 0.032, 2.2],  // Barbilla delantera
      [0.64, 0.812, 0.038, 0.024, 2.0],  // Curva suave del mentón
      [0.66, 0.820, 0.000, 0.000, 2.0]   // Punta cerrada
    ];

    const colsMand = M.seg(56, 20);
    const filasMand = M.seg(36, 16);
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
    colgar("Mandibula", M.coserNormales(rejilla(posMand, colsMand, filasMand, "MandibulaBebé")));

    // Labios superiores estilizados con contorno anatómico y sonrisa amable
    LADOS.forEach((s) => {
      const labioPuntos = [
        [s * 0.134, 0.840, 0.44],
        [s * 0.122, 0.835, 0.50],
        [s * 0.102, 0.830, 0.55],
        [s * 0.072, 0.828, 0.60],
        [s * 0.038, 0.830, 0.64],
        [s * 0.005, 0.832, 0.665]
      ];
      colgar("Cabeza", M.tubo(labioPuntos, 0.0075, 0.005, { segLargo: 36, segRadio: 12, nombre: "LabioSuperior" }));
    });

    // Dientecitos redondeados de marfil colocados en la mandíbula
    LADOS.forEach((s) => {
      [0.51, 0.55, 0.59].forEach((z, idx) => {
        const xTeeth = s * (0.088 - idx * 0.018);
        colgar("Mandibula", bloque(xTeeth, 0.832, z, 0.006, 0.008, 0.006, 0.4, "DienteBebe", 12, 10));
      });
    });

    // Fosas nasales en lo alto del hocico
    LADOS.forEach((s) => {
      colgar("Cabeza", bloque(s * 0.028, 0.935, 0.58, 0.010, 0.009, 0.010, 0.4, "FosaNasal", 12, 10));
    });

    // Ojos anime grandes y expresivos
    LADOS.forEach((s) => {
      const ojoGrupo = new THREE.Group();
      ojoGrupo.position.set(s * 0.130, 0.935, 0.475);
      ojoGrupo.rotation.y = s * 0.42;

      // Fondo blanco del ojo
      ojoGrupo.add(almendra(0.052, 0.048, 0.014, "OjoBlanco"));

      // Iris ámbar dorado / agua profunda
      ojoGrupo.add(bloque(s * 0.004, 0, 0.006, 0.038, 0.038, 0.008, 1, "IrisAgua"));

      // Pupila oscura profunda
      ojoGrupo.add(bloque(s * 0.004, -0.002, 0.012, 0.020, 0.022, 0.006, 1, "Pupila"));

      // Brillos especulares
      ojoGrupo.add(bloque(-s * 0.012, 0.014, 0.016, 0.014, 0.014, 0.005, 1, "BrilloOjo"));
      ojoGrupo.add(bloque(s * 0.012, -0.012, 0.015, 0.007, 0.007, 0.004, 1, "BrilloOjoPequeno"));

      // Párpados suaves superior e inferior adaptados al ojo
      ojoGrupo.add(M.tubo([
        [-0.048, 0.006, 0.006],
        [0, 0.046, 0.012],
        [0.048, 0.006, 0.006]
      ], 0.005, 0.004, { segLargo: 12, segRadio: 8, nombre: "ParpadoSuperior" }));

      ojoGrupo.add(M.tubo([
        [-0.044, -0.006, 0.006],
        [0, -0.042, 0.010],
        [0.044, -0.006, 0.006]
      ], 0.0045, 0.0035, { segLargo: 12, segRadio: 8, nombre: "ParpadoInferior" }));

      colgar("Cabeza", ojoGrupo);
    });
    // ---------------- 6. PINTURA: PROYECCIÓN Y COLORES DE BAJADASAURUS_DER.WEBP ----------------
    const TEXTURA = this.textura;
    const proyectar = M.proyeccion(TEXTURA, 0.90);

    const C_BASE_AMBAR = new THREE.Color(0xd3a255);
    const C_CREMA_VIENTRE = new THREE.Color(0xf4e6c8);
    const MARFIL = new THREE.Color(0xeee3c6);
    const cColor = new THREE.Color();

    // Colores para las espinas cervicales anilladas
    const C_ESPINA_OSC = new THREE.Color(0x38322c);
    const C_ESPINA_CLA = new THREE.Color(0xcac0b0);

    // Pintar cuerpo cerrado con proyección lateral y vientre crema continuo
    M.pintar(cuerpo, (i, p) => {
      proyectar(p.z, p.y, cColor);

      // Si cae fuera de la silueta de la imagen (negro), usamos color base ámbar
      if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) {
        cColor.copy(C_BASE_AMBAR);
      }

      // Vientre y garganta más claros continuos en la parte inferior
      const u = Math.floor(i / (COLS + 1)) / FILAS;
      const cIdx = i % (COLS + 1);
      const fi = Math.PI + (cIdx / COLS) * Math.PI * 2;
      const co = Math.cos(fi);

      if (co < 0 && p.y < 0.70 && u > 0.12 && u < 0.90) {
        const factorVientre = Math.pow(-co, 1.5) * suave(0.70, 0.38, p.y);
        cColor.lerp(C_CREMA_VIENTRE, Math.min(1, factorVientre * 0.90));
      }

      return cColor;
    }, g);

    // Pintar todas las piezas secundarias
    const COLOR_PIEZAS = {
      pataDelantera: 0xb58c4e,
      pataTrasera: 0x8a6234,
      pieDelantero: 0xa87f43,
      pieTrasero: 0x7c542a,
      mandibula: 0xc8974a,
      labio: 0x8f632d,
      fosaNasal: 0x5a3c1c,
      parpado: 0x754e26,
      iris: 0x14b8a6,
      pupila: 0x111827,
      brillo: 0xffffff,
      ojoBlanco: 0xfdfbf7
    };

    const piezas = [];
    g.traverse((o) => { if (o.isMesh && o !== cuerpo) piezas.push(o); });

    piezas.forEach((o) => {
      if (/^(Diente|Garra)/.test(o.name)) {
        return M.pintar(o, () => MARFIL, g);
      }
      if (o.name === "EspinaCuello") {
        const { cols, rows } = o.userData.rejilla;
        const n = o.userData.anillos || 8;
        const C_OSCURO = new THREE.Color(0x322c27);
        const C_CLARO = new THREE.Color(0xddd4c5);
        const C_PUNTA = new THREE.Color(0xf6ede0);
        return M.pintar(o, (i) => {
          const t = Math.floor(i / (cols + 1)) / rows;
          const anillo = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * n)), 2);
          cColor.copy(C_OSCURO).lerp(C_CLARO, Math.min(1, anillo * 0.90 + 0.18 * t));
          if (t > 0.85) cColor.lerp(C_PUNTA, (t - 0.85) / 0.15);
          return cColor;
        }, g);
      }
      if (o.name === "OjoBlanco") return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.ojoBlanco), g);
      if (o.name === "IrisAgua") return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.iris), g);
      if (o.name === "Pupila") return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.pupila), g);
      if (/^BrilloOjo/.test(o.name)) return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.brillo), g);
      if (/^Parpado/.test(o.name)) return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.parpado), g);
      if (o.name === "LabioSuperior") return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.labio), g);
      if (o.name === "FosaNasal") return M.pintar(o, () => new THREE.Color(COLOR_PIEZAS.fosaNasal), g);
      if (o.name === "MandibulaBebé") {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, p.y, cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.mandibula);
          return cColor;
        }, g);
      }
      if (o.name === "PataDelantera" || o.name === "PieDelantero") {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, Math.max(p.y, 0.18), cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.pataDelantera);
          return cColor;
        }, g);
      }
      if (o.name === "PataTrasera" || o.name === "PieTrasero") {
        return M.pintar(o, (i, p) => {
          proyectar(p.z, Math.max(p.y, 0.18), cColor);
          if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.setHex(COLOR_PIEZAS.pataTrasera);
          return cColor;
        }, g);
      }

      // Por defecto proyectar con salvaguarda
      M.pintar(o, (i, p) => {
        proyectar(p.z, p.y, cColor);
        if (cColor.r < 0.08 && cColor.g < 0.08 && cColor.b < 0.08) cColor.copy(C_BASE_AMBAR);
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
      return new THREE.QuaternionKeyframeTrack("Hueso" + nombre + ".quaternion", tiempos, valores);
    }

    function sube(nombre, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      const [x0, y0, z0] = hueso[nombre].position.toArray();
      for (let i = 0; i <= n; i++) {
        tiempos.push(i * (dur / n));
        valores.push(x0, y0 + fn(i / n), z0);
      }
      return new THREE.VectorKeyframeTrack("Hueso" + nombre + ".position", tiempos, valores);
    }

    const sen = (t, c = 1) => Math.sin(t * Math.PI * 2 * c);
    const cos = (t, c = 1) => Math.cos(t * Math.PI * 2 * c);

    // Reposo: respiración suave, mecida dulce de cuello y colita
    const dR = 2.6;
    const reposo = new THREE.AnimationClip("Reposo", dR, [
      sube("Cadera", dR, (t) => 0.008 * sen(t)),
      giro("Pecho", dR, (t) => [1.2 * sen(t), 0, 0]),
      giro("Cuello1", dR, (t) => [-1.5 * sen(t), 1.2 * sen(t), 0]),
      giro("Cuello2", dR, (t) => [0.8 * sen(t), 1.0 * sen(t), 0]),
      giro("Cabeza", dR, (t) => [1.8 * sen(t), -1.5 * sen(t), 1.0 * cos(t)]),
      giro("Cola1", dR, (t) => [0, 6 * sen(t), 0]),
      giro("Cola2", dR, (t) => [0, 10 * sen(t), 0]),
      giro("Cola3", dR, (t) => [0, 15 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro("Brazo" + L(s), dR, (t) => [s * 1.0 * sen(t), 0, 0]),
        giro("Muslo" + L(s), dR, (t) => [-s * 1.0 * sen(t), 0, 0])
      ])
    ]);

    // Caminar: trote alegre y suave de sauropodito con coordinación diagonal cuadrúpeda
    const dC = 1.0;
    const PASO = 14;
    const caminar = new THREE.AnimationClip("Caminar", dC, [
      sube("Cadera", dC, (t) => 0.010 * (1 - cos(t, 2)) / 2),
      giro("Cadera", dC, (t) => [0, 2.0 * sen(t), 1.2 * sen(t)]),
      giro("Pecho", dC, (t) => [0.6, -2.0 * sen(t), -1.2 * sen(t)]),
      giro("Cuello1", dC, (t) => [1.2 * sen(t, 2), 1.2 * sen(t), 0]),
      giro("Cuello2", dC, (t) => [0.6 * sen(t, 2), 0.8 * sen(t), 0]),
      giro("Cabeza", dC, (t) => [-1.0 * sen(t, 2), -1.5 * sen(t), 0.8 * sen(t)]),
      giro("Cola1", dC, (t) => [0, 6 * sen(t), 0]),
      giro("Cola2", dC, (t) => [0, 12 * sen(t), 0]),
      giro("Cola3", dC, (t) => [0, 18 * sen(t), 0]),
      // Trote contralateral cuadrúpedo armónico
      giro("BrazoI", dC, (t) => [-PASO * cos(t), 0, 0]),
      giro("BrazoD", dC, (t) => [ PASO * cos(t), 0, 0]),
      giro("MusloI", dC, (t) => [ PASO * cos(t), 0, 0]),
      giro("MusloD", dC, (t) => [-PASO * cos(t), 0, 0])
    ]);

    // Rugir / Celebrar: se para en sus patitas traseras, alza el cuello con las espinas curvadas, abre la boca y ruge
    const dG = 1.8;
    const alzar = [[0, 0], [0.22, 1], [0.75, 1], [1, 0]];
    const abrirBoca = [[0, 0], [0.25, 0], [0.40, 1], [0.70, 1], [0.85, 0], [1, 0]];
    const rugir = new THREE.AnimationClip("Rugir", dG, [
      sube("Cadera", dG, (t) => 0.030 * M.interp(alzar, t)),
      giro("Cadera", dG, (t) => [-8 * M.interp(alzar, t), 0, 0]),
      giro("Pecho", dG, (t) => [-10 * M.interp(alzar, t), 0, 0]),
      giro("Cuello1", dG, (t) => [-8 * M.interp(alzar, t), 0, 0]),
      giro("Cuello2", dG, (t) => [3 * M.interp(alzar, t), 0, 0]),
      giro("Cabeza", dG, (t) => [6 * M.interp(alzar, t), 0, 0]),
      giro("Mandibula", dG, (t) => [24 * M.interp(abrirBoca, t), 0, 0]),
      giro("Cola1", dG, (t) => [4 * M.interp(alzar, t), 8 * sen(t, 2), 0]),
      giro("Cola2", dG, (t) => [6 * M.interp(alzar, t), 14 * sen(t, 2), 0]),
      giro("Cola3", dG, (t) => [9 * M.interp(alzar, t), 20 * sen(t, 2), 0]),
      ...LADOS.flatMap((s) => [
        giro("Brazo" + L(s), dG, (t) => [-16 * M.interp(alzar, t), 0, s * 5 * M.interp(alzar, t)]),
        giro("Muslo" + L(s), dG, (t) => [8 * M.interp(alzar, t), 0, 0])
      ])
    ]);

    g.animations = [reposo, caminar, rugir];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => "Hueso" + nombre);

    return g;
  },
  // Imagen de referencia reducida ×3, sin tinta (RGB en base64) para proyectar colores fieles de bajadasaurus_der.webp
  textura: {
    w: 173, h: 130, k: 3, esc: 0.00295, x0: 265, y0: 385,
    datos: "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l4p1gXlrXVtXVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVFRSVFRSTU1LQ0NDQkJCQkJCQkJCQkJCQkJCQkJCQkJCQ0REUFJRWVxbV1hYU1RTU1NTU1NTU1NTU1NTVVVUWVlXWVlXWVlXWFhWTk5MQUE/Pz89Pz89QkI/RURAQkM/QUI/QUI/QUI/QUI/QUI/RkZDTkxKUU9NUU9NUE5MR0VERUNCRUNCSkhFUlFKUlFKU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLxrKJxrKJxrKJxbGIxbGInItlXE4uWEsrXlExq52D6dvF7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcWEomeGhGhXNShXNShXNShnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRTkH5c2sih/uvD/uvD/uvD/uvD9eG7tJh7lXZelHVdknVdhnFdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdhHJflohzm5B6fHZoWFhVVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVFRSU1NRSUlJQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCR0hHVlhYWVxbV1hYU1RTU1NTU1NTU1NTU1NTVlZVWVlXWVlXWVlXWFhWT09NQkJAQ0I/R0ZCSEZCR0ZCRURBQkM/QUI/RERBSklHUE5MUU9NUU9NUU9NT01LRkRDRUNCRUNCSkhFUlFKUlFKU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLxrKJxrKJxrKJxbGIxbGIno1nXE8vWEsrWEsreWtO18qy7N7I7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcX1Etf25MhXNShXNShnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRTh3VUt6V/+OW9/uvD/uvD/uvD/enC0biXmXtilXZelHVdjHNdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdg3FelIZwnpJ7l4x3cm5jWFdUVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVFRSUlJRSUlIQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCTU5NWFtaWVxbV1hYU1RTU1NTU1NTU1NTVFRUWVlXWlpXWllXWVlXWFhWTk1LSEZCSEZCSEZCSEZCSEZCSEZDT01KWllWVFJQUlBOUlBOUU9NUU9NTEpIRUNCRUNCRUNCS0lGUlFKUlFKU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLxrKJxrKJxrKJxrKJxbGIrJpzY1Y1WEsrWEsrXlExq52D6dvF7N7I7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcT0MeZ1g1g3FQhXNShXNShnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRTlYNg4c6m/uvD/uvD/uvD/uvD79u1q49zlXZelHVdkHRdhHBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdkYJtnpJ7npJ7lot3bGhgVlVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVFRSVFRSUVFPRkZGQkJCQkJCQkJCQkJCQkJCQkJCQkJCREREUlRTWVxbWVxbV1hYU1RTU1NTU1NTVFRTWllXWllWWllXWlpXXVxaW1lWT01JSUdDSUdDSUdDSUdDUU9LZWNfbGpoYmBeVVNRUlBOUU9NUU9NSUdGRUNCRUNCRUNCTUxHUlFKUlFKU1JLU1JLU1JLU1JL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lHVdjHNdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdhXRhmYx2npJ7n5N8npJ7nI95i3psdGhgWlhVVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVVVTV1ZVY2BfaGNjZGBgW1hYUU9PR0ZGRUVESEZFVE5GV09GV09GV1BHW1dSXlxYXlxYWlhUWVdTXFpWa2llbWtnbGpmaGZiY2JebGtnbGxnY2RfYmNeYmJeY2NgYGFeS0pHUE9MX11aYmBeT05MRkRCU1JOaGZiXVxWVFNMU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLxrKJxrKJxrKJxrKJxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsreWtO18my7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcUkYhcGA+hHJRhXNShXNShnRThnRThnRThnRThnRThnRThnRThnRThnRThnRThnRTjXtYz7uR/Om//uvD/uvD/uvD8t64rZF1lXZelHVdkHRdhHBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdgnBdg3FelYdxnpJ7npJ7npJ7nZF7kH9vhnRpc2hgWlhVVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTWllXZ2NjamVlamVlaGRkYV1dWVRUWFNSXFZRXVZQXVZQXVZQW1hTWVdTWVdTWVdTWVdTX11ZdHJuc3FtcG5qbm1pa2llaWhkZmVhY2JeYWBdXl1aXl1aWVhVUVBMVlRQWllVXFtXTUxIRkVBVVNPa2llamhjXVxWVFNMU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLU1JLxrKJxrKJxrKJxrKJxbGIxbGInItlXE4uWEsrWEsrWEsrWEsrXlExrJ2C6tvF7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J7d/J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hnRThnRThnRThnRThnRTm4hi4c2e/OnA/uvD/uvD/enC0biXmXtilXZelHVdiXJdgnBdgnBdgnBdgnBdgnBdgnBdgnBdhHJflohznpJ7n5N8npJ7mo14i3lsiXZqiXZqiHVpiHVpiHVpg3JnamJcV1ZTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVVTVVRSVVRSVVRSVVRSVFRSU1NRT09NTk5MT05MU1FNXlpVYl5YY19ZYFxWV1NOXVpWZ2ZjaGdjaWdkaGVgaGRgcW1qeHRxcW1qZGFeUlBMeHZyiomFiYeDbm1pZmZhZ2djbW1pg4J+k5KOiYeDdHNvaGdjaWdjZ2ZiZWNfZmRgZ2ZiZ2ZiZGNfYmFdYF5aX11ZXl1ZXFtXW1pWWllVWllVV1ZRVFNMVlVNXVtQaGVWbGdWWVNCVU48Zl9NvLisxrKJxrKJxrKJxrKJxrKJxbGIwa6FgHBNWEsrWEsrWEsrWEsrWEsrWEsrWEsrg3RW3suy6te+69i/69nB7N3G7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcT0MeZ1g1g3FQhXNShXNShnRThnRThnRThnRThnRThnRThnRThnRThnRTinhWvqt/9eG1/uvD/uvD/uvD79u1q49zlXZelHVdjnRdg3BdgnBdgnBdgnBdgnBdgnBdgnBdg3FelIZwnpJ7npJ7npJ7m455jHpsiXZqiXZqiXZqiHVpiHVpiHVpg3JnaWJcVlZTVVVSVVVSVVVTVVVTVVVTVVVTVVVTVVVTVVVTVFRSVFRSVVRSVVRSVVRSVVRSVVRSVVRRU1FOU1BNVVFNV1JNWFNOXVpTYF5WZGFaW1hRUExGWFVPZWRfZ2VgbWpkamZgZWFbgHx3dXFtbmpmZmNeWFZSWFZSaGZifHp2cG9rZGRfaGhjcHFsjYyIl5WRi4mFcW9rZmVhZGNfXVtXYmBcZWNfZ2VhaGdjaGdjZWRgYmFdYF5aX15aX11ZXVtXW1pWXVtWY2FZcGtcfndij4hslY5ve3NZWFA8W1M/m5aH5OLZxrKJxrKJxrKJxrKJxrKJxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsr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iHVpiHVpfGpZaVc9aFY8b19KhXpyiH54h354hHp1fXRucGhjY1xWWVJNVU9JVE5JVE5JVk9KWFFMWlNOXFRQXlZSYFhUYFhUYFhUZmBacGtlZGBbX1tWY19akY2Ir6ula2dhZ2NdcG1nfnp0kY2HkI2GjIiCeXVwe3dzg397gHx5k4+McW1qXVpWZmRgfn15pKKelpSQdnRwdXNve3p2b25pYWBaZGNdXFtVZmRecW9pc3BqdHBpdm5neG5meW9naGBZYlpUaGBZkoh5lIpxkYdtlo1wm5NyfXVaWlI9e3Vk1dPJ3NvTj46LWlpZxrKJxrKJxrKJxrKJxrKJxrKJxbGItaJ6aFo5WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrhnhc49G569i/69i/69i/69i/69i/69jA7NzE7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcTUEcUkYhcGA+hHJRhXNShXNShnRThnRThnRThnRThnRThnRThnRTh3VUsJ1y69al/enA/uvD/uvD8t64rZF1lXZelHVdjnRdg3BdgnBdgnBdgnBdgnBdgnBdhXRhmYx2npJ7npJ7npJ7lod0iXZqiXZqiXZqiXZqiXZqiHVpiHVpeWdUaFY9aFY8allBgHRoioB6ioB6iX95iX95iH95hXt2fXRudGxmaWFcY1tWYFhUYFhUYFhUYFhUYFhUX1dTW1NOVU5IVlBJZF9aWFRPXVlUcGxnyMS+wb64XltVa2hieHRvgn55mZaQlZGLg396dXFsg396hIB7bGhib2xjdXJrY2FcZWRffXx4l5WRhoSAeHZyeXhzd3ZxYWBaWVhRYF9ZWVhRV1VPZGFbb2lidm5meG5mfXNrdWxkY1tVYlpUdWxknpSCkohukYhtmZBxkoprZV1HZl9MvLis4+LZpqahXl5eV1dXxrKJxrKJxrKJxrKJxrKJxrKJxbGIt6R8bF08WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrb2FE3My57tzF69i/69i/69i/69i/69i/69jA7NzE7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEc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gnBdoZF6xbieoZV+npJ7nZB6jn5uiXZqiXZqiXZqiHVpiHVpe2lXaVc9aFY8aFY8Z1U8ZVQ9W09IdWpnjoOAkIWCkIWCkIWCjoSAi4F8ioB6ioB6ioB6ioB6iX95iX95iX95gXRvZ1hUX1dRamZec3Bod3RtfHpzZWNeSklEZmVg5uTh9PLvm5iTaGRde3hwl5SLf31zamhkjoyLlpWNh4R4c29cZmFKalc6blQ0cVk6aE4xYEUra1E4Y0oydlc5e1s4Z1AxXVA2XlM5X1M7Vkw2XlQ8ppt60MCijnxkeGdOf3BenJB+oJR+hnhbi35efXRdsq+i4uHai4uJWVlZWFlYY2NiYWFbY2NaZGNasZ10w6+GxbGIxrKJxrKJxrKJxrKJxbGIrJpzY1Y1WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWUwskYNp9ebY/u7h/uzd+uDH79i+69i+69i+69i+69i/69i/69i/69i/69rD7N7H7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTUEcXVEspZVynIloh3VUhnRThnRThnRThnRThnRThnRThnRTpZJq4c2Z9+O3/uvD/uvD79u1q49zlXZelHVdjHNdgnBdgnBdgnBdgXBckYBqzL+kppqCn5N8nZF6j39uiXZqiXZqiXZqiHVph3RodWNOaFY8aFY8aFY8Z1U8ZFM+WExGXlNQg3h1kIWCkIWCkIWCkIWCj4SAjIF8ioB6iYB5iX95iX95iX95iH54dmZiYk9MWk9JaGNca2dhaGRfc3BrgX95YmBbdnVx6+jl+ff1sK2nX1tTbmtinpuRhoR6cW5md3BkeW9efXFXbmRJal1Bb1UzbVIwclg1bFAtcVErkHVIfGY9jm09h2c8c1w5aVk7aFtAXVE4W1E4WVA4cmlL0MOoo5KCallHaVtLeWxbgXRde2lMjXtb6eLO29rRzs7LaWloZWVliImIlZWQamlhZWRbZWRbrZlwwKyDxbGIxbGIxrKJxrKJxrKJxbGItaJ6aFo5WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrc2ZJ49PD/u7h/u7h/urY+N3C7ti+69i+69i+69i+69i/69i/69i/69i/69rD7N7H7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcTkIdgHNPxbOQnIlnh3VUhnRThnRThnRThnRThnRThnRTjnxZy7eG7tqo/enA/uvD++jAxqyNl3hglHVekHRdhHBdgnBdgnBdgW9cjXxm1MaqrqKKn5N8nZF6koJxiXZqiXZqiXZqiHVph3Roc2FMaFY8aFY8aFY8Z1U8YVJAVktHV0xJb2RhjYJ/kIWCkIWCkIWCkIWCkIWBjIJ9iH94h353h353h353iH12Z1VSVUhDTkU/VlBKZF9baGNff3p1op6ZpqKcu7iz+Pf17+/tpaKdhIF5enhunZuOkZCEd3ZngHVRhXE+cV03Yk4tf2A6iGQ7dlo3dVw4h2g9mndEmn1OdmA4hWY0imw7emU8X1AwYFU4VkwxWE80WFA2XVU6rKWR1c3GYVZIXFBBVEg6XlFBfmxRkHpbtqqW7+7i4uLfrK6tyMvJzc/LgYB4ZWRbZWRbZ2ZcqpZtvKh/xbGIxbGIxrKJxrKJxrKJxbGIt6R8bF08WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrYVM0xbaj/e3g/u7h/u7h/ebS+Nu+7ti969i+69i+69i+69i/69i/69i/69i/69rC7NzF7N7I7N7I7N7I7d/J7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcVUklqpx60r+cnIlmh3VUhnRThnRThnRThnRThnRTh3VUsJ1y5dCc9+O3/uvD/uvD59Gto4ZrlXZelHVdiXJdgnBdgnBdgW9cgXBaxbeavbGXn5N8nZF6lIVyiXZqiXZqiXZqiHVphXJkb11GaFY8aFY8aFY8aFY8YlNBVktHVktIXFFOfnNwkIWCkIWCkIWCkIWCkIWCj4WBioB6gnpygHlwgHlwfnZucGZgVExFUEhCWFFLcGtld3JsiIN8lpGJm5WOs66o397b3t7Zs7KopaSZjIuAiol9iol9fHlrgXNPf2o5aVIuY0wriWg+onhJhGQ7e2E3iWw9lnlLkHZPa1M0emA7fWU3Y1MtWE8wV08yT0YsUkkuWE82X1hBopyO+PbxhX9zVEk7T0M1UUQ0eGVMtpx83s261My42dPE9/n18vTwp6ehaGdeZWRbbWtgioJzqZVstqJ5xbGIxbGIxrKJxrKJxrKJxbGIv6yDfG1KWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWk0upJV++enc/u7h/u7h/u3e/OLJ9tm87di+69i+69i+69i+69i/69i/69i/6te+6da869rB7N7H7N7I7N7I7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcTUEcbmI+0cKg0r6ZnIhlh3VUhnRThnRThnRThnRThnRTk4Fd0r6M79qo/enA/uvD+eW+waWHl3hflHVdjnRdg3BdgnBdgW9cf21XwbOWzsKnoZV+nZF6loZzindriXZqiXZqiXZphXJjbVtDaFY8aFY8aFY8bVtAfW1ZWU5KVktIVktIaV5bjIF+kIWCkIWCkIWCkIWCkIWCkIWCiYB6fXZte3Vte3ZugHt0bmdiW1NOXVNObmZgd3FqeHFrjoiBmpSNgn11kY6FsbGmsLCkqamcjo6Be3lvhIJ5hX5wfGtLfmY8d1s5cFU2cVsuhWkzk3Q9clwvdF81gG1EaFY3X0wxeGRBe2tFVUwsUEksUUkvT0YtTkYuUEk1WFBBfnds8O7pwbuyXFFFV0k5Wk08f3Rj3dG7sJt66d/RxLmoua+d7uvif351bmxifHhsmpB/saOOqZVssZ10w6+GxbGIxrKJxrKJxrKJxbGIwa6FgHBNWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrfnBV7NzN/u7h/u7h/u7h/ura+97D9dm87Ni+69i+69i/69i/69i/6te+6te+6te96NO26de87N3G7N7I7N7I7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcUEQfl4po59e10LuVnIhlh3VUhnRThnRThnRThnRTiHZUs6B05tKd9+O3/uvD/urD4smnooNplXZeknVdhnFdgnBdgW9cfGpUqpx/286yppqCnpF6mYl1jHlriXZqiXZqiXZqlIBvdGJJaFY8aFY8aFY8hXJWpZN9W1BMVktIVktIWk9Mem9sj4SBkIWCkIWCkIWCkIWCkIWCjoN/amNcY15Wcm5meHVtg394gHZwhXx1fXZucWpjdG5nkY2FhIB4eXZsgX90npySpqSapaKYmJSJgXxxfXNpeGpXalU1fmRAkXRKh25JXE8rX08nemI1Z1UvW04tY1c5VkwxUEctZVo6aVw7U0stT0ktT0gvUEcxTUYyTEU0YFhIqKGU/fr19e/ou7GlaVpKZVlJ1NHE+fnwvqyVl4dz+fTquKiUl4pzmZWFiINyopiEtKWQtaaQqZVsrZlwwKyDxbGIxbGIxrKJxrKJxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsral0/2Mm3/u7h/u7h/u7h/u7h/ujV+9y+9dm87Ni/69i/69i/69i/69i/6te+6te+6ta859K06NS369zF7N7I7N7I7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTUEcX1MvwbSU7Nu4z7mSnIhlh3VUhnRThnRThnRThnRTmohi2sWR79qo/enA/uvD9d65vqCDl3hflHVdjHNdgnBdgW9cemlTnI1w59q9r6KKnpF7mYp1jHpsiXZqiXZqjXptsZ2He2hOaFY8aFY8bltBtKCAt6WNXFBMVktIVktIVktIY1lWgnp3joSBkIWCkIWCkIWCkIWCjoN/YVpTSEM5VE9Gb2xkfHhvl5GHlI+FfHZtb2tja2lgf310kpCFfXtwgoB1ko6GnpaRnZSRjoeEZ2BUdWJNdl5Adl47ak4udFw8dmJBWEwsXVAvYlY3Wk8vTEQmTkcsSkQqSUQqS0YrVEsvUkswUEs2Uk09VVBCUks9UUs7aWNR4t7R6ubg7enj7OfbjoJyd25dx8i48fXo+PbtsKSVu6+j5t3Qh3lpcWlWhXxnsKGLtaaQtaaQqZVsqpZtvKh/xbGIxbGIxrKJxrKJxbGIxbGInItlXE4uWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrXVAwsqSO/Oze/u7h/u7h/u7h/u3f/ePM+9u89NzB7NnA69i/69i/69i/6te+6te+6te+6ta859Gz59K06trB7N7I7N7I7N7I7d/J7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcTkIdgnVT49W159StzbePnIhlh3VUhnRThnRThnRTinhWvKl759Od9+O3/uvD/ObA4cSkqIpvlXZekHRdhHBdgW9ceWhSj4Bk6Nu+vrGYnpJ7m4x2kH1uiXZqiXZqm4d4zrmefWpPaFY8aFY8hnNX38mmvquRXFFMVktIVktIVktIWVBNbmtne3dzhH16h397iH98iH98ioJ+aGJaSEM5S0U9YFpSe3ZtiYR7dXBmg392dnNrY2JZeHdukI6EgYF2goF1hX9wiHpkgXJccWFKd2VJe2I9fV85dFg0ZUopY1E2YVAwW0ooWkwtYVY4VEstTEUoT0gsTkgtSUQqSUQqUUo0U009UEs+U05CV1FFU0w/V1BCbGVVsaqbz8vE0czHv7asnYt9im1ig3ZoeHdoop2VsKSXcmRQo5SGeGheZ1lKjX9rs6SOtaaQsaSPqZVsqZVstqJ5xbGIxbGIxrKJxrKJxbGIxbGIno1nXE8vWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWUwskYNp9ebY/u7h/+/i/u7h/u7h/uvc/N/E+9u89N3C7NnB69i/69i/69i/6te+6te+6te+6ta85tGy5tCw6de87N7H7N7I7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcVUklraB/7+C/4syjzbaNnIhlh3VUhnRThnRThnRTnYpk3MiT79uo/enA/enC89i00LOUnH5llHVeiXJdgm9ceWhSfGxQ4tS20MOooJR9nY13m4l4indrindruKOP2sSmfGlOaFY8bltBtaGB8Nq1sZ5/XFBJVktHVktHVktIV0xJZ2NfcW9rcnFtdXJueXVwfXl0j4yGjYiCWVRMTkhBXVhQd3JqeHRshIF5hYJ6Y19Xcm9nn5yUqaadl5aLiIZ8jYV1iG9Kj3FFrotUjW1AbVcya1UvjXRCgGM0WUswYlUycGM8XlEwVUstTkYrTkctTEYuSkQsSUMrTEUwXFNEYVpNVE5CUk1CV1FGTkg7T0k8YFpKamRTnZeM2NLL0ci9r5yMtoyEoX92YVhOVExCZFpNXU88Xk9AW0tBZFRHjH1qsqSOsKSPraKPqZVsqZVssZ10w6+GxbGIxrKJxrKJxrKJxbGIrJpzY1Y1WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrc2ZJ49PD/u7h/u7h/u7h/u7h/u7h/unX/Ny/+9y+9N/G7NrB69i/69i/69i/6te+6te+6te+6ta85tCx5c6t6Na67N3F7N7I7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcTUEcbmI+1cip7t263cWazLWNnIhlh3VUhnRThnRTjXpYxrGC6NOe9+O3/uvD99257tGuvJ+Blnhgj3RehHFdeWhSe2pO49S249a6p5uDn5B6u6iVmIV3loN118Go38enhG9TaFY8hnNX4Mqn69WtkoBgXVBFVktHVktHVUpHVEpGXVlUb25qcXBscXBsc3FteXVwhIB7dnJsd3Nud3JraWVdc3BodnNrfHlxbmpign93m5ePp6ObnZqSmZaNlpOLlo6Al3ZRonlNo3xLYkYeW0goWUcmdF0tjW86X1AqXVErdWtGcWZEW1E4TkUyTkYzTUYxR0IsSkMxTkU2XlVGcGdaX1dLU01CWVJGU0s/UUo9XVdHXlhHcmxdk41+qJ+QqpmJu5GJroV+YlZPT0c+VEk8V0k2VUY2V0c9Y1NGiHlnraCMrKGOrKGOqZVsqZVsrZlwwKyDxbGIxbGIxrKJxrKJxbGItaJ6aFo5WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrYVM0xbaj/e3g/u7h/+/i/u7h/u7h/u7g9t7J+Ne5+93A9OHJ7NrB69i/69i/69i/6te+6te+6te+6da85dCw5M2r59O169vC7N7I7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcUEQfl4tp7eDB5dGq2cCSzLWMnIhlh3VUhnRThnRTp5Jr38mW79qo/enA+eK99Nay5sqnrI9zmHtjm4VvfmxWe2pO4tGy7uDBvbCVpZV92cWrzbim0r2n7NW23cKhootre2hMvamI8ty207+VfmxNY1RDV0tHVUpHVUpHTkZBUE1Ga2llcG9rcXBsc3Ftcm9qaWVgfnp1nJmTko6JgH12d3Rsd3Rsf3x0qaWdk5CIjImBlZKKkIyEj4uCkYt8hHlkfWNAoXhNiGI3YksmVkcnW0kpa1UsooRMbF8xWUwoZ1s8bGJEXFM9T0Y1TUQzTEQySUEwTEM0T0Y3WlFCeG9iZl1RVUxAYVdJa19RZFhLZVxOXFVGXlhHcmxYe3Vihntqq4h+sIeAa1tUT0g+U0k9Vkk4VUY2V0c9Z1hLiX1sn5WCoJaDn5WCqZVsqZVsqpZtvKh/xbGIxbGIxrKJxrKJxbGIt6R8bF08WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrW04vqZqE+urd/u7h/+/i/+/i/u7h/u7h+efZ7dK6+Ne4+uDE9OHK7NrB69i/69i/69i/6te+6te+6te+6Na65NCu5Myq5tCw6trA7N7H7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTUEcX1MvwrWV8ePD3sed172PzLWMnIhlh3VUhnRTloFfzrWJ59Kd9+O3++a/8tWy99u14sejr5F0xKiMtZ+FloFj2cOh2sii5NKsuaV/8d2369ay7tezzLKSz7KP0raOwKmD69Sv79qwt6R7dWNFdmRNYVROVktIUUhDSUQ8TUlCaGZhcXBsc3FtdHJucG1pZ2Rfcm5oeHVvjIiDmpaPhYJ6cW5mdXJqjIiAfXpylpOLn5qSmZCHjIN4gnRcfWtNcFg0mnU8rH1Ea1QoYlUrW0snZFUsfGc3ZFUyW08uYFQ5XVM7XVZBWFE+TUUzTEQyTUQ1S0IyWVBBWlFCaF5QaF5QY1hLa19RZ1tOZFlNcGhdZl9Tb2lZc21bdW9ddnBegHRknYB0dmNbUEg+U0k9Vkk5VUY2WkpAfG9hmZB/nJOCnJOCnJOCqZVsqZVsqZVstqJ5xbGIxbGIxrKJxrKJxbGIv6yDfG1KWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrW04vjXxk7t7P/u7h/u7h/+/i/+/i/u7h/u7h7drK6syx+tm6+uHG9OLM7NrB69i/69i/69i/6te+6te+6te+5ta449Ct48yp5c6t6de77N3G7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcTkIdgnVT5di569u5zbSG1ryNzLWMnIhlh3VUjXpYvqJ83MOT7tmo9+K658uo89Su9Nmy1LaO3L2T1beN2LyU3sSX6M6hyat5yKl45siY89em8dao58qg1biM4cSV5sqczq+C2b6PtKB0hXJSpI1wiXViXlJKTEY/TElBYl5YeXVvdXNsdXNve3h0fnp1bmpkcm5nj4uEko6HjoqChoJ5dHFofntznZmRjYmBf3x0k4yCmId4mIRxl3hVhGhCcFYxjmg0wJNPZE8eb1wvYlItf2s6b104VEguTkUsU0szV1A6XFZCWVM/UEg2VUw7WE8/WVBBX1ZHZ19QamFUZlxSd2xjgnhtd21jXlRKcmticmtjf3pwf3tud3JhdW9ddnBee3FhamBUUEg+U0k9VUk6Vkc3a11RlYt7nJOCnJOCnJOCnJOCqZVsqZVsqZVssZ10w6+GxbGIxrKJxrKJxbGIwa6FgHBNWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrXE4vemhP1cS0/u7h/u7h/+/i/+/i/u7h/u7h++rd3ce17Myv+9u8+uPK9OPM7NrB69i/69i/69i/6te+6te+6te+5NW24tCt48yp5M2r59O269zF7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcVUklraB/8OLEzruVxqt71ryNzLWMnIhliXdVsJZxz7KK4cqa7tmsyqyI376T7M2f5cKP6cGIyqBw37h+0Khv5biE6r121qZd16df0qRdzaFZwJhQ0Ktu7syi4sWe6cqf4sGQr5Rhwal4oIZjrJJvl4ZpcmtccW1mendweXVseXVrfXhyk46Jm5WQd3FsbmpjdnJqaWVcgHtxkYyCi4d+hIB4iIR7gHtygn51lYx8jXFUlG5IlWY0d1ktbVIti2U30KNWkHI4fWU7Zlgze2c6dGJCUkkzSkYxS0cyWVM+Y11IYltHY1pIdGtaZVtMYVdIZVxMf3dnf3htgnpzfnVthXtxenBmZVxTdW9ne3VtamZeYV5XXltSZWBTcmxbdW9dbmhYVk5CU0k9VUk8YFJCin9wnJOCnJOCnJOCnZSDnZSDqZVsqZVsqZVsrZlwwKyDxbGIxbGIxrKJxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrXk8xcmBGsqGN+urd/u7h/+/i/+/i/+/i/u7h/u7h8uHT0rij8tCy+9y++ubP9OPN7NrB69i/69i/69i/6te+6te+6de949W14tCt48yp5Myq5tKz6trB7N7I7N7I7d/J7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcTUEcbmI+1cip39CxtJ92yK181ryNzLWMnIhlootox6iB0LSKzbB7wJtn37yA1qxpxJVN67x1x5dSyJZSoG0ltYA1zJdJtn8ywoo9voY5xo9Ctn8xqXUq0KVh27V4t5BYzKhp3Lp9wJ1p2rh9x6x6tZ92o5RxjYZ1f3pwfHdtioZ8fndxhX55nJWRenRvZWBaeXRsko2DioV7hYB3enVsYVxTXFZNc21knZeMjXtge1s3gV4xkWQugl8wZE4oi2g21apcqYZLalUsXFAtWE0vZFc6U003TUg0T0o1WFI9YFlEdGxYgXdkcGVUaV1PdWpbbmVVgHhlhH1wiIB5hn13hXtye3JoaWJacWtkY15YTUpES0hCS0hCTktEWFRLaGNVcmxbZV5OVUs/V00/fHFgmpGAnJOCnJOCnZSDnZSDnZSDrJZuqZVsqZVsqpZtvKh/xbGIxbGIxrKJxbGIxbGInItlXE4uWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrYVI1cl9GkoBq7t7P/u7h/u7h/+/i/+/i/+/i/u7h/e3g4s/A0rWc99W2+97A+ufQ9OPN7NrB69i/69i/69i/6te+6te+6Ne74tWz4tCt48yp5Myp5c+v6de87N7H7N7I7N7I7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcUEQgl4tp6dy+u6uKtZ5wyq991ryNzbWMr5RtvZtu0a14w5tq3LFw3bBsw5FI0pxNzZhKr3ktpnApq3Yvpm8ko20isXovxY1Dv4g9sHguxI1ApHInmW0ntopIp3k1tIdCqX455rmAzqNcyqFbqoRLmIdYqJp6l453iIJ3lJGGfnhxcWlkgXp2e3VwfXdyYFtSX1pQXFdNbGdfeXRqdWxcamJVcmpckoNqqYdbe1UtelUpjV8rnXZFU0Uii207wJVKw59icVwuWk8sYlg5ZFtAY15HV1E7WVI9XlZCZVtIhnxoc2lWdmlZk4d3kod3gHVngXhmhH1thn92iYF7iH53gHdub2hhZF9ZTktFS0hCS0hCS0hCS0hCS0hCT0xFXVlOaGNUXVRHYFZJkId3nJOCnJOCnZSDnZSDnZSDnZSDsJlyqZVsqZVsqZVstqJ5xbGIxbGIxrKJxbGIxbGIno1nXE8vWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrYlI1cl9FfmtT1cS0/u7h/u7h/+/i/+/i/+/i/u7h/u7h+enczLam27ug+ti4+9/D+unT9OPN7NrB69i/69i/6te+6te+6te+5te64dWy4tCt48yp5Myp5M6s6Na67N3F7N7I7N7I7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqTUEcX1MuwbOS28ytpJJtwKl4ya57w6NxwZpoxJ1l6sKB6Lp8zZtU5LNttoM5rXQvqnMyl2cqiVwmpnUwt38vrHcssnwzt4E3omwjoGogr3oyh1YcdUsYgFcjlWgro3IzuIlBsIE8wZJNvo1MypxSn4BHkHpKmIlekYhzjIh+h4J6bGVffnhyoJyVjYqCZmFYdG9lhYB2gn10hn9vlH9WlH1SkXlPqpBbpIRLh2Izdk4konM1wJdXX0wpfGEzxptSq4ZPgm1DZl48XVY5XVc+bWhQZF5HXFU/b2ZSiX9sg3lmc2xYhoBtiIB1nJKEmY1+gndohHtrhX1ziYF7ioJ7gnpyb2liWVVOS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCUU1FWFJHb2ZYmZB/nJOCnZSDnZSDnZSDnZSDnZSDs5t1qpVtqZVsqZVssZ10w6+GxbGIxrKJxrKJxbGIrJpzY1Y1WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrZlY6cl9GdWJJsqGN+urd/u7h/u7h/+/i/+/i/+/i/u7h/u7h797QuqGP5sao+9q6++HG+unU9OPN7NrB69i/69i/6te+6te+6te+5Na34NSy4tCt48yp5Myp5Myq59O169vC7N7I7N7I7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqT0Meg3RP49GwuKiHtKBzuJxkx59frYRB0qhb6b1s5LVm0qJUuok7r34xqHcxnW42flcnb08hjGQmwYw9u4c9n2siq3cvyJRLuIQ7qHYzfVEXbkcVakYXgVgejV4goXEwq3s6mGgrk2Qms4Y6qoE4g2Aug2w8kYFgi4N3jId8dXBjaWRZdnRpb25jcW9khH90g390fntsiH5ml35Rp4hPmnQ+n3NCiGMygV4sgFoponc2spBTbFs3eGQ5rohKknJFaFg1YFc4V1I3WFM7bWhPZ19IZl1Hh35oeW5ac2hWbWdVhYFulpGCj4h8nJKEmY1+g3lqg3twiIB5iYF7enRtaWNcUExGS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCTkpEeXJlm5KBnJOCnZSDnZSDnZSDnZSDnZSDtZp2rZdvqZVsqZVsrZlwwKyDxbGIxbGIxrKJxbGItaJ6aFo5WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWUssaVg8cl9Gc2BHkoBp7t3O/u7h/u7h/u7h/+/i/+/i/+/i/u7h/e3g28m7tpuF8M+w+9u8++TL+urV9OPN7NrB69i/69i/6te+6te+6de94ta24NSx38yo4suo48uo5Myp5dCw6di+7N7H7N7I7d/J7d/J8uLL9OLI8NvA7Ne56NSz5tWu4NGpuqiJgXBTWkwqYFIsybGJ0b+bsppsvpdUyZpJvIw93rBa7L1n0qJQxJVDuok6tYQ3roI8hl8vYkMaZU4hgF4puotDxZFIrHYuy5ZOt4M8pnMtkGAifFEXakQUbEcWh14khFYcm2wxjl4kd0cVlmkpl2gon24tp301imgvhm1AkoBkkIh1mZJ8lIZyhHpqcGpbd2xaiH1qeHVmf3xono1olXhIhWgxp4BElmkxl2ownHk5f2EvnHpAj3NEW1QwaFw+nYJSeWM8WlE0XVc9ZF9FbmpNamNJZl1GjoRuhnxkdWlUjoNxq6SVl5GBjop3l5KDj4h8nJKEmI1+gXhrhn51iIB6eXJsX1pUTElDS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCbGZcmpGAnJOCnZSDnZSDnZSDnZSDnZSDs5Z2sJlyqZVsqZVsqpZtvKh/xbGIxbGIxrKJxbGIt6R8bF08WEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrWUwsaVg9cl9Gc2BHgW1T07+o++rc/u7h/u7h/u7h/+/i/+/i/u7h/u7h+encwKycwqWM9tW1+9u9+uTM+erW9OPN7NrB69i/69i/6te+6te+6Ne74da03NCs28ei4sqn48uo5Myp5M2s5tW669zF7N7I7d/J7d/J8uLL9OLI8NvA7Ne56NSy5tWu4NGpuqiJgXBTZVYyxKd6r45fqn441qhV6rxn2KlYxpZGzp9Pw5VGxJdGvZBDroI9n3ZAflwyak4gc1IjlWo4pHA3sHw4wo5Js345pHAumm0zhVcmb0IWakESeVMYgFUihFUji1wojmErf1IckWUoi10goHEnoXAsrYE6nHg3mX1MmINjspt4polnpYppiXVahm9RmYFbg3BNjnpUqYpWeVkrblEmpntEu4hGu45Gw5tRgWQya08gqYxRUUwmVU42dWFEaVo/ZlxDYVpCaGFIcmtRcGhPioFomY52k4dvjYFqr6GRt6ydta6gqqSUmpWEmpWGkIh8nJKEmY+AiH90iIB6dW9oVFBKS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCZmFXmI9/nJOCnZSDnZSDnZSDnZSDnZSDspN2s5p1qpVtqZVsqZVstqJ5xbGIxbGIxrKJxbGIv6yDfG1KWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrW00ublxBcl9Gc2BHd2RKsZl56NO9++vd/u7h/u7h/+/i/+/i/+/i/u7h/u7h7t3PqJGA1bWa+ti4+ty+9+XO+erW9OPN7NrB69i/69i/6te+6te+5te64NWy18qk2MSe4sqn48uo48yp48yr4tCz49S8693H7N7I7d/J8uLL9OLI8NvA7Ne56NWy5tWu39CoqZZ2oYhenHpKnXA2uYg3z59OuYk7uIhGt4g9tIVAs4Y+pXoziV4hg1ophl80fVYygVsuq3s+tIA/2qlp4rR17sKCzaFjvY5Rm2wvlGYudEoWglkji2QniV4nhFcmhFcofVIgjGEoi2ApjGAjlGUllGIhi1cYqHownXY7qoRSo31Jk207pXxMvpttm3lOfV4wfV8wfGApdlIheVgxdlcsp3s+zJtPtoxBu5JHooFDZE8llHE8fGtAW1Q6W044YFM6Ylc+aGBHZFxEZl1Eg3phn5R8l4tzk4dwqZ2Gt6uWva+evLChubGjtK2eqaOTnpmKkIh9nJOEoJaIi4N7bWhhTkpES0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCWVVNkol6nJOCnZSDnZSDnZSDnZSDnZSDsJB2tJl2rZdvqZVsqZVssZ10w6+GxbGIxrKJxbGIwa6FgHBNWEsrWEsrWEsrWEsrWEsrWEsrWEsrWEsrXE4vblxCcl9Gc2BHdmJJp41r0beW7dnF/e3f/u7h/u7h/+/i/+/i/+/i/u7h/e3g2MW4noRx5cSm+9m5+Ny/9uXQ+erW9OPN7NrB69i/69i/6te+6te+5Na33tSw0sSd1MCY4Mml48uo48up4Mqo0b+h0sOq6NrD7N7I7d/J8uLL9OLI8Nu/7di46NSw5NKqrZVpj208hGAst4Q+yJJCt4U8p3g0pHU7xplTtIZHqX0+hVsic0wedU8lg14wrIRNwJha3rVw78eI88+S5r6C5LqC7sWRw5pmyplVonU1nnU4jWQqong8qH8/j2cogVgejGIpiF8imnEumGsvjF0ikWIfglATn2wolmYunHE4l3Q7iWo2imQ1kG49lnY9gWAvcVMhZU0Qh2Avjmc9jGo9wZdUyp1MpH07rIlBu5xVXlIplnNEf2xCW1Q4XlU+WlI1XFQ4b2dOaGBFf3VbrKKInJB2lIhwjIBtqqKOtKuUu7Cav7GfvrCiu7GjuLGjsKqaopyPkIh9m5KElo2DZF9ZS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCVVJKjoZ3nJOCnZSDnZSDnZSDnZSDnZSDsI92s5Z2sJlyqZVsqZVsrZlwwKyDxbGIxbGIxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsrWEsrWEsrWEsrXk8xcF1Dcl9Gc2BHdGFImYFhxaiC2MCj8uDO/e3g/u7h/u7h/+/i/+/i/u7h/u7h+enbuqWXp4t1786v+9q69dzC9eXR+erW9OPN7NrB69i/69i/6te+6de94ta23NGty7yTzbqR3cej48uo48uo38imybaXxLOW5NS67d7H7d/J8uLL9OLI79q869Sw4MKZpIZcgWAzj2kz3apew4xHnGwvkWcsonc5r4REpnw7mnE3hlwsgVgrkWo5rYlNwJtb4r5/1rNy6cWL5sGA0KZn4LN947WHzaFrq4NIo3xBtYxSsoVLwpZbw5hUw5lOt4tFtIdBvI1KnGssqno6l2omjGAbgVMTkWEojVwtiVokhl8ih2UsjWoyhWIom3s7mHA+hWQxj2oqp3w6i2g5cVczo39CtI1DgV40k3NAn4E+h3E+a1k4bmJFXlU5XFQ6W1Y0bmdGc2pPe3JWnpV5mo90mo5zlYlyqJyNpZuOopmKraOQua6ZvrGev7GhvbKjurKkta6fqKGVkYl+kol9ZWBZS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCT0xFgXptnJOCnJOCnZSDnZSDnZSDnZSDsI92spN2s5p1qpVtqZVsqpZtvKh/xbGIxbGIxbGIxbGInItlXE4uWEsrWEsrWEsrWEsrWEsrWEsrWEsrYVI1cV9Fcl9Gc2BHc2BHknlbw6R9yq6J3siu8+HP/e3g/u7h/u7h/+/i/+/i/u7h/u7h7dzPnYZ2vJ6F9tS1+tq68tzE8+XR+erW9OPN7NrB69i/6ti+6te+6Ne74dW02M2nxreNybiQ2sWi4sqo48uo38imw7CQtqSF2smr7t7E7uDI8uLK6ta62r6SxJtcoHtEclIljWYw26pdmmgtj2QtgVsluI5QqH4/oHU2lWkwoHNBqHtDuY9I2rJw17Fz2rd44b6CyqVivplYw5hUtIZIrn9JoHRBsYlKwpZZ27F288yU6sCF2Kxr06hi3LBq37Fr4rFvzZxbyZlZm20plWchoHMvpngzmWktq3Y6n28rlWsuoXgzlWsjnHI5nW03pnpAw5ZG2qtddFgmblgwqoZLvZVQg2UxhGc6lnxIl3lKZ1hEW1A9U0s2WFA5b2tJe3VSkIdsrKKGnpJ2mY5xnpN2sKSMw7intKqbrqWYp52QqZ+PtauWvLCcv7GgvrGiu7KkuLGjqqOXjoZ8Z2FYS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCTUpEe3VonJOCnJOCnZSDnZSDnZSDnZSDsI92sJB2tJl2rZdvqZVsqZVstqJ5xbGIxbGIxbGIxbGIno1nXE8vWEsrWEsrWEsrWEsrWEsrWEsrWEsrYlI1cV9Fcl9Gc2BHc2BHi3NWwaB6xqiAyrCO38qz8+HQ/e3g/u7h/u7h/+/i/+/i/u7h/e3g1sS2jHNi07OY+ti4+dq78d3G8+XS+erW9OPN7NrB69i/6te+6te+5te64NWy08egw7OIyLeP1sOh38mn48uo3simv62Nqph41cKg8N6+797C0LiTpoJJpXw1kWsvck4gfVUjlWUslWUvi18ss4hVoHY5mWwvpno7uYxNrHw/v5FOzKBS5Lp14bl8yqZh886RyZ9bxp1bvI9Fn3EsnW8zp3s+tIxGs4xFyqRl0qdizZ9cwpRZuItU5bx+4blz6sJ85Lp7zqFmpnc4pXctqnwutoo0mWkq2KVcrXg0nm4xlGgmuYc+mW8yonY1q3pAwpBA57VijW05gmY1tY9Pimo0u5ZZkHhBb100als8Z1tDVUs7T0czX1o+h4Jgi4RjsaiNr6WInZJ1oZV4pJh/xLemy8Cwy8Cvw7mqtq2frqWYq6KTsqiVurCavrGevrGhvLKjubGjq6SXeXRrTUpES0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCbGZcmpGAnJOCnZSDnZSDnZSDnZSDsI92sI92s5Z2sJlyqZVsqZVssZ10w6+GxbGIxrKJxbGIrJpzY1Y1WEsrWEsrWEsrWEsrWEsrWEsrWEsrZlY6cl9Gcl9Gc2BHc2BHf2pPu5l2xqd/xqmCy7OV4c228+LQ/e3g/u7h/u7h/+/i/u7h/u7h+enbtqKUj3Rh5MSm+9m599q97t3I8+XS+erW9OPN7NrB69i/6te+6te+5Na33tSwzsGYwbGFx7aP1MGg3Mem4sqo3simv6yMppR0z7qW4syemoJPfF8qgF4oc04deFEihFsmil4ipnY7wZFWqnw+l2oqqn07uo5Ju45GzJ1U261i3rFk0KJczKFewpZJuYxEw5xa3LBovow/soQ/o3U0mW4poncvyqBW4b58zaJZzJxXvYxQuYpO1qto3bdw5b1/9s6S5Lp3uIlIsoM4sYMvwpU/p3Y00p5YmWMjmWoxkWgqwY5GlG4ulG0usH4+zZxL2aRYm3U/e10urYlPgmY6m3lEqItQcWI9X1Y+XldBVU88XVc/fnpag35cnJR0urCUppp+mY1wlIhvr6KT0MO3zsG0zMCwy8CwyL2tvLOksqmcsKaZs6qZua+avbGcvrGgvbKjubGjnpiMV1RNS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCZmFXmI9/nJOCnZSDnZSDnZSDnZSDsI92sI92spN2s5p1qpVtqZVsrZlwwKyDxbGIxbGIxbGItaJ6aFo5WEsrWEsrWEsrWEsrWEsrWEsrWUssaVg8cl9Gcl9Gc2BHc2BHeWVKro5syKR+xqeAxKmEz7id48+58+LQ/e3g/u7h/u7h/+/i/u7h/u7h7dzPloBxoYRu786v+9m69tq+7N3J8uXS+erW9OPN7NrB69i/6te+6de94ta23NGtybuRwLCEx7aP0b+f2MSk38mn3semv6yMqJNxjXM+a1EkZUwkZkktb0wmgFsokGgqqn41todBvY5JwpVNvZBG0qRWvpE+v5JBzJ1Qx5lJ2alcuohBtII3zZ1JzqFT16xc37JjyJhMvI1Hil0epXo1v5NK0KZc9tKQ4LZtzp9SwZFL06Rd2a1j4Ld1xJxe0qtr16xsrH48qnozyJpCsIIytoZBtoNFkF0doXEwkGYpyJVOg2Aij2gsu41Bx5dCvIhHlXA3d10wg2Q3mn1KfGQ7tY9QdmdAX1dAXVdBWFI9ZmFHbmlJgHlarKOEsKOGqZuAmYtxnpKCwbat0MO7z8G3zsCzzMCxy8Cvyr+uwreotq2fsaibsqmatq2au7CbvrGevbGisqqcbGdfS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCWVVNkol6nJOCnZSDnZSDnZSDnZSDsI92sI92sJB2tJl2rZdvqZVsqpZtvKh/xbGIxbGIxbGIt6R8bF08WEsrWEsrWEsrWEsrWEsrWEsrWUwsaVg9cl9Gc2BHc2BHc2BGdWFFmX5cxqF8x6Z/xaiAwaiG076l5NG68+LQ/e3g/u7h/u7h/+/i/u7h/e3g1sS2gWlZu5yD9tS1+9q689rA693K8uXS+erW9OPN7NrB69i/6te+6Ne74dW02M2nxLWKv66DwK6Lx7WX0r+g2sWk18CelHVMak0mY0kjXUUja08wflgzlmw1sIJBzJ9X0aJZ0aBXxpZL16hX0qJLzJ9EzZ9Mvo0/wJM+2qpazpxP3KlZx5VDvo0/yZdJ5rVryJdQpXk0flEamm0rzJ9V1qti3rl11rZ30aRYz6BT0qRR0KRQuo9N5Lt71qxm3bNss4dCrIA1uo0+nGsrv45Nyp1dlWYksH5BrIBEyZ5ZfF0ilG8xsoU3wJA/mXA8t5dRs5xfdWU2ZVExcGlGiXE+gXFNY1tDXFY+X1lBa2RKfnZYoJZ3raCCinxgoZN4motyqJ2Ou7CmzcG6z8K7zcC3zsC1zcCyy8Cwyr+uxrurvLKjs6qdsaibs6qauK6avLCcvK+ei4R4UExGS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCVVJKjoZ3nJOCnZSDnZSDnZSDnZSDsI92sI92sI92s5Z2sJlyqZVsqZVstqJ5xbGIxbGIxbGIv6yDfG1KWEsrWEsrWEsrWEsrWEsrWEsrW00ublxBcl9Gc2BHc2BHc2BGc2BDh3BNvpt4yaR+xqd/xKeBv6eJ2cSs5dK78+PQ/e3g/u7h/u7h/u7h/u7h+enbtaGTfWNS07OX+ti4+tm679e+6dvI8uXS+erW9OPN7NrB69i/6te+5te54NWy0MKdvq2DvKyBtKOBt6WJwa6Qp45rdVgxYEUfY0kkaVAsdlg2n3ZPzaBn16dkzp9Z2KlcyppK0J9N5bRg3qpZu4o8u45Auoo9tYY1zZtJ0Z5Lw5A/xJFA0qFQrnw2w5JFt4Y+kGQmflUcpng21KVY57py68WB48OG1add16lbzJxNvo9BvpNLyaBb4rdvz6VWupJDvZFIqH00kGIjsYFDuY1Ohlodp3Yym28srIFAeFkolXE7qXw3p30um3xDmoJLgG9DWU4tVEkwV1M1VkosV043T0s1Uk02aWJJcWlOsaeKuq+SsqSIoJJ2o5V5uKiQx7yrzcG00MW708jA0cW+z8O6zsG2zsC0zMCxy7+vyb6twrioua+hsqmcsqiatauauq+bqp+OXllRS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCT0xFgXptnJOCnJOCnZSDnZSDnZSDr491sI92sI92spN2s5p1qpVtqZVssZ10w6+GxbGIxbGIwa6FgHBNWEsrWEsrWEsrWEsrWEsrWEsrXE4vblxCcl9Gc2BHcl9Hc2BGc2BDf2pHt5l2yaJ+x6Z/xaiAwaaCwaqP3cix5dO78+PQ/e3g/u7h/u7h/u7h/u7h7dzPk3xuiW1a5MOm+9m599e46NK56NvI8uXS+erW9OPN7NrB69i/6te95Na33NGuw7KNuqh+sJ90o5Bvoo5zdVw5ZE0pYUcic1Uxjm5FwJxm1Kptu5BLyJlOwo9GyptFzJ1N2KZT26ZTy5hJpXkwr4M7vo88sH40x5ZFvIs1yZdFvIo5r3w3xZNHr34voG8mhlogkWcrr4A9wpFEvo9I4Ld189GU0KVb1KZa1aZbuIo/pHovqoA+06hcyJ9Q4bturYA+t41LkGMop3k9kGYsf1YcsoU6pHcvn3Y3e1srf2AxoXxCqYtGmYNLhHFFX1M4UEg1TEIzVE85VEw0UEs2TUkzXVhAd3BXnZR6nJB1sqWKloZsqZuAsqaMtqmUu66byL2r0MS108i708i/0sfA0ca+0MO6z8G2zcCyy8Cwyr+uyL2sv7WmtqyesaibsqmasqiWe3VoTUpDS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCTUpEe3VonJOCnJOCnZSDnZSDnZSDr491r491sI92sJB2tJl2rZdvqZVsrZlwwKyDxbGIxbGIw6+Gi3pWWUwsWEsrWEsrWEsrWEsrWEsrXk8xcF1Dcl9Gc2BHcl9Hc19Gc2BDeGRBrZNxx6SByqN+xqd/xaiBvKOBx7KZ4My05dS78+PQ/e3g/u7h/u7h/u7h/e3g1sS2emNTn4Ns786v+9m58tO048+26NvI8uXS+erW8uLL6NW86te+6Ne84dSyzsGeqpVxqZdrkX5SjXhYcFc4bFQxfWE7tpBi7cCG16Zis4Y/u5FCxJhM2qle1KVcwJFOw5JGy5pUoHc1lXEzlWowu4pEpHEtq3otsYEtsoIvxZVEpnQvnmwjqHghqHYulGcplGounm8srHkszZ1TyqBd4r584rx11qxkzaJZvZBHsYc9kGMpw5lOyZ5Y3LR1vZJRjmUqh1shnnM5d1Mifl0sn3c7m3AykWw5cVUwaFIrhG0+iHZJbWBBaFpCemtVbGJQXFRFbGRSbWdTV1M+Y19IfHddg3xjt6yTvrGYpph/oJB3koNrrKOQs62atKuXuq6axbqnzMGw0MS20se70se/0sfA0sa+0MO5zsG0zMCxy8Cvyr+uxburvLKjs6qdsaiam5OHWVVOS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCbGZcmpGAnJOCnZSDnZSDnZSDro90r491sI92sI92s5Z2sJlyqZVsqpZtvKh/xbGIxbGIxbGInItlXE4uWEsrWEsrWEsrWEsrWEsrYVI1cV9Fcl9Gc2BHcl9Hcl9Gcl9DdWE+nIVkyqqJyqJ+yKV+xqiAw6eBtp+A0Luj4c615dS78+PQ/e3g/u7h/u7h/u7h+enbtKCScllIupyD9tS1+ti46s2v4M2059vI8uXS9eXR2seu3cqu6da85NKz2cqmn4toim5Ec1oya1MzcFY6eFs2qIVQ3rBxy5lQrXwuxpdHwZdDlG8olXI2uJZXkGwwqolEiGczZEckjGo3lmwyr304m2kksoE1vIw4pXUjwJA+vIw5vY04vIw3o28pmmsuiV0ilGQjtYIzsoMy37Ro2rZw58aD6MWC0KplyqBaroM8n3M0roM/3rRrtpBSzqRci2Qti2IpkWcvelYoeF41g2g5l3hCmH1Lg29FZFMwZ1g1X1Y+UUw5T0g3aV9Kh31qfHRjgHhmgnpndW5acm1VcWpRmY92wrWcv7KYmIpwoZF6vLCdxryvv7epr6qZsKeUtquXv7Shyb6szcKxz8S20ca70se/0sfA0cW9z8K3zcCzy8Cwyr+vyb6twrioua+hraSYd3JpTUpES0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCZmFXmI9/nJOCnZSDnZSDnZSDq49yr491r491sI92spN2s5p1qpVtqZVstqJ5xbGIxbGIxbGIno1nXE8vWEsrWEsrWEsrWEsrWEsrYlI1cV9Fcl9Gc2BHcl9Hcl9GcV5DdGE9jnlXy6+PyKSBy6J9xqd/xaiAv6WBtZ6D18Kr4s+25dS68+PQ/e3g/u7h/u7h/u7h7dzPkXttd11L07OX+ti489Sz38am4M2059vI8uTS5dW+uqWF0Lya4s6w0LqQjHBIdVQ2Zk0xaVMygGc+wZ9lwJVEs4c/oXY3s4xNpX5AkWwyiGkyhWk8m4FOlHlFd1wqel4welwwlG4yrIA5v5E7t4Y4uok5qnoop3cls4MxvY46w5Q/uog1mWMfj18fgVYbkWYkmWkmnW4psYU4yaBX8cuI6sOB0KhlzKNeu49LpHg3kmYmrYFBsIVLx5xVp39Ci2MujWQwjWcyel02b1k2iW9EkYFbhntafHJUaGBIV1NCVVA/U005VU04bmdTdnFdenNgcWhUaWFMcWlRgHRdtquRv7KZpph9moxws6mQwbusycC1y8C2wLersaucrqeVs6mVuq+bxbqny8CvzcKyz8S30ca90sfA0se/0cS7zsG1zMCxy8Cvyr+uyL2sv7WloZmNX1tUS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCWVVNkol6nJOCnZSDnZSDnZSDqpJvro90r491sI92sJB2tJl2rZdvqZVssZ10w6+GxbGIxbGIrJpzY1Y1WEsrWEsrWEsrWEsrWEsrZlY6cl9Gcl9Gcl9Hcl9HcV5GcF1DdGA9gGtIxKuNzKyLyqF+yaR+xqeAxaiBuKB+uqSL3Miw4s+25dS68+PQ/e3g/u7h/u7h/e3g1sS2d19Qh2xY5MOm+di35cun28Oj4M2059rI8OLPzbuhpY9pv6t4m4NNZEsmZ04wa1M1k35PvKVmsItGr4A6sotGdFMrYUwnYEonYEonZU4qZk0ucFg5gmpBc1greVstmXY+p4A4tok8u40+yppKvIw7r34tpnUktoY0s4Mxuoo4uYc2s30ziFYZe08biF4hhVsYj2IhpXg0vI9GyZ1X78N/5Ll206hmyp5dq38/il0ennEztoZOx5dWn3c1iGMukWs4mnVJeVw4YU8ycWFEgXhdfHRbe3NcbGVSWlRDV1A+VUw7W1ZDcm5adHBbY11HXVM9Z1xEkIRrlIdusqWNp5qCjoFnqJuCvrmmxMCxxsG1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKz0MW50se+0sfA0sa+0MO5zcGzy8Cwy7+vyr+uw7mpjYZ7UE1GS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCVVJKjoZ3nJOCnZSDnZSDnZSDq5duq5Byr491r491sI92s5Z2sJlyqZVsrZlwwKyDxbGIxbGItaJ6aFo5WEsrWEsrWEsrWEsrWUssaVg8cl9Gcl9Gcl9Hcl9HcF1Gb1xDdGA9eGRBsZp71beYyKSBy6J9x6Z/xaiAw6iCsZl7xK6W4Mu04tC25dW68+PQ/e3g/u7h/u7h+ejbs5+Qa1JCn4Js786v8tOw2sOe28Ok3sux5djD6NrFn4lpt55mbVctWEkqcVw+oodju6Ftpo5Vq4tZknVIlHpKfGY/WEcqWUgtWUguWkYqWEEnW0MrZU0ua1Erdlctk2w5l2wuqn40uIs1uok3toc1uYk3uIg3xpZFpXQjwpJAv4w7vIY0k2AgdkkaflQfmHAmjGIZhlkbpHcuvpBM2a1p27Bu4bd2zaNks4hHpXg4o3c4rYFGtIlLr4c7j2stiGQ2flwydFMxX000W1A8Z15KbGRSaWBQZFxNXFVEVU08VlA/W1hFa2lUbmlUWlM8d21UppuDppqBoZV8npF6j4FrlIdywbWmzMO2xsKzw8CyxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzcKxzsO10ca70se/0sfA0cW8z8K2zMCxy8Cvyr+uua+fa2ZdTEhCS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCT0xFgXptnJOCnJOCnZSDnZSDsJ5xqpNvro90r491sI92spN2s5p1qpVtqpZtvKh/xbGIxbGIt6R8bF08WEsrWEsrWEsrWEsrWUwsaVg9cl9Gc2BHcl9Hcl9Hb1xGblxEdGA9dmI+n4pp2b6gy6qJyqF+yaR+xqd/xaiBvqWBrJZ6zrmi4c214tG25dW68+PQ/e3g/u7h/u7h7dzNm4Vzb1ZFupyD9NOz48qj2MGc2cGh0b6d0L+lkHpYfGU+XEgpXEkuf2hIrJFnoYVQjHRFb102ZE00Zk81kXtUgW9IaFg4X082XUw0X0ouZVAxaFIwZ08scVcqgF0qg1whqHw2tYY2vIw6v488u4s5p3cluIg2qnopxpVEu4k4tX4yjVsZfFAae1EfjmUglmsli14hhVcgnHAyvpNM1ats06tr17BuyKBerYRBqH8+pHw/rIREuZRRkXAvj3A/bU8rY0goWUkyU0o7V09BXFRGWVJEWlNEW1VEWlRDWFRDV1RCWFQ/X1lBdW1VjoVrn5V7k4lxmpB6f3RffXNeqqGOw7er0ce80cm9yMS2w8Cyw8CyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKyz8S30ca90sfA0se/0MS6zsG0y8Cwyb6toJiKVVJLS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCTUpEe3VonJOCnJOCnZSDnZSDtaJ1rJhvq5Byr491sI91sJB2tJl2rZdvqZVstqJ5xbGIxbGIv6yDfG1KWEsrWEsrWEsrWEsrW00ublxBcl9Gc2BHcl9Hcl9HbltGbVtFdGA+dWE9jXhX0bmb1baXx6OBy6F9x6Z/xqiAxamCtp59rZh+18Kr4s624tG15dW68+PQ/e3g/u7h/u3g5dPAlX5temBO0rOX79Gu2MKX176ZuqF6iHFNbFc7ZlE1ZFAzdV48rJNqiHFBk3tMcls0YlEzaVM7hm9XqpNopYxfeWdBeGlKcGBGalY5cV43dWA7Z1QzXUskfmM1flwhmG4opnYsn2wovItA0aFOsYEwuIg4vY08wZE/t4QzvYc7pHMwgVYdeE4ch14ihl0XmGwphVcZlGgmm28svJJQ2bBw3bV01Kxqpnw6sIlGpH1AmW41oH9Hn4FNgF82dFQwXEUjU0MqTUM1TUU4U0s+U0w/XFZEcGtQbGhOWlZDVVE/XFhDcWtUhH1loJd8k4lwl414iIBrgXdinJN/sqmXurCgyb6y08m+1MvAzMa5xMGywsCxxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzcKxzcKz0MW50se+0sfA0sa+z8O4zMCywbenfHZsTUpES0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCbGZcmpGAnJOCnZSDnZSDtqR2sJ5yqpNvro90r491sI92s5Z2sJlyqZVssZ10w6+GxbGIwa6FgHBNWEsrWEsrWEsrWEsrXE4vblxCcl9Gcl9Hcl9HcV5HbVpHb11JdmNCdWE9gWxKwKmL3sGkyqmIyqF+yaN+xqd/xaiAw6iDrZZ3tqGI3Miw4s604tG05dW68+PQ/e3g/u7h++vb3cm1lHxsi29c3b2d2b6StJlqeV4+UT8nXEoyb1g/e2NFjXNJn4VVg3FDd2U+a1Y0fWxWf2xTi3ZcrZhvs5ltoY9mj39bdmVMcl9EdmM4fmxIZVdBZVY0fGQ3jG00pn07p3gymmosqXUsrHwrw5JDvo0/r38wtoU6oXAmxZJDn3Atf1MagVggflQhglkaj2UflGcdnnMqmW4rsIdAyqJe7seE1a5rsYpHupNPqIFDhWArhGUzjnFHfV44d1k2ZU4yVkYwUEMzTEI1UUk8XFZEcm1Re3dWeHRVYl5IVlE/WVRBd3Bbo5uEoph/joRthn1pj4dyo5uGtrCdw7ypy8Oxz8W10MW41Mm+1czBz8i8xsK0wsCxw8CyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKxzsO10ca70se/0sfA0cW8zcG1r6WYXlpSS0hCS0hCS0hCS0hCS0hCS0hCS0hCS0hCZmFXmI9/nJOCnZSDnZSDtqR2taJ1rJhvq5Byr491sI92spN2s5p1qpVtrZlwwKyDxbGIw6+Gi3pWWUwsWEsrWEsrWEsrXk8xcF1Dcl9Gcl9Hcl9HcF1HbFpHcF9LeGZFdWE9fGhEr5l64Map0rKUx6OBy6F9x6V/xqeAxamCvqWBppB0wq2V4Muz4s6x4tGy5dW69OLN/ezd/u7g9uXQ18OtkXlos5Vwro1deF48WkQtV0YwZlM6hGpEln1Qf2U1gWpAe2hDe2lInoxsg3Bef29Ui3peh3ZYg3NXgXBTgHBRemlRlYRmeWdHaVpDX1dGbl9BinI+d1kpk2Ysr4A+lG0uvYtAv5FFv45BwJBDuIU3pHYximQxvJFDl2soeVATh2AkeFAddEwaflMcjl4flWgimG0nnXMttYxI4Lh23bZ0s45Lm3U0solIhmEuelsxhmxDclg2b1g6bFhAWUo5UkU4U0c9WFBBcm1RfXlXfnpYfnpaaGJMV1FBY15LfndkjIRvhXtlgHVhiH9roZqFqKOOsKuXurWixL2qzsWz0si30se51Mq/1s3C0sq+yMS2wsCxwsCxxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzMGxzcKyz8S30ca90sfA0sa/y8C2koqAUU5IS0hCS0hCS0hCS0hCS0hCS0hCS0hCWVVNkol6nJOCnZSDnZSDtqR2tqR2sJ5yqpNvro90r491sJB2tJl2rZdvqpZtvKh/xbGIxbGInItlXE4uWEsrWEsrWEsrYVI1cV9Fcl9Gcl9Hcl9Hb1xHbFpHcV9MeWhIdWI+d2M/nolp17+h3L+hyaiHyqF+yqJ+xqZ/xaiAxKmCtp18pY91zrmh4cy04c2u4dCy5tO28t3B+ujW+unX5dO2vqiNn4FccVc3cGFBXE01VkcyaVU7o4pTnoZRe2U+W0gwdF5Anohkj35mfm5YnI5jnI9jpphvnI1oloRhhndVcGBIg3VZcmVKWVNEVFJGbVxAiHE7e14usX4+u41OgmMyw5lTrIQ2n28ksX81o3YqmHE8a0wfoHgxnnYuh2EhcVAack4beFAce1AYhFIXilweil0gkGQkqH8/xZpa4rh1wp1coX08roZFl3JCh2pCinFJgWdJalQ/Y1BBVkg+VUg/V0xBWlJDcm1RgHxahYFghYBhcWpVb2lYhH5sbmdVbmVUd2xacmdWh39tlY58o52KqqWRsayYurWixL2qzsWz0sm30si51Mu+1s3C1MzAy8a5xMGywsCxw8CyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKxzcKz0MW50se+0sfAw7mxdnBqTElDS0hCS0hCS0hCS0hCS0hCS0hCVVJKjoZ3nJOCnZSDnZSDtaN2tqR2taJ1rJhvq5Byr491sI92s5Z2sJlyqZVstqJ5xbGIxbGIoI5oXVAvWEsrWEsrWEsrYlI1cV9Fcl9Gcl9Hcl9HbltHbFpHcV9OeWhNdmM/dWE9kHtax7GT5cqs0LCRx6OBy6F9yKR/xqd/xKh/wqiCq5R2qZR71cCo4Mqx38qp4dCx5s+v7NSy6NO1v6p+g2tJY0w4Z1Q4aVo7aF0/aFw9mn1So4ZSeWA3XUkyW0k2inZbkH5jaFhJZFRDempRYE87c2FOiHZakYBdinlZaFdBcmVNbGNJVFBCTko9WUsye2Q7j283vo1EtY1Sj248sIhGsY9CroY5wpRFj24ta1Ium3g4f2Ajkmwthl4kcU0feFEmh1wqjGEli14hh1wef1YdhV8hiGAmtYlL2a9s6cSByadovJZYk29DcVc1jHNKmHlYcVlCZFBBWk1CXVNHWlFEWFFDX1hHhX5pmJF7gntlb2ZUaGBQbGVUamFRZVtLcGRVfnBngXhsqZ6NwrekwLair6eSrKWQuLKfw7ypzsWy0sm308m51cy+1s3C1c3Cz8i8xsK0wsCxwsCxxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzMGwzcKxzsO10ca70ca+sKegXlpUS0hCS0hCS0hCS0hCS0hCS0hCT0xFgXptnJOCnJOCnZSDsZ12tqN2tqR2sJ5yqpNvro90r491spN2s5p1qpZtsZ10w6+GxbGIrZlyZFU0WEsrWEsrWEsrY1M2cl9Gcl9Gc2BHdGFJblxIbFpHcV9PemlPd2VBdWE9h3NRuaOF5Mut2bueyaiHyqF+yqJ+x6Z+xad/w6d+vaSAooxwsp+E2cWr3Maq3Mel4Mur38OfybCHc184aFM2Yk47aVk9dGNIc2BDgW9Fr5FfooVTloBWXUo5dGNMhnZWb2FMY1ZEc2ZWZlVId2ZTd2ZPe2lSg3FSjXxcdWZPWVA7Ukw3Tkk4TkY0UkQrYkwplnA9tYZEmXtAhmc4roZEl3g6nn09s4s+eFsxaVAmoH1CjGYyrYA/kGIvcUskd1MvgFw2iGEpjGAliV4ghFokgl0glG44rH9BwZZT4Lt40rJ1ro9ZjnFObFg9eGRDmIBRfWNCa1M6ZVVBaF9QY11NUks+VUw/bmVWmZCChHtub2ZXb2ZWbWRVcGVXZ1tOd2tebGBZk4VyxLWZu6uRqZd+lIFnjHpelYZspJeAuK6Zy8Ku0si208q51cy91s3B1s3C0sq+yMS2wsCxwsCxw8CyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKxzcKyz8S3zMK4lIyFUU5IS0hCS0hCS0hCS0hCS0hCTUpEe3VonJOCnJOCnZSDr5p2s592tqR2taJ1rJhvq5Byr491sJB2tJl2rZdvrZlwwKyDxbGIr5x0Zlc2WEsrWEsrWEsrZFQ2cl9Gc2BHdGFIgG1TcF5KbFpHcWBPemlReWdEdWE9fmpHrZd52cGk48apz66Qx6OBy6F9yKR9xqd+w6Z9wqh/tZ18n4puu6mL18On0bmYz7mTn4Vjblo5Z1Y4X1A0WUsyfG1HcmBAfWNJtZRgmHpLnIBRnIdbZVRCa1tHblw/lodqhXlehHlcn5N2mYtxa1tIbFtMhnVfgHBWY1ZDUUk4T0g1TkcyT0QtUEQrYEwqqIJEt4dIjXA5k3U/uZRVcFcwclYwooBAalEyfFwyhWIwiWpAm3ZEnXFBgVszaVI3Z1M3hGU6m287hGM2ck8lbE0eg2ApkmQnqXw5xqBfxqltvKFxhm5SZVNAdGRHj3tRnoNeeWJGemdObWNSX1hJUko9Ukk8amFSoZiJeXBiaF1Qal9RbGBSZ1tOal5SaV5SdGlYlIFcpI5kmINkknxekXtdkXtdkXtdkn1fmYZpqpp/wbSdzcKv0Me11Mu81s3B1s3C1MzAy8a5xMGywsCxwsCxxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzMGwzcKxzcKzwberdXBoTElDS0hCS0hCS0hCS0hCS0hCbGZcmpGAnJOCnZSDr5p2sJt2tKJ2tqR2sJ5yqpNvro90sI92s5Z2sJlyqpZtvKh/xbGItKB3b188WEsrWEsrWEsrZVQ2cl9Gc2BHe2hOk4Bkb11JbFpHcmBQeWhUemlGdWI+eGRAoYtsyrOV6tCz1reayaiHyqF+yqJ9yKV9xad+waV6waeAq5N0n4tvu6qKvaeBfGNAXk4zXEwycF4/b1w6Xk0urJljfW1Ik3hUo4NWkXdRf2RBjXdZZFVDYlREgG9Pj4BejIBim490kIRwbWJPdGhYYVRFZltKZVhJWE1BVEo+U0o8UUk2UEkwUEgwUkctl3Q+xZZRblIui20+ln1FVEYsa1I0imM1bE0mi2M1hGM3XUotd14/k3JLi21Jc15CbFk8lXhPnX5Mnn9Vd1w2XEgigGQponUummwzo3xEvp9lupxmlXxTa1o4dWdFfW1NdmRFhG5RhG9Xd2dTXlVGUko9XFNDe3JdmI97b2ZWWU5AYFRHYVRIX1FGa19TcmdYdWtUf21LnIVfpo9up49vp5BvqJFwqZNzoY1snIhom4holYVmnpF1tqyT1s642dC+2dDC18/D1s3Cz8i8xsK0wsCxwsCxw8CyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGwzcKxzMGwr6aYZF9XS0hCS0hCS0hCS0hCS0hCZmFXmI9/nJOCnZSDrpp1r5p2sZ12tqN2taJ1rJhvq5Byr491spN2s5p1q5ZttqJ5xbGIt6N6d2dCWEsrWEsrWUsrZ1U3cl9Gc2BHj3tfnopublxJbFpIcmBReWdUe2tIdmM/dmI+mINjvaeJ586w38Gkzq6Px6OBy6F9yaN9yKZ9w6Z7vqN3uJ95lH1fg29PbFs1ZFAzZVIuXEkxiHBMknZKjnhLnIZQjn1am4RYh29NjXZXeGRIfGlQYFREa11KhnNRkYNWmpBmjIFla15MaF1OY1lLVUo/WE5DWlFHVkxCVEpAVEtAWE89W1Q+W1M+W1I8iGo8tYxMaFI1fWE5iG1BU0Ysdl43j2YwiGMml206d1Y0X0o4eF5ClXZPi3BLhWxIg2xKqZBpqZBpg2dIYk41W0krc1cunnc8qX9AoXs8vZ9fuZtlpYpdlIBTfmtAlIFeYlU6e2ZMemRNb1lDY1NBamBPfnRfhnxmgnhkbGJRX1RGYFNIYlRKXU9FZ1tPdGlad2pXaVY5iHBLdV08dF8+eWVFfm1Ng3VVhnhZjoJjoZZ3tayOycCk29O459/F5+DG5t/G4tvG3tbE2tLD1M2/ycW2w8CxwsCxwsCxxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8CvzMGwyr+umpKFVVFKS0hCS0hCS0hCS0hCWVVNkol6nJOCnZSDrpp0rpp1r5p2s592tqR2sJ5yqpNvro90sJB2tJl2rZdvsZ10w6+GuaR7hXNNWk0sWEsrWkwsZ1U3cl9Gd2RKqZV1k4BmbFpHbVtIcmBReGZXfGxLd2VBdWE9jXlXtqCD2sKk6Myu1LSXyaiHyqF+yqJ9yqV8yKh9u59yqI5hc1k2ZlE0YlI3d2M9nYBRblg8oIJYqIlZnoVRsZhim4RjpZFiiHRPdWFIdGNMa1tIYlVFeGlQmYZkk4NhdmpQaVxLd2lTeGpWWEs8VEpAT0dAVk5GV01EVUtCVkxCXlVFY1tHY1tHY1tGeWVBoH5EclsxhGo4oYVKYU8sgWQ2onc4o4BEimY1alA2d11FdFk+iWtDiXBBdmA1emVCiHRcf2pTdVxFXk44WEkzalI1jG5Ai2k1h2Y0mX1JwKVwsplroIpikntYnohncmVMYFE6aFI8Z1I8eGhVh31siH9siYBrjIJuhntrYVVIYlVKYFJIYFNJbGBTaFxOal1Jc19DknlTgG9NfW9Pin5en5R1tauOycCj2dK249zB5+DF6eLH6eLH6eLH6eLH6eLH6eLH6eLH5+DH5d7G3tfD0s27yMW0xMGywsCxxMCyxsC1ycC3y8C3xryxuLCjrqiXsKeUtquXv7Shyb6szMGww7iogHpvT0xFS0hCS0hCS0hCVVJKjoZ3nJOCnZSDq5lxrZp0rpp1sJt2tKJ2tKJ1rJhvq5Byr491s5Z2sJlyrZlwwKyDuqV7jnxUXlAvWEsrW00saFY4cl9GhHBVxLCNlIFobFpHbVtIcmFReGZYfGxMeWdDdWE9hHBNsJt9yrOW7dK02ruezq2Px6OAy6B9x6B5xqFznHxUZ00sfmY/jHdOX1Q9emQ5qYJMZ1Q5nIBVloBRqJBitZtxlHxfoYxim4ddd2RJaVhFZ1dFZldGemxUhnRSfGpXcmVUjYFonZF0kYJsaFtKVkxAS0M7UklAVkxCWU9EXVNHY1pJZFxIY1tIYFdEa19InIJWhG5Id184o4hSe2pGlnRAp38/dWA1b1s8dFxEiW5RfmhMiXFMdF81aFUudGFCh3VjhHFgdF1LX1A7U0c1WUw5ZFI0aVMwfmQ9i29HpotmuqJyq5hkjXpSh3RUfGlQcF9Jb1xFa1dChnlokYh5h35uc2pYpJqImI19ZFlMXFBGXFBGYFVIZFlLal9PYFNAZ1M3j3VMuq6Lxbye18+z49vA5+DF6OHG6eLH6eLH6eLH6eLH6eLH6eLH6eLH6eLH6eLH6eLH6eLH6eLH6OHH5+DG4tzD2tW+0c25yse1xcKzxcC0x8C2ysC3yr+1v7eqsaucrqeVs6mVuq+bxbqny8Cvua+gbGdeTElDS0hCS0hCT0xFgXptnJOCnJOCrJlxq5lxrZp0r5p1sZ12taN2sJ5yqpNvro90sZN2s5p1rJduuqZ9uqV7m4ddaFk3WEsrXE0taFY4dGFHn4tt0r6bloRtbFpHblxJcmFReGVYfGxNempGdWI+gGtHsZt6v6iL586x48Sm0bCSwJ96xJl1s4plfmE3eV03fGA2rY9TtZtjblxJknlJvJdXZlk7hW9Kg3RMopBrpJFvhnVXlIJblYNbcWBEXUw4Y1M/ZFRCZFU8gG5LgnJXcWVSWE4+Wk9EZFdLX1RGT0Y7S0M6UEk8ZFpMaF1Pal5QaF5MZVtHYlhEY1hEalxDbV5DcV9CaFM0iXJLdmQ9pYVMkHNEZVY2Y1Q3gmhNf2NEcl1GemVNcV4/aVY1cWBHfWtZemZVd2FPcmNPVk04Vk47Wkw3XEoxYUgvhmRAimtPootjrZpol4NYfWhLc19Ge2pTbmFKal1IfXRjioFykId4jYRykod3hHlrXFBEWk5DXVFGXlJFa2BQZ1xLXlE+eWVHoYdbwraWy8KnzMOozMOozMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOpzMOoy8OoysKox7+mwLmit7Gdv7ipyMC1ysG3y8C3xryxuLCjrqiXsKeUtquXv7Shx7yrqqKTXlpSS0hCS0hCTUpEe3VonJOCnJOCrJRxrJhxq5lxrZp0r5p1s592tKJ1rJhvq5BysJB1tJl2rZdvsZ1yuKN5oYxhemlDY1UzcWA6bFk6fGhNuaSC2cWlmIZxbFpHbl1KcmFReGVafGtQfGxIdmM/gWxHtZ56uqWG2cGj38KhyaeHrYdbn3hMkG5Fd2M/c100f2EpvpZOrI5Se2xNinA/q4pIa2I+c2NDemtOj39iiXxhe3BWem1PhnZTcV9HZlRBYE87Xk85ZVc+jn1gYlFCcWRTeW5bcmpgZlxUVk1ETEM6Vko+bl1ObV9QbF5ObF5Oal1KZlpDZVlCZVlDY1ZAY1U/YlA1aFI0jHNRh29Lg2lHbVU5d2JBal07cl5CaFM/Xkw7dWRHc2FFcGBHcmZTc2VTb11JcV9KiXlmZFtFWVI8WU06V0UzYUo0gGFAiWxKlnxcmYFdsZpyk35bdGJHZVlBYldAZVtGb2ZWdm1ej4Z2nJOBkoh4cGVWV0w+U0g8Vks9ZFlKal9PbGFPY1ZAemdFnYNTxLCUzr2lzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2mzr2lzr2l0sKs1sez1MW1zsG0zMG2y7+1wLeqsaucrqeVs6mVuq+bwLWklo6BVFFKS0hCS0hCbGZcmpGAnJOCrJJzrJNxrJhxq5lxrpp0sJt2tKF2sJ5yqpNvrY90sJNzrJRsqZJlsZltnIRZkntRj3pQmYJRjHhRn4hmybKN3suvmohzdGFMd2VPc2FSfWpelIJjhHRPgW5JiXNNt594taB/uqF+uZ1zlHJCjWE1mnNAnXlEhXFDdmVAl3c+z6JbooNQaV5AbVs5pIpYgXZVd2xPcmJHe21WcGZSYVdFXVNAZlpGc2NQdGNPcGBKZFY/Xk83ZlU+eGdTiXxmgnhiYFdKZl1UXlRLWUxDbl1PdF9NaFZGZlVFZlVFZlhEZlpDZlpDZFhCWUw7XU88cFxBfGVGjXFPeWFGZFA8aVQ9iW9QgGxJd2dNaVhCY1I9bFxBbFtBa15KcGRUcWVUZFE9aFdCdGZRbGJNYlpEYVZDYE06aFE6b1k+c1o4inFQgmpNhm9RjXtdYVM4YFY+YFZAaF9Lc2pbdGtcg3tqoJiGmI5/c2hZal5QVUk6WU4+bmNRgXZla19OY1VCeWZIl3xQuZ5+xa2Uy7We1b6o2cOs2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2MOu1sOw1MKy0cK0yLywuLGirqiXsKeUtquXtquYfXZrT0tFS0hCZmFXmI9/nJOCr558rJR0rJNxrJhxq5lxrpp0sZ12tKF1rJhuqY1umHhYooZdlX1Ni29Bmn1Ql3tNl3xLnIJPhW06mX9Otp5y4M2uuaaLo41tnIdkgm9ak39suaR9pZJppIxjqY5fqZJofGtHfmc9hGc4kG06vJNXu5NOupFMpYxSeWdCmXtAvZFSrI5jZFhAX1M8emlKgXVae3JabmBGbWFNYVhIVk0+VEs8X1NEcGBRb19OZ1hAZlpCYlI4a1g/indTn5BvfXFcal9TZVtUc2dZb2FRbltNfWpWaFdFZ1ZEZ1ZFaVtHbF5HbF5HZlhCV0o5YVU/dGFGfWZKfmVFcFxEWk08Y1I9eWFFiG5GfWpMallAZFM7ZFM9ZFM+XlBBXlJFaVpKd2BOalZDZFQ9Y1hBX1Q+YlhIZFhJZVVFblxNjHZYhW5NmYZkW0o3YFI+cGdLamFIaF9Jc2pZgHdnhXxtgHdmpJuKqqCQem9gcGVXW1A/ZltJg3lmg3hnbWJTaFlKdGBJeWA9mH9gn4ZopIxvt5+EzLWc18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt2cOt2cOt2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2sSu2cOu2cOu2cOu2cOu18Ov0sGvxLemtKybr6iWs6mVp52LZ2FYTElDWVVNkol6nJOCr6V+rp58rJR0rJNxrJhxq5lxrpp0tKB2s6Fykn9WdmRAcmQ/fXFMcWJAcV9AeGZGd2ZCbFo1gm5GrpdpwadzuaBss5pmpIhVs5hlsZlmsplsrJJmkHVIgmA6hWhAblg5f2lLo4hbn31Do4FHtJBVvJRRqodHln1QfWtLiXBGgmE4l4FedWhRXVJAYFNEbGJXb2VbbGJVYllJVk0+VEs8VEs8YFJDZ1hIZ1dHYFA5YVU/alo7inZNoYhkmodpdmlVZVtTYVdQcmZZgHRcfm5QdmRNbV1JaVpGZ1lJaFtPal1MbF5LcWFMZ1c8ZVY+a1pDdWJLdGNOb2JIZVlCYk85aVI4eWE+c19CYFE5VUk1YldHZFlJXFFEVko9W0w9X0s5alVEf2ZJim9NYE86YVZIYFZKU0lBVEhAaFZDb11Cbl5BYVI9ZVhNb2VYcmlbcmlbcGdZcWhbfHNkgXhno5qJppyMeW5ga2BPZlxKhnton5SAfnNhcmVYa1tRd2ZVg3JQopBwwKuNzLaZz7mc0buf072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2sSu2sSu2sSu2sSu2sSu2sSu2cOu2cOu2cOu2cOu2cOu2MOt0r+qyLikvbGetquXmpB/WlZOVlJKjoZ3nJOCrqV9r6V+rp58rJR0rJNxrJhxq5lwtJpymIZhYlQ7V0k2X1M+Y1dBVUo0YFM8c2dNd25UcWhNgHRVdmhEhXNIjHlKkXxOoYhZwqh2spZju59uqIxjkXVLs5ReqI1bZU8yhXFMqY9aso5Oq4xTd2Iyr5JnpYxhl4Zeal9Jals9alY3dGVMcmZXZltOaF1TbGJabWNbbWRbZ15SXVRGV05AWE4/ZFRFZlZGZlZGX083W005dWRHnYhdinNUalpEV05BYVhSYFVPX1FIaVtEd2dIgG9Xfm1Yd2hVaVxQaFtRZ1pPZlhKa1tKeWRIZ1Q2ZVQ/aFZEcGFMdmdMfmpNa1U7XEgwXEgwY040WUw4W1NCY1pMZFtMWk5BUUM3UkU4XU09bVpCgmlDlHhOZVI9Wk4+WE9DUEY+TkI7V0k7bV5FbWFGcWZQZVlMaFxUb2Vad25hfXRnfHNmf3VoeW9flox7oJWGfnNkaV5Oe3Fen5WCnZN+d2xadWlbX1NKYFZKXVQ+cWZIjH5eq5l6xK+R0Lqd0ryf0ryf072g072g072g072g072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2sSu2sSu2sSu2cOu2cOu2cOt2cOt2cOt18Ks0r+pxbSglYp6XlhQgnptnJOCopd3q6J8r6R+rp58rJN0q5JwmoZhhXJTbV9GUEg3XVVHfHVmc2pYU0k3Ukk3XFhDWVdDVFE+XlhBY1o9Z1w5bWE8a1s2emU8r5JktZZh0rR9lHpSg2pBxqZlrpRceGdIf29Rc105o4RTqY1aaVo3bFk/dWJIeW1QbWVQYVc/W083Y1dIZFhOZFhOaV5VbGJabWRbdm1jeG9kbGJYX1VLXFJGZFZFaVlHaFlGX1E3Xk88dWRKemZAc2FFVUo3UkpBaWFcY1pUaVxMfnFXkoJkjHpifm1YdGVUZ1tQaFxRZ1tPXlFDWUs8dGFKinVOa1g8ZFA9cVxGeWFFj3JQhWtNYE04U0IuVEc1UEs+UU1CWVNHXVZJWU5BWk5BY1lKaV1Nclo+pYVQp4pVZ1M3VEg3TkY7TUQ6TUI6WEs+bWFJa2JMYlpJXFJFXVJHZltRgXZsh31xhnxwhXtuhHlpm5B+mo59dGlYb2RTioBtopeFg3pnkYh2g3lqVU1DR0I4SkM2VU04ZFo+c2hJjH5eq5l6xK+R0Lqd0ryf0ryf0ryf072g072g072g072g072g072g072g072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt0r2oo5SEj4Z3nZOClohxnpF1qp97raN9ppV1gmlOdWNMYVQ/VEw4Tkk3Zl9RkIl7jIR1XlVET0k4T008T008Uk4+TEc1TkcwVkw0Y1c/bF5GcF9EgmpGe2M1pItVgXNJZlcumXtEjHdIdGpHcWdKcWRKe2tMgnBKd2tQYVZAZFdDenBZe3ViamJQXFRGXVVJZFlPcGVadWtfbmZba2RbenFoenFmbWNZYFZMWE9DX1VFbWBMbmFMW081YFI9ZFI+eWRDcmE+iHxge3JfcWhhY1pSem9Xe21SeWpNi3ljd2ZSZldGX1FFa19TbWFUZ1lLW0xCZVZKfm5OdmVDXkw2alZCcllAjHFRk35jb2JPUEc7TUg9TUo/T0xCUU5EU09FYlpNbGJTbGJRbGBNjG5NxZhVoYBGaFUyW004TkU3TkY6U0k8XVNBaWFMamNSaGFVYVlNWlBEWlBFc2leiX50jIF2g3hrj4R0mo18e29dbmNRcWdUjoNzjYN0iH9ymJCAiYBwUUxARkE3RkE2SkM2VU04YFc7Zlw/c2hJjH5eq5l6xK+R0Lqd0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt2cOt1cCqwbCcpJmIh3lmkoRunI50oZRzc2hGYFM9bmJOamBMWFA9T0s4Z2FRkIl7k4x+b2dYT0s7Tkw8UE08UU06UEs2VE83W1U/ZVxIXlQ+X1ZBbGRLcGpHhX1UjIVfZFs2bWA5hHlTd25LcGVKcWZNal5GZ11GYl1GWFQ+ZFxKeXBeeHBecWhXYlpLXVRFa19Sh3xuhXtudm1hbWZcenFofnVqbmRZX1VKVUxAVk5BX1RCYlZBX1M4XlE7YVE/jnROg2xLfW1UbmRTbmVZbmRVfXJYfnFVemtQdGNMcGBNXU4/WEo8cWRWfG5fe2xcWk5BWk8/cWVJcmVJZFVDXlBBXkw4cV5EgnFYXlNETUY9T0g/VE5EWFRKVlJIWFRJcmpaeG1ddWtad2lWmHpRwJNRoHtIeWNAXU84V00+WE9BX1U+Y1pBWlRAXldJZl9UZ2BVXlZKUUk9Uko/aF9Uj4R5g3dqkIR2g3hodWpZcWVVeW5dgnlqe3Nmhn5ylY1/fnVkV04+T0c5TUY4TEU4TUU3V045YFc7Ylk8Zlw/c2hJjH5eq5l6xK+R0Lqd0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr2cOs2cOt2cOt2cOt2cOt18KswbCceGtcf3JgintmgHFXWk84WlM8YlpEcmdUaF9MU047ZF5OkIl7lY6AenVmUE4+Tkw8UU48UEw4VVA4ZV5Je3FdeW5WbWFOYFZEZmFMYmBJT005bWhOamVJa2ZMY15GbGVJbGVLamNMb2hUY1xKW1VDZF5Kd29chX1ofHRfg3dkfnFgbWJSe21fjYFzkIZ5gXhseHFodmxkf3VqfXRlZVxOWVFEU0xAV09AUkgzXVE2YFM5bVxCfmQ/gmpGh3dYhXthdWxWdm1VeGxRc2hMgnVZcWJNallHXk8/Wks8ZVVGiHVkjHlmYVVEWFA5bmZMdmtRb2NMYlVEY1VCZ1xKbGFGWE07TkY+UElAWVFIY1xTZV9VZ2BUioJulY12jIJsgnNZo4NUsIREnXJBgGhFZlhBXFBBaV5GZFk8YllAVE46T0k3Vk9AYFlMX1hMVk9DVk9CWVJFkYh7e3FjjoJ1dmtdcGRVd2tbc2lahHttgXlsfXZqfXRnY1hGWk88WU47WU47WE07V007WE06XFI7X1U7YFc8Ylg8Zlw/c2hJjH5eq5l6xK+R0Lqd0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072h1L6i1b+k1b+l1sCn18Go2MKq2MKr18GrcmhbdGhadmlYcWVRZ1xIXlZBXFY/amFNc2lVX1hFX1pJjod5lY6AeHNkUE4+UE08UU06Uk43YFpEeHBclYp0npN/lYx5iIBqhX1qdm5bVk8+W1RCaF1IbWJMYldDX1Q9YFc9bWZNcWpTYldEXFJDf3Ngl4t4lIdzkodwqZ2IoZSAqp2LqJmKin5vhnxufXRnbWVbYVhPamFUeXBgbWRVZV1QXVVKWVBFXlRBZ1xBal9DfG5Qh3FDnodUhHNNal1HcWhWenBcgXVdj4Nnd2tPbmFKalpGaFhHaFlJYFA/g29amIRrhXRbal9IX1Q+f3RXfXJUaltEa11FY1hDXlNCWU5AVEtBU0pBW1JIaV9VbWNXZltPe3FglIt1lYx1kYBkl3ZIqoVMmHVMdF8/ZFM3cmFFh3hRbV49ZFs/U044Tkk2UEs3U047XVdLdG1hfnhrgnxuf3dqg3lrfXJmb2RXc2hafnNkfHJlgnlshHtuf3dpa2FOXlM+XFE9XVI+XVI+XVI+XVI+XVI+XVI+XVM+XlQ+YFU+YVg+Y1o+Z15AdGhKjH5eq5l6xK+R0Lqd0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072h1L6i1b+kem9hcGdZb2hZcmtbcWhWaF5LXVdBYFpDcWdTbWRRXllHi4R2k4x+a2dYT009Uk48UU03WlU+cWlWjoRvoJSApZqJn5iGl498m5B8mIt2l4l0koJriHddinlfnoxyl4ZqlYVnl4hphnldbF5Hi3plk4NnrJqBlIJukIFrinxllYZxjHtpintrgHRkc2dZdGtfbmZaZl1UYVlPZF1QZl1RX1VKXFNJX1VLh31sdGpRX1U8WUwzeWM+g2hLYU06XlFDYFZKeG5bfXBXgHJVcmRJb2BIbV1HbltJcV9MdWNPgG5VnolonoxqhnlfYFJAYlM+a1xAe2pNfm9MaVs8cGNKbV9LbWBOal1OfnBiiXtudGhaZVpOa2FTiH5qjoRvlIRopIRZlHlKdGBCXE00dV07h2tAsppjjHVGenFGWFI2U003Uk04T0k7UElBWlNJaGFWcmtedGxehHtsbGJVZ1xQd2xgi4F2lYyBjIJ3f3ZpcGdWX1Q7YlY8cGVJe3BTe3FUe3FUe3FUe3FUe3FUe3FUe3FUe3FUfHJUfHJUe3JTeW9Qd2xNfHBRj4FhrJp6xLCS0Lqd0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072gf3VndWtccWlbcWtdc2xdcmpZaWFNXlhCZV5IcmhUZ2BNhn9wk4x+aGRVUU49Uk45VlA5aWJOhHpmnZJ7o5iFpJyLnJWDm5J+oZN/nI97nY9+oZR9opV5nY53oZB5n452nY5zmotwmYlumIhwkIBqkoJrlYRumId1gnFgi3tsg3Rljn9wiXxvg3lqkoV5hHpudW1iamJYWlNJX1hOY1xTZ2BYYVlRYVlSiIBzcWpVTkgxUkcvYE0xcVo8eWhOdW5aYFlMem9ajYBej4Fdc2NIZlg/aVdBbldEeF1Jl31gnIdkpJBtrZ17oZN8aVlIWEc3ZFM8a1o/gHBPkoVgkINghndYgHBWd2dRiXlpk4R2c2dZYldLZ1xPg3hmiX5rgHFeh3VVgm9NYVM1ZVQ1i2w7s4tHxaJfo4dNgHBHXVM0VEwzU0s1TEY8TEY/UktDWFFIZl5Td21id21gZltOZFpPcWZciX90kol+kId7b2dXXlZCXVI7YlU6d2pHlYhiloljloljloljloljloljloljloljloljloljloljloljloljlYhikYRejH9akoRfopNutaOByLSV0bue0ryf0ryf0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072g072gf3RnfXFld2xfdGxecmxec2xdc2xbamRRX1lDaWFMb2ZTgXtrkYp8Z2NTUk88U043YVtFenFel4x2oZWBpZuKoJmHmpOBnpN/oJJ+m497npCBp5uEqZ2FppmHoZOBn5KDnpOCmI19lIt7ioJ0j4d6l4+BoJeJraGUtqqetKidqpuQm42BkoZ5in5xloh8jYJ3eXFma2NZWVJIX1dOZF1VY1xWW1VQXFZQhoF1dXBeTEgxWE41alo+dmJFaFg8ZFxHXVZKg3dikIJhmotme2tRZ1dAZ1ZBallDcmBHqJeAr5+Ino52sKKJopR9r6KLpZeBiHZfgnFabl1HcmJKemtRe2xSh3ddhnZdhndldWpdYFZKVkxAW1JGgHZni4BxfHBedGdQbWBIa1s/hWlBpH09y59WtZBMo4VKfWtBaFw9WU81Vk02TUY8S0U+U0xFXFVNYVtTZFtUZVxVYVhPYFdNamBWhXtxhXxxbGZXXVdFXFRBYlZAd2VKnIhitqR9t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+t6V+uKZ/uKaAvKmFxbGPzLeXz7ma0Lqc0bue0ryf0ryf0ryf0ryf0ryf0ryf0ryf072g072g072g072g072g072g072g072g072g072g072g072g072g072g072gf3NnfnJmfXFlem9id21gc2xec2xdc2xcamRRYVtFbmVRhX1si4V3XlpJU085W1U+cWlWj4RvoJR+o5iFpJyLnJWDm5OAopSAnpF8nI99oJODq5+Gqp2Ip5mIopWFn5OFnpODk4h5cmtgZmBWb2lfbmleaGNYk4p+tqqeuq6krqGWn5GFk4d7jYF1l4l9lId8fHNobGRaW1RKYVpRYltVXFZRWVNOY11XkIx/bWhYVVE7XFM7YFA3YU44ZlZFc2defHJnhHpjjH5fhndYeWlSaFdCZFVDZ1tIgnhhmo58qpuJno96fHBfZVpMeGtckoRzm4t5kYJviHpkinxoc2VUYVFBiXlomIt6bWJUX1ZKWlJGVUxBVEpAbmNXh31vbmVTYFdDZFhDeWFAlXJCsoJByJpWwp1arI5Tfms/X1IzWlA3WE85TUY9TEU+UkpEVk1HVU5JUEhEV1BLXVVOXFVKYVlOcGhcXllLTUs5Uk88XVVDZ1lCj3lWrpVqvKaAvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiBvaiCvqmDv6qEwKqFwq2Kx7GRyrSVzria0Lqc0rye0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryf0ryffnJmfnJmfnJmfXFle29jeG5hdGxfc2xdc2xcamRRZF1IenJfiYJzXVlFVlE6aWJOhHpmnZF7oZaBpZuKoJmHmpSCn5OAopR/nI97nI+Ao5aErKGHqZyKppmJoZWFn5SFnZKCfHRmWFNIYVxSbGdda2ZcXVhOdm9ksKWZu6+ksKOYn5KGlIh8joN3l4p+mYyBgHdsbWZbXVZMYltUXlhSWlRPWVNOb2lhe3VnXVdFUkw3Vkw3YFA5ZFQ9bFxLcGFZaF1TYFVBXVA4WEg2ZVVBY1RCYFJFY1dJd21fin9wkYR1d2teUkg+TEI4T0M3XlNFdWpbkod2oZWDsqiSrqOPm49+opWFgHRlZFlLYFdIYlhLX1RIWExBZlpRgnhqcWhWYFdEXE87b1E2lWo+wpJEwpdMsoxJk3U6fGo9WEwtV0wwVkwzTUY8TkdBWVBKXFNNVk5JT0hEUktGW1NNXFVMXFVKVlFCS0k4Skg2TEk3W1Q+cF9AqI5er5FmuqB7u6OAuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSBuqSCu6WDvaeGv6mIw62NyLKTy7WXzLeazrmcz7qdz7qdz7qe0buf0byf0byfz7qfzrmfzrmfzrmfy7eex7WexrSef3NnfnJmfnJmfnJmfXFle29jeW5idWxfc2xdc2xca2RSa2RQfXZlW1ZAYVtFenFel4x2oJV+o5iFpJyLnJWDnJSBopSAoZJ+m497nZCBppqFrKCHqJuKppmJoJSGn5OFmY5+amNXVVBFYVxSbGdda2ZcXFdNZF5UnZSIu6+ks6acoZOIlop+j4R4mIuAnI+EhnxxbmZbX1hPYFpUW1VQWlRPX1hScWpec2xcWVI/T0g0Ukk1Y1ZAalpDd2dVb2BWU0c8WU05YVU8XU46XU47XU9AW05EZVlNZFpOX1ZNW1NKVk5FV05FVEpAW1BDZVtMbWNUg3dpi4ByhXtsd2xeXlNFY1ZIXlJDX1NEX1NEYFVHYFRIWU5CZlpRhXtua2NQWVA8U0c0X0sumnI5vI08vpRKr4xIlXo+emk8Y1g3XFE0W1E0VEw6VU1GXFNNXFNNVk9JT0hDT0dDV1BKX1dOY1xNYVpKWFNAU087VFA7W1M3fm1Dr5ZcvaByxKZ/xKeAw6eBwqeCwaeEv6eEvKWDvKWCuqSCuqSCuqSCuqSCuqSCuqSCuqSCuqSBuqSBuaOCuaOBuaOBuaOBuaOBuaOBuaOBuKOBt6KBtqGAsZ1+r5x9p5Z6o5N5oZJ5l4t3mIx6mo99npOAqp2LuKmXva6cva6cuayctqqbtqqbtqqbtambs6ebs6ebf3Nnf3NnfnJmfnJmfnJmfXFle29jem5idm1gdGxec2xcbGZTZ2FMXVdAcWlWj4RvoJR9oZaBpZuKoJmHmpSCn5SBo5SAnpF8nI99n5GDqZ2Fq5+IqJuKpZiJoJSGn5OFjoR1XFdMVE9FYVxSbGdda2ZcXFdNXllPjYR5uq6jt6uho5aLmYyBkIV5mIyAnpCFjYJ3b2hdYFpSXlhSX1lTbWdegnpuj4d4kYl5fXRjV088T0YzWk87cGVLdWlRdGhRZFdGdGNOdmJIaFc/ZldDXlBAW09EYldNVk5GUkpDU05FUk1DWVNIXlZKX1ZJaF1PbGFSc2ZXcWZWbGJUb2RVbmNTal9PbWFQaV1NZVpLZ1xNZFhKZFlNcmhciYBwdm1bW089Vko3Z1U3rYlLx5pOrYVDk3I7k30/aVwyYVczX1U1XlU2XVQ5XFNIXFNNXFNNVk9JT0dDTUVBVk9IY1xOZV5OZV5OYFlFW1Q9ZV5FcGRCjndGsZZetZ1rwKZ8xqqDyqyGy62Hy66Iy66Iyq2HyKyHxquGxKmFwaiEv6eEvKWDvKWCuqSCuqSCuqSCuaOCt6KBtqGAsZ1+r5x9p5Z6opJ4m411kYZxjoRwhHxsgnprfndqe3Vpe3VpfHZqgnxwkop+oZiMraOWsaaasqebsqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3NnfnJmfnJmfnJmfXFle29jem5ieG1gdW1ec2xcaWJPamNPhHpmnZF7oZV+o5iFpJyLnJWDm5SBoZSBopSAnI97nI+AoJODq6CGqp6Jp5uKpJiIoJSGn5OEgXhqVlFHVE9FYVxSbGdda2ZcXFdNXFdNd3BmtKmfua2jppmOnI6DkYV5lop+npCFlId8dGxiZ2BYc2xkjIZ6mpOEm5OEmZCBl45/kol6aF9PUkc1ZVlHb2RPZ11FZ11FZ1lEgWxWjnRZh3NbcGBMZVZEZFpPYVpTXVdRV1JLXFhQW1dNYFtOXVdJZFtOa19RcmZXdmhZdGdXfnVjgHVkfnNhdWpXfG9cfHBdbmNRfnNjdWlbaF1RfXVmgntpa2BOcGJMdWlLdGJFpIlUwJ1WtJBNo4VNfmo4ZFczYlg0Ylg1YFc2X1Y3XlVBXVRNXFNNVk9JT0hDT0hCXlZKZV5OZV5OZV5OZF1LX1c/YVU6bFw7kn9SnIdYn4xhpJBlp5NprZdus5tzu6F6wqaAxqqEy66IzK+JzK+Ky6+Lyq+Mya6Lxq6Ow66Pv6uNtaSIoJN9kYZyjoRwhHxsgnprfndqe3VpenVoeXRoeXRoeXRoeXRoeXRofXdrhn9zmJCEqJ6Sr6SYsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfXFle29jem5ieW5hdm1fc2xbe3Jfl4x2oJR9oZaBpZuKoJmHmpSCnZSBo5SBoZJ+m497nY+Bo5aErKGHqZyKp5qKo5aIoJSGnJGDcWpeVE9FVE9FYVxSbGdda2ZcXFdNXFdNamRarqOZu6+lqp2SnZCFkoZ6lIh9npCFnZCEi4BxgnlpjoV1nZWFo52NpZ+PpJ6OopuLkYl6V00/UkUzYlRBcWRTXFA9aV1HhnZdjXhdjXRXf2tUdWRQbV9OaWFaaGJdYVxXZGBZgH93fXpxfHhtenNmeG5gdWpbfW9icmNUdmpYfXFfgnZkfHBdf3NfhXhkhnpmhXhmhnlpe25feW1ffnVndm5dY1VCdGVJjYFUb15BjnlJrZFTro1MmH48emk2b2A1ZFczYlg1Y1o2YVg3X1Y7XVRKXFNNVk9JUElEWlJIZF1OZV5OZV5OZFxMX1hEW1M7YVc6Y1Y2fG9OemxKiHpXjoBcloZhno5moZFppJNsrZx3tKKAxLCTyLSYyLSYx7Wcx7adx7aexLWft6qWnpSEiYJ0fHdqeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoenVpgXtvjod7n5aKq6GVsKWZsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfXFle29jem5iem5ienBhj4RwoJR9oZV+o5iFpJyLnJWDmpSBoJSBo5SAnpF8nI99npCCppqFrKCHqJuKp5qKopaHoJSGl4x+ZV5TVE9FVE9FYVxSbGdda2ZcXFdNXFdNY15UoZeNvLCmr6KYn5KHlIh9lIl9q56TwLOlu66bpJiEkoZzi4BvkIZ2mZCAn5eHnZaHjod4ZlpLZVNBaFo9Z1lHYFNEa15Oinxjj31iemZNemVPd2RPb2FPaWJaaGJdZmFcfnx1jo2FiYZ9kI6FmpSJmpKFkYZ5in1xin1vjoFwiHxpi39riX1pj4NvlYl1j4RvjoJvf3Jic2ZXeGtefXRkcWdVa1o+jX1Rdmc8cGE9j3pUknlLl3pAhm49bFw2aVo2aFo1YVQyYlg1ZFo2Ylk4X1VFXFNNVk9KWFFIY1xNZV5OZV5OYVpIWVI9VU02VU83V1A6YllBb2VKb2RMgnlhjoVsnpV6r6aItqyOuq6RwLOZw7WdxbagxrehxriixrijwrWgr6WTl4+AhH5xenVpeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRofXdrhn9zl4+DpZyQr6SYsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfXFle29je29jgHRmmo55oJR+oZaBpZuKoJmHmpSCnJSBopSBopSAnI97nI+An5GDqZ2Fq5+IqJuKppqKoZWGn5OFkod6XlhNVE9FVE9FYVxSbGdda2ZcXFdNXFdNXllPkId9u6+ls6acoZOImo6CtKuc3NTD5d3O3tTF0cS0vK+cpJiEkoZzin9uj4V1mI+AfnZmcGROdGVKalo/aVtGYlVEaFxJem1XdWhQa1xGfGtYcGFQaFpKZ15UaGJdcm1ojIuEj46GjouCl5WMn5mOm5SKmpOKnpaOkoqAkoh8kYh5lo1+lY19nZSFmZCBlo19kId4ioF0fXJnioB0enJgbF5JhnFPpZVYfGtIZFM+X0s1Y1EugG1AfmpCc2I8aVo3Z1g2ZFY0YlY0Y1k2ZFo3Ylg+X1ZNX1hOZ19PaGFPZ2BOYlpHWFA6VEw2U0w2Uks3VU05YVc+cWdKe3NVopt+s6uOubCUvrOYwrWcxLafxrehxriix7mkx7qlvrOfp56NkIl7f3pteXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoenVpf3lti4R4n5aKq6GVsKWZsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfXFle29jfnJllop2oZV+o5iFpJyLnJWDmpSBn5SBo5SAoZJ+m497nY+BoJODq6CGqp6JqJuKppmKoZSGn5OFhnxwWFJIVE9FVE9FYVxSbGdda2ZcXFdNXFdNXFdNf3huuK2jt6uhp5qPvrOm5d7M7+rV7+nV7OXT5t7P3tTF0cS0vK+cpJiEk4d0lox7h39temxScV9BY1M6altJcWJOb2BHdGRIe2pNe2lRalxKZ1pKZllJZlpLaWBXfXp0kI+Ij46GkpGIm5iOnpiMmZKInJWOmpOMjYd/lo+FnJeLmJOHlI+DlZCDk46ClI6BnJWImpKGi4F2kYl7iIBvZ1dDe2RCinVFcmA+YE43WUUuV0UlaVgwe2lBe2lCc2I9aVk3Zlc2Zlc2Y1c3Ylk4Y1w+b2pYdXFedW5Zc2lTc2lScmdPbGJJYlhCV006VUw6WU03X1E1e3BPl45rq6KDvbKXwrWcxbagxriix7qkybymyLyov7Wip56Oi4R2fHdqeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoe3ZqhX5yk4t/pJuPraOXsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfXFlfHBkkoZzoZWBpZuKoJmHmpSCm5SBoZSBo5SAnpF8nI99nZCCo5aErKGHqZyKp5qKpZiJoJSGnpKEfHNnVlBGVE9FVE9FYVxSbGdda2ZcXFdNXFdNXFdNcmthsqedv7SpzcK35dvS7eTZ7ubY7+jX7+nW7unV7OXT5t7P3tTF0cS0u66appeAZFZBaFY+a1g8XlA5ZFVGaFlJc2VOgnFYdGNQeGlYem5geW1fcmVXaV1OaF1Qgn92kI+IkpGJlpWMnZiOm5SKmZGJnJaPkoyFjIZ+mpWKnJeLmJSIlI+DlI+Dk46Ck42BnJWJnJSJlIx/k41+iYFxZ1dBfmVFknpGkXpNblczZlIuaVg1dGZDd2hDdGU/c2Q+al07Ylc6X1Y8XFY+W1Y/X1tFdXFdeXZieXVhd29ZdWtTdmtTeG1TdmpRZ1tGWk49YFM9YVI0e2xFqJl1rZ2CwbKbx7mjybynyr6qyr+rwbemqKCRi4V4fHdreXRoeXRoeXRoeXRoeXRoeXRoeXRoeXRoenVpf3lti4R4nJOHqZ+TsKWZsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmfnJmfnJljYFwopeFpJyLnJWDmpSCnZSBo5SBopSAnI97nI+AnpCDppqFrKCHqJuKp5qKpJiIoJSGnJGDb2hcVE9FVE9FVE9FYVxSbGdda2ZcXFdNXFdNXFdNZmFXrKKY2s/F7OLX7uTa7uTa7eTa7eTa7eTZ7ubY7+jX7ujW7OXU5t7P1Mm5qI5zZlE4XkozYE06Xk8+X1BDZFVHhXdgjH1jg3RdZFlCbWNVcWhfbmVbX1ZOWE9HaWRdiYiBlJOLmJaNnJeMmZGImpOLm5WOi4Z+jYd/m5eLnJeLmJOHlI+DlI+Dk46Cko2AmpSHjIV4e3RmenNldG1dZFU/fWNDk3U5knM+kXdJfGtBcWJCfXBQbmM/Z104Zlw5Xlg+WlZAWlZAWlZAWlZBXlpGdXJdeXZieXZieXVhd29ZdWtTdmtTeW1Tem1TY1dDW044eWVAnohSt599vaiPwLKby7+sy8GvwrmpqaGTjIZ5fHdreXRoeXRoeXRoeXRoeXRoeXRoeXRoenVpfHdrgnxwkop+pJuPraOXsaaasaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSif3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmfnJmf3Nni39xo5mIoJmHmpSCmpSBoJSBo5SAoZJ+m497nY+Bn5GDqZ2Fq5+IqJuKp5qKo5aIoJSGl4x+ZV5TVE9FVE9FVE9FYVxSbGdda2ZcXFdNXFdNXFdNbWhdwbit7OLX7uTZ7uTa7uTa7uTa7uTa7uTa7eTa7eTa7eTZ7ubY6+TSy8CkqYtdeWA9X0oyWUU0XUw8ZlhMa19SaV5MdWhVhnhkZ11NUElCT0lDTkhDTUdCTUdCT0pFamZgkI+GmZaMmpSKmJCHmpSMmZSMjoqBko6DlJCEkYx/j4t+kYyAlI+Dk46CkYyAjoh7dW5fa2RUbWZWcGhXa11GfWRCk3Y+fWI3hW89eGg+bFxAfHBLamA7amA8Yls8WlZAWlZAWlZAWlZAWlZBXlpGdXJdeXZieXZieXZieXVhdm9ZdWtTdmtSe21QZ1lFXUs1fF85rotPxqh40r6ey76pysGxr6eajIZ5fHdreXRoeXRoeXRoeXRoenRofHdqgHtuioR2l5GCnpeJopqNqJ6Sr6SYsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rymf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnfnJmf3Nnh3xvoJeHnJWDmpSCnJSBopSBo5SAnpF8nI99nY+CoJODq6CGqp6JqJuKp5qKopaHn5OFlIl7X1lOVE9FVE9FVE9FYVxSbGdda2ZcXFdNXFdNY15UqqOY6N7T7uTZ7uTZ7uTZ7uTZ7uTZ7uTZ7uTZ7uTZ7uTa7uTa7ePZ6uDSvayIsZBaiG5GYUwyXEs5XE0/ZFdKbGJUbmVWY1pKa2BRVE1GTUdCTUdCTUdCTUdCTUdCTUdCUk1HendvmJSKmJKIl5GHl5OIlpOHlZKGlZKGjYp9gHxugHxtg39xioV4jol8i4Z7d3BkbmdZdW1dfHRjgHhmf3Nch3BJjHNBbFUzcV8zhXJCjn1RhXZIdmpFcmZGXlhAWVVAWVVAWlZBWlZBWlZBXlpGdXJdeXZieXZieXZieXZieHRfbGRNZ11FemhId2NMbFU9dlo4p4JMt5RbtqF9wLSdsKqchoF0fHdrfHdrfHdrfnlshoBzj4l6n5iIsqqYu7Ohw7uov7emtqyfsqebsaaasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rymf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnhHlsmpKCmpSCmpSBn5SBo5SBopSAnI97nI+AnpCCo5aErKGHqZyKqJuKppqKoZWGn5OFioBzWlRKVE9FVE9FVE9FYVxSbGdda2ZcXFdNYVxSlIyB3NLG6uDU6+DU6+DU6+DU6+DU6+DU6+DU6+DU6+DU6+DU6+DU6t/T4NPDt55zqYtVd2A4WkYrXk47Y1ZBaF1GdWtacWhZamFSXFRITkdCTUdCTUdCTUdCTUdCTUdCTUdCTUdCX1pUkIyBlpKHlpKHlpOHlpOHlZKGlZKGjYp9f3tsfnpqenZmdXFgdXBgdG1lamNda2Ndb2dfdGxieHBjf3JaiXJJlXtTc1o/a1k4f2s4p5RUoI5VgHBMdWdIW1Y+WVVAWVVAWlZBWlZBWldBX1xHdXJeeXZiendjeXZieXZieXZibWZQaFtAempJg2pNdmJHblg4m3tLtpBSv6d+uKuTxb2ttKuds6qcs6qbtaybubCeyL+rzsWw0sq1zsayw7qpuK6fs6ibsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngnZqlIx8mZOBm5SBoZSBo5SAoZJ+m497nY+BnpCDppqFrKCHqJuKp5qKppmKoZSGn5OFgXhrVlFHVE9FVE9FVE9FYVxSbGdda2ZcYVxSjYV5zcGy3M+/3M/A3M/A3M/A3M/A3M/A3M/A3M/A3M/A3M/A3M/A3M/A3M+/0MGrsJRpmX5UdmI+ZFE2bF04b2U/a2JBbWVObmVVbGNUYFlNTkhCTUdCTUdCTUdCTUdCTUdCTUdCTUdCYlxVkI2BlZKGlpKGlZKGlZKGlZKGlZKGjYl8e3hodHBeb2pYbWhXbGZXaGFZaGBcaWFdaWFdaWFdamJdbGBSa1k7eWZDgm5AaVY1hm5FpYlPsZVWkXtKdWdEVVA5VlM8WVZAW1hCXFlDXFlDYV5IdXJeeXZiendjendjeXZieXZid3NdcGRKbV9EdmpIcmRMb1w+iWw/r4xOw6Rv07iV1MCs1sa018m22My32M652M+51My4zcaywrqot66es6ibsqeasqeasqeasqeasqebsqebsqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRokIh4mZOBnZSBo5SBo5SAnpF8nI99nY+Cn5GDqZ2Fq5+IqJuKp5qKpZiJoJSGnZGDcmtfVE9FVE9FVE9FVE9FYVxSbGddbWheiIB0xbmp08W108a208a208a208a208a208a208a208a208a208a208a208a208a1yLmipYxifmZEZVQ4ZlQ5dWNAZFk7ZVxEaWFMamJPa2JQYFlMTkhCTUdCTUdCTUdCTUdCTUdCTUdCTUdCaGNbk5CElZKGlZKGlZKGlJGFko+Cjop9g39wbmpYbWhXbWdXbGVXZl5RWVBGZFtVaGBcaGFcaGFcaGBcZlxQYFM3c2NAi3dHaVc7dFo7mXlLspFXqpBed2lIW1Q7VlI8V1Q/WFU/WFU/WFU/XFlEc3BceXZiendjeXZieXZieXZid3JdbmJKa15Gb2NLb2NOX085dV0ztZZXwqJnvqJ0xbCU2Mu12c+52M+61M24zcazw7upu7GhtKmbsaeasaaasaaasaaasqebsqebsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRoj4d3mpOBoJSBo5SBopSAnI97nI+AnZCCoJODq6CGqp6JqJuKp5qKpJiIoJSGm5CCbWZaVE9FVE9FVE9FVE9FYVxSbGZcdWxflop5saORvK+cwLOfxrmkx7qmyLumyLumyLumyLumyLumyLumyLumyLumyLumyLumu6yTjndQcVw9YE84bVk+eGFBZ1k/ZlxHaWFNaWFNaWFOYlpLUEpDTUdCTUdCTUdCTUdCTUdCTUdCTklDcm5lkY6BkI2AjYp8i4d5hoNzg39vgHxrfXloaWRTbGVWa2RWaGFUWFBETkQ6X1VHaWBSaGFXaGFaaGBbY1lKXU4waFg1inVIZFE1Y1A2j3RPs5JZn4ZObl48Ylk/VlI8VFE7VFE7VFE7VFE7VlM9bWpVeXZieXZieXZieXZieHRhcWpZa2BOaFxJX1NAYFNAW0s5aFEsrI5SvJxbxqp0v6yE1s221M25zMezw7yqwbamwrWnt6yfsqebsqeasaaasqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072n072n072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nni4Jzm5OBopSBo5SAoZJ+m497nY+BnpCDo5aErKGHqZyKqJuKp5qKo5aIoJSGlYp9YVtQVE9FVE9FVE9FVU9FYlxRbmRWcmRTdGVTeGlXfm9dhHZikYNtnI93opZ8qZ2BrqKFsKSHsKWHsKSHsKSHsKSHsKSHr6SHoJNzhG9IdWJCbVxDemVNclpAa1lCY1U+Y1lEaWFMaWFNaGBNWlNHTkdCTUdCTUdCTUdCTUdCTUdCUUtFdG9ign5ugX1tf3xrf3tqf3tqfnpofHhmdnJgaWNTZV5RYlpOWFBETkU6TkM5XlJDaF9LaGFPaGFRaGFTaV1JY1Q3Z1QzgGtDfGdCXk8zZ1U4m31HqZBRdmU8aFxAWVQ9VlI8VVI8VVI8VlI9V1M+aWZReXZieXZieXZidnJgbWZaZl1VZVtUXVJJUEQ3UEIzWko6ZU40p4pWs5FRupxjvap51Muzxr6swreny72uyryuuq2hsqebsqebsqebsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NniX9wnpOAo5SBo5SAnpF8nI99nY+CnpCDppqFrKCHqJuKqJuKp5qKopaHn5OFjoR3XFZMVE9FVE9FVlFHbmdZj4JvinpmemtYdGVTcmNRcmNRcmNRcmNRdGVSdmdUe2xYiHljl4dun5B1oZJ2n5F0nI9ymY1vmIxujoFheGZCb1w/aFc/bFs9X004WUo1WEk0Wks2YldCaF9LaWFNZV1MU0xETUdCTEZBTEZBTUdCTUdCVVBJd3Nkfnppf3tqf3tqf3tqf3tqfXloe3hmeXVjaWNUV09EUEc+S0I3TEI3TkM5XVFCZVpGaF9LaGJPaWNRe3JigndmeWlQemZEnIVWdF8+blo9hmtBs5lcoZBcb2I9X1U5WVM8V1I9V1I9V1I9WFE+YVxIdnJeeHVic25eamJYZVtVZVtVZFpUWlBJS0A3TkE1U0Q2ZVE3n4RPr45Pro9WtJ1upJR1zb+u18e4zL2vuKyfsqebsqebsqebs6ebtamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NniX5woJOAo5SAopSAnI97nI+AnY+Cn5GDqZ2Fq5+IqJuKp5qKppqKoZWGn5OFhHtuV1FHVE9FXlhNioBuw7OZ2ceq0sCjv66TrJuDkoJsfm9cdmdUc2RRcmNRcmNRcmNRcmNRdmdUgXBckH1nnYlxoIxznIlvk4BlinZZdmRIallBdWZJgnJQbV9LXlJBV0w6VUk3V0o3XFA9YlhHX1ZGVUxCTUZATEZBTEZBTUZBTkhCY11UfXhpf3pqf3pqf3pqf3tqf3tqf3pqfXhobmlZWVJETkQ7SkE2SkE0TEM4TkQ5XFFBZVlDZltDb2ZScGhXgHdoh35vgndnb19JiXVImINYeGNBel86sZFXoYpQa1w8YVQ6W1I+WFE+WFE+WFE+WFE+WlJAaWRSbmdaZ15WZVtVZVtVZFpUY1pTWE9HSUI3SkI3UkY6Wko2fGM9qItVm39JjnRDnYVhy7eiy7uttqqesqeatamcuaydv6+fxbSiy7ekz7ql0bym0rym0rym0rym0rym0rym0rym072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072n072nf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnh3psn5F+o5SAoZJ+m497nY+BnpCCoJODq6CGqp6JqJuKp5qKppmKoZSGnpKEfHRnWVNJb2haqJuF1MOm3syu3syu3syu3syu3Mut1sSnxrWZs6KJmop0hHRgd2hWc2RScmNRcmNRcmNRdGVSe2pXiXdimYRuoYpyhGxRcl9Jalg8fGxNYlEzbl5Kc2VVZ1tLWU4/UUc5T0Q4T0Q6TUI6TEE5TEE6TEM8TEU/TUZBVk9JeXFmhXtvhHtvhHpug3pug3pug3pug3pugXhscWhcXFNGTkU5SkA0TkQ4UUc7U0k8YVZBXVE3f3JXdmtYb2RTfXRkhX1ugHhpa19NbVw8qJVpaVg7cVs6nXxJnIVPdWVIXlM9WFA+WFA+WFA+WFA+WFE/WVFAXVVHZFtTZVtVZFtUZFpUY1lTWVFJTEY7SUU5SkU6TkQ4WEc6bFQ2oIZTjnNCs5lmx62C2sWpvK2csaKRv66cy7ekz7ql0bym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rym0rymf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnhHhqno99o5SAnpF8nI99nY+CnpCDo5aErKGHqZyKqJuKp5qKpZiJoJSGnZGDenJlioBuw7OZ3Mqs3syu3syu3syu382v3syu3syu3syu3syu3cuu2ceqzLufuaiOpJN8kIBqgHFcd2hVc2RScmNRc2RReGhVh3Nce2NFY1A2aVg2cF5DU0EqZVZEYVZHWE5AUkg7TUM5TEE5TEE5TEE5TEE5TEE5TEE5TEE6UEY/e3Fnn5KGnJCEkYd7jYN3iH1yhHpugnhsgXdrgXdrf3VpbmRYV0w/VUo8Vks+VUo7Wk88a2BGZVg7joBki39mcWZTeHFhgHtsf3prdWxbZ1c7iHdUcmRJZlc6gWo/loRVgXFUYVdBU0s5U0s5VEw7Vk8/WVJEWlRHW1VJYllSZFpUZFpUYVhRVU5FTEg8TEg9TUo/TUk/T0U5V0U1ZE8zhm09p41arJJev6VxwauBzbmdy7Wbzredz7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7iez7ief3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnhHhqno99opSAnI97nI+AnY+CnpCDppqFrKCHqJuKqJuKp5qKpJiIoJSGppmJtaeQ1MOm3syu3syu3syu382v382v382v382v382v382v3syu3syu3syu3syu3syu28qs1cOlybeZtqWIoZF3lYVui3tlhXVefGpPkXpRcV08fWpLa1xEV0g1XlFAUkk8T0Y6TUM5TEE5TEE5TEE5TEE5TEE5TUI6TkQ7UUY9VkxCj4J2saOVsaOVrqGTqp2Qo5eLnJGFlYp/j4R4in9zhnlte29hZFdHYFRFYFREY1ZCeWxVd2tQe21RraGDiX5jfXNafndkhH5xhn9zgXlrZ1k/bFtEgXNaeWxPeGlFmYthgG9RZFdBUUg2U0w8WFJFWlVIW1ZKXFdLYFlNZV1SZVtUX1ZPVE5FTUk+TUo/TUo/TUo/Tko+T0IyUD8rVUUuemVFgmtElX1NuqFsxax6sptswqyEwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fwq2Fw62Fw62Fw62Gxa+IxbCIxrGKyraRf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nng3dqnY58oJJ+m497nY+BnpCCn5GDqZ2Fq5+IqJuKqJuKp5qKpZiJsKKQzr2k3Mqt3syu3syu3syu382v382v382v382v382v382v382v382v382v382v3syu3syu3syu3syu3syu3cur2cal1MKhzLucvq2Po5BqknxNeGJGYU0zXU44V0k2VUo4Ukg6TkM5TEE5TEE5TEE5TUI6TkQ7UUY9Ukg+U0k/U0k/V01Dj4N2saOVsqSWsaOVsaOVsaOVr6GUq56RpZqOn5SJl4uAd2lbdGVUYFJCbmFQaFpFgnRdgHNbiXphoJR4bmRLZ11Fc2pXiIF1hn5zfHRoal1LZlhCeGxQe29McmVBdmdGgW1RaVpFVEw9W1VJX1lMZF1Pa2JTcmhYeW5ceG5dZV1TU05ETko/TUo/TUo/Tks/Tko/Tkg6UEMuUEIrUkQtW0wyY1I2cWA/f2xFinVOoo1no45po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49po49ppZFrqJRvqZVvsp96uKWBuqeExLKQxrSTybeX1sao2Mms2suv49W8f3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngXRol4l4npF8nI99nY+CnpCDoJODq6CGqp6JqJuKqJuLqp2Mu62Y1cSo3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3syu3cus28mo1cOgrphqhm5AaFE5bV1CZFc/XlE9VEg2UEU2TUI5TUI6T0Q7UUY9Ukg+U0k/U0k/VEpAVEpAVEpAV01Dj4N2s6WWtKWXtKWXtKWXtKWXtKWXtKWXs6WXsaOVqp6QhHhoal1LYlRCdWdVb2FLal1GaFlDf3FYtqmMgXZgXlVDZFtMcWhcZFhMWEs+V0k5XVA7XFE1a2A7aV06hHNYkn1klIFpbmNPcGdWd2xbfXJfgnZigXdjenJfc2xbZmBSUU1CTktATUo/TktATks/T0s+U0k2V0kzV0ozWEszWEoyYFA3cGBFeWlOgXJTfm1OgW5Pg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRg3BRhHBRhHBShXJThnNUiXZXjXtdjnxel4VonItvqpp/wbKZxLSc1six4tS949W/6NrG6dzH6dzH697K697K697K697Kf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRolYd2nI97nI+AnY+CnpCDo5aErKGHqZyKqJuLrZ+PwLGb18ap3cut3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3Mqs3MqryreToopXdF42cmJIbF9IbGBLbmJNY1dFVkk9VUk+VUtAVUxBVkxCVkxCVkxCVkxCVkxCVkxCVkxCWE5EiXxvuKiauqqcuqqcuqqcuqqcuqqcuqqcuqqcuqqcs6SWZl1MbWNRdmpYcmZSb2JNZFdCdmlTf3BXwLKXgXdnYFdJXlVIaFtOaVxOaFpNYFNEW044X1I4ZVg6hHVUnItoo5JlqpZsjHlagHRdh3xmhHtlfHRhdG1ccGpacGpabWdXWVVITktATktAT0tAVE5AW1E8XlI6X1I6X1I6XlE5V0oyV0gxX085YVI7ZVk7dGdIkYFjnIxuopBzo5F1pJJ2pZJ2pZN2pZN2pZN2pZN2pZN2pZN3pZN3pZN3ppR4p5V5p5V6rJp/r52CsaCFu6uRvq6Vybqi0MGq1cew3tC739G849bB5tnE6NvG693J697K697K697K697K697K697K697K697K697K7N/L7N/Lf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRnk4Z1m457nY+BnY+CnpCDppqFrKCHqZyLsaSUx7qo1siz2cqz2Mmy1cWr1MSq08Opz76izr2hzLqdyriaybiayLeYyLaYyLaYx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7aXx7WXtaN/g29JZFU2XlQ5aV1LcGNUcGNSZFZHWUtAXlBEZVpQZVtRZVtRZVtRZVtRZltRZlxSaF5TbGJWdWtelop8rZ+TrqCTrqCTrqCTrqCTrqCTrqCTrqCTrqCTp5qNenBha2BQZ1xKZltHcWVQbl9LY1Q/fm5Vr5+GuauXm49/iH5wiHxuf3Jjd2paZFlGX1M8Y1Y5dmU/kn1XnohmrZpkqJVho5JmioBlhn5pdG5ccGpacGpacGpab2lZb2lZZF9RUU1CUU1AXFRCZ1tEal1Eal1Eal1Ea11EbV9GWkwyWko0Wkg1VEMwZVc5fnBOjX9ekIJhl4donIxtpZN2qZd6rJl+rJl+rJp+rZt/sJ6DuKaLvKuQvayRx7edz7+m0sOs3M644dO+4tXA6NrG6dzH6t3J697K697K697K697K697K697K697K697K697K7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/Lf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRnkIRzm459nY+CnpCDn5GDqZ2Gr6OMu66d0MOx2Mu52cy62cy62cy62cy52cy52Mu518m11si00MKszb6oyrylv7GXt6iMsaGEqZl7ppd4pZZ3pJR2o5R1o5R1o5R1o5R1o5R1o5R1o5R1o5R1opN1i3xeVkcxXU85X1Q9YldDbF9Ob2FPZFZFXE1AXU9DYVRKa19Va19Va19VbGBWcmZbfXJkiX5ukod2mpGAnZWGjYJ2iH1xiH1xiH1xiH1xiH1xiH1xiH1xiH1xfnRobmVXXVJDYVdEX1NAdGZSc2RQg3Nfjn1jnY90ybypy7+ww7qupp2Qe3BedWpWcmZTZVlAaFo6gm1JjXRRk3tXnohln4tmhXNMnZN3fHVjcGpacGpacGpacGpacGpab2lZbGdXWVRGXVRBZ1tEa11FbF5Fb2FGcmRIdmlLfXBRiXpZcV9BYUw2alc/d2VEpJJtq5l3sZ5/t6OHuqWKvqiPwKqRw62Vx7KZzLif0sCm2Met3c204tK65Na/6NrF6t3J697K697K697K697K697K697K697K697K7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/Lf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nni39wnI5/nY+CnpCDoZSEtKiQyLun1sm32cy62cy62cy62cy62cy62cy62cy62cy62cy62cy62cy62cy62cy618q41Me0zsGsxLaguqyTsaKHqZp+pZZ5oZJ2n5F0no9zm41ym41xmoxwmYtwmItvgXNcVkk4Vkk3XlE+YFQ/ZllEbF5JaFlDYlJBXk9BYVNIY1ZLYVVKZlpPfXBjjYJxlYp4mY99oJeHrKSWvbaplo2AfHNmfHNmfHNmfHNmfHNmfHNme3Jle3JleXFkaF9SYldHal9OdmlWemtXbFpHf25ainlgp5h+xLmox72xycK4xL6xkol2gHVgc2hTZllCgXNVe2xLjHlZiXZYeGVJcl1Eg3BTnI9wl41zgnpleHFedG1cc2xcc2xcc2xcb2hYWFFDU0w9Vk09WlA/XlI/a11DdGZHemxKfnFMjX9OoZBelX9ajnpbqZNvrZl0v6qOxa+VyLKZyrSbzbmg1MGo2cet3s2z4dG449S85tjB6dvG693J697K697K697K697K697K7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/Lf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NniX1vnI6BnpCDoZOFs6aVz8Ku2cy52cy62cy62cy62s272s272s272s272s272s272s272s272s272cy62cy62cy62cy62cy62cy62Mu41Me0z8Gtx7mjvq+XtqeMsKGFrJyAqpp+ppd7opN2no9xhHZaW045Wkw5ZVZAYVM5Zlg/aFpCaFg/bV5IZFZFYlNHXVBEaV1QhXhqlYl3mI57nJOCpJyNt7Ci0cq93dbJv7iroZuNoJmMoJmMoJmMoJmMn5mLmJGEjYZ6gHhsT0c6YFVGfHFfgnZhe2xXj3tnd2VRbl9Hl4lulot4wrquzsi80s3BubGiiX9rb2VQZFhAfXFTdGdId2hJhHJWgG5UcV1HeGNKmYhopZZ3pZZ5pZd6oZV6oZV8oZV8oZZ8lo10XVZGUUo8UUo8UUo8UUo7U0o6V0o5Xk86bF1AkYJSsJ1slH5XiXNTrZdypZFszLmc1sOn2sit3cux38614dK45NW85tjB6dvG693J697K697K697K697K697K7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/L7N/Lf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnin1xnY+CpZeJvrCh08a02cy62cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62cy62cy62cy62Mu41ce0z8KtyLmjvrCXt6eNsaGGqZl8f3BTXU46fWlSm4BblXpSa1c7jHtZno5teGtRaFtJZlhLdmhbjoFyl4t5mpB+oJeHrKSWxL2w2tPG4dvO5N/T19LGtrGjs66gs66gs66gs66gs66gsayerKaZkYt+amJUal9Ra2BPdmxUj4Rjk39hkoBodmpSbWRKlox2zsa1083A2tPHzMO3opiJe3BdaFxDdGdJaFo8YVI1aFg8c2JHd2RJg29KnoxmsKCAuKiJvKyNva6Ova+Pv7OTwriXtq+RaGFQUUo8UUo8UUk7UUk7UUk7UEg6UUY3Vkg3fW1LqJdrloJge2dKrJp2o5Br2Meq4NC14tK45NW85tjB6dvG693J697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697Kf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nni35yqpyOxrmp18q42cy62cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62cy62cy62cy62Mu41ce00MKuwLGahHVcVUU0gWpTkndRe2RAZlM6fW9Qh3VVf3FYcmZUeGpcfnBilot5nJOCpJyNt7Ci0cq939nM5d/T6eba7Orf4d7TsKyep6KUp6KUp6KUp6KUp6KUp6KUpqGTkYx9eXJib2RWXVFFZVpHdGdMj3ldnItzl4t2bGNQc2taurGgz8a3xr2xsqics6meraOXfnBXZlU2YFAxXk4xZlY3aFk6eGVBgW1FpZNsu6yIva6LvK6KvK6Lv7STxb6cycOk1tC6l5GDVE0/UUo8UUo8UUk7UEk7UEk7UEg6U0o5d2pPp5lsm4logG1UoI9tpJNt1sWq5Na/6NvF6t3I697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697K697Kf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngHRonZCCzL+u2cy62cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu50MOytaiWYFE7UUMta1g/inNShG9Pe2hLdmZJe2pQjX9pfnNhdmtdeG1fmI5/qKGSwLir29TH5N/S6eba7Orf7evg7evg5ePXvbirtK+htK+htK+htK+htK+hs66grqialpGBgXhoc2hYWU5BWU0+WEs2bltEhXVgopaFopiLdWtghnturKGSu6+iqZ+UxLuyycC3nIhqfGM5dVwzclowfGlGc2ZCloNYbFg0inlPuKqBvK6JuqyJu7GPxL2cy8Wo39nG9fLoy8jBYFlMUUo8UUo8UEk8UUo8UUo8UUo8V08/cGVPr6ODxreZkoFlno1tvq6J08et4dfC4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjD4tjDf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnjIBzw7al2cy62cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu60cSytqmYj4JycmVWX1NDWU05ZFVAempTppV/r6CNeWpXc2VRmo57qZ+OioBybWJRin5tw7ut39rN6eba7Orf7evg7evg7evg7evg6efcxsK1t7KktrGjtrGjtrGjsaudpJ+QlZCAiYNygHpnfXRkcmhaYVZKT0M1Wkw9YVVEZFtKsqudp56TeG5hfnRlu6+iurGnyMC5xLuzmYVqkHNJlnlNo4NNcmA9XlIzpZBjb1pBbVs1saJ8vq+OvLCQxL2dzsit4dvK9/Pp/v368O/tiYR6Uks9UUo8UUo8UUo8Uks9WlJFY1xOYFhHsqiU6d3IpZeAm410y8Ck2tO+5N7N5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDO5eDOf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nng3drsKOU1sm42cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu60cSytqmYj4JycmZXZ1tNY1hKYldJXFNFXVNCaV9PrKCSy8K2l41/Z1xKenFe0cq5tK6dY1pHYVdFzMe46OXZ6+nd6+nd6+nd6+nd6+nd6+nd6efbysa5t7KktrGjsaudpJ+QlpCBjoh4iIJxgnxpgntphn1ue3FkZVtRT0Q8UUc9YlpLb2lbp6OYzMe9lIuAkol8wLWpysG4w7qzmI+EZllGhW9OrJRnwah5inpXV0wzmYNakn1VZ1U3o5JxtamIxb6e0cuz49zM9/Pq/v36/v79+vr5s7GqV1FDUks9V1FEXFVJXFZLX1hOYFlPYFpO08zC9u/krKWVlI5+5uDS2NLE4NvN6eXW6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubX6ubXf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnm4+B0MOx2cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu60cSytqmYj4JycmZXZ1tNZFlLY1hKYlhKY1pNXVRGXVZKYVtQjYZ7vreupp+VXVZHa2VXvbiqurWnaGBOaWNRuLan3NzO3d3P3d3P3d3P3d3P3d3P3d3P3dzOyse5sq2epJ+QlpCBjoh4jIZ2iIJwgnxpgXtohH1rh35venFlZVtST0U9UEc+aGFUf3turaqg3dnRu7Wrn5aJwbaqyL6zmI+EX1VFU0g3aVtDmohgs6F1m45tYVE+l35bu6RziHdZemxQvLSTzMav493N9/Pq/v36/Pz77u3sysnHmJaRamVbbGZbfXlwg4B3g4B4g4B4g4B4mZSN6uXd9/XsqKWXnZmL3tnN29XI1M7A4NvN6eXW6ubX6ubX6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fYf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NniHxwvbCg2cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu60cSytqmYj4JycmZXZ1tNZFlLY1hKY1hKYlhKZFtOZFtOX1dLYFpRcmxjmZOLs6ulp6CYdG5hmJOHxcK2x8O4ioR0hoJxzMy92dnL2trM2trM2trM2trM2trM2trM2dnLw8GzmJODjoh4jYd3jIZ2iIJwgnxpgXtogXtohX5thn1ud21iYVdOTkQ8T0Y9aWJWh4R4r6yi39vT0s3Ep56SvLGknpKFYFRFU0c3UkY2WEs5j4BgtKN9nI5zZlZGgGtRvquGp5qAbmRPjoNswrmp9fHn/fz47u7sysnHoqCdjYuHiIaChoN9iYZ+iod/iod/iod/iod/iod/npmS5+Lb9vPrp6SWmJSGxMC03dfK0su+1M7A4NvN6eXW6ubX6ubX6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fYf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NngnZpqJyN1ci22cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy62Mu60cSytqmYj4JycmZXZ1tNZFlLZFlLY1hKY1hKYlhKZFtOZFtOZFtPYVpQZ2FYi4V9o5yVsquksKihnJeMt7Ony8i9zMm+ubWpt7an2NfJ2dnL2dnL2trM2trM2trM2trM2trM2dnLyMe4lZCAjYd3jIZ2iIJwgnxpgXtogXtogXtohn5uhHttc2pfWlBITkQ8T0U9a2VajYt/r6yi39vT2dTMq6KWmo6AY1ZGVUg4VUc3U0Y3UEQ1cGRQpJR4npF8b2RUbF9MqZyEysGwjIR1cGRQgndo6ufg4uHdp6WijYuHiIaCiIaCiIaBiIaBioeAioeAiod/i4iAiod/iod/npmS5+Lb9fDopqOVl5OFsq6h0s3A0sy/0su+1M7A4NvN6eXW6ubX6ubX6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fYf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnlYl8zL+u2cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62cy62cy60cSytqmYj4JycmZXZ1tNZFlLZFlLZFlLY1hKY1hKYlhKZFtOZFtOZFtPY1tPY11UfnhwnZeQpJ2Wsqulta2msKqhxsO3zMm+zMm+zcq+1NPG2dnL2dnL2trM2trM2trM2trM2trM2trM2dnLzs2/mZSEjIZ2iIJwgnxpgXtogXtogXtogntph39vgXhqbmVbVEpCTkQ8T0Y9cWxhkI6Dr6yj39vT3trRpJuQZ1pLU0Y2UkU2UUU1TUM1SkQ4YFdJjH9t28/BraSWhn5tqaGR9/DnzMS4enBfg3tv3drUoqCciYeDiIaCiIaCiIaCiIaBiIaBioeAioeAi4iAi4iAiod/iod/npmS5+Lb9O/opqGUl5OFrKicvLir0Mm80cq90su+1M7A4NvN6eXW6ubX6ubX6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fYf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3Nnf3NnhXlsuq6e2Mu52cy62cy62s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272s272cy62Mu5vrGgkYR0c2ZXZ1tNZFlLZFlLZFlLZFlLY1hKY1hKYlhKZFtOZFtOZFtPZFtPYltRbmdfl5GJoJqTpJ2Wsqultq6ov7qxzMm+zMm+zcq/zcq/1dTH2dnL2trM2trM2trM2trM2trM2trM2trM2dnL09PFop6PiYNxgnxpgXtogXtogXtogXtog3xqh39vfnVoaV9VUEY+TkQ8UEY+d3JokY+Er6yj39vT3dnRi4F0VEc3UkU2UUU1TUI1S0I1TUg7bmVXtKqc9uzg1Mu+mZKCr6mb9e/n5d3UgHdpnpeL4N3XmZeUiIaCiIaCiIaCiIaCiIaBiIaBiYeAioeAi4iAi4iAiod/iod/npmS5+Lb9O/opqGUl5OFq6ebr6ufx8G00cq90su+0su+1M7A4t3O6ubX6ubX6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY6+fY"
  }
});
