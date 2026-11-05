/**
 * Helmep — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/helmep.jpeg
 * (vistas de frente, perfil y espalda, casco, caras, hombrera, faldón, brazal, guante y bota).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), cuerpo corto y
 * piernas cortas rectas y juntas.
 *   casco dorado acanalado con cresta central y dos nervios, carrilleras que tapan las orejas y visera
 *   oscura y brillante delante de los ojos (se ven la nariz y la boca); pelo castaño asomando por la nuca
 *   → túnica morada: peto con correa negra cruzada y volutas doradas, corsé negro con franjas doradas,
 *     cuello alto abierto en V con ribete dorado y faldones abiertos sobre un delantal negro
 *   → hombreras moradas en dos capas con borde dorado, manga corta negra, brazales morados ribeteados y
 *     guantes negros sin dedos
 *   → cinturón negro con hebilla plateada, faja negra cruzada en la cadera y bolsa
 *   → pantalón negro ancho y botas oscuras con doblez ribeteado, correa al tobillo y placa dorada en la puntera.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'helmep',
  categoria: 'personajes',
  nombre: 'Helmep (chibi)',
  icono: '⚔️',
  origen: 'assets/personajes 3d/helmep.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.112;                              // separación de piernas y botas desde el centro
    // Cada pieza se apunta al hueso que la moverá (ver ESQUELETO al final)
    const PARTES = {};
    const poner = (h, obj) => { if (obj) (PARTES[h] = PARTES[h] || []).push(obj); };

    // ---------------- utilidades ----------------
    const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
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
    // Loft vertical [y, rx, rz, cx, cz] (de abajo arriba) con abertura frontal opcional (semiancho w(y))
    function loftAbierto(secciones, abertura, opts = {}) {
      const S = secciones.map(([y, rx, rz, cx = 0, cz = 0]) => [y, rx, rz, cx, cz]);
      const sub = M.seg(opts.subdiv || 6, 1);
      const filas = [];
      for (let i = 0; i < S.length - 1; i++) {
        for (let k = 0; k < sub; k++) {
          const t = k / sub;
          const e = t * t * (3 - 2 * t);
          filas.push(S[i].map((v, j) => v + (S[i + 1][j] - v) * (j === 0 ? t : e)));
        }
      }
      filas.push(S[S.length - 1]);
      filas.reverse();
      const cols = M.seg(opts.segRadio || 64, 10);
      const pos = [];
      filas.forEach(([y, rx, rz, cx, cz]) => {
        const th0 = abertura ? Math.asin(Math.min(0.98, M.interp(abertura, y) / Math.max(rx, 1e-3))) : 0;
        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          const th = abertura ? th0 + u * (2 * Math.PI - 2 * th0) : Math.PI + u * Math.PI * 2;
          pos.push(cx + rx * Math.sin(th), y, cz + rz * Math.cos(th));
        }
      });
      return rejilla(pos, cols, filas.length - 1, opts.nombre || 'Loft');
    }
    // Elipsoide (p = 1) o caja redondeada (p < 1)
    function bloque(cx, cy, cz, hx, hy, hz, p, nombre) {
      const sW = M.seg(28, 8);
      const sH = M.seg(20, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const a = geo.attributes.position;
      const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), p);
      for (let i = 0; i < a.count; i++) a.setXYZ(i, cx + f(a.getX(i)) * hx, cy + f(a.getY(i)) * hy, cz + f(a.getZ(i)) * hz);
      return M.pieza(geo, nombre, sW, sH);
    }
    // Pegar detalles a una superficie con rayos (de frente: lado = 1; desde atrás: lado = -1)
    const rayo = new THREE.Raycaster();
    function sobre(obj, x, y, lado = 1, despegue = 0) {
      obj.updateMatrixWorld(true);
      rayo.set(V(x, y, lado * 3), V(0, 0, -lado));
      const h = rayo.intersectObject(obj, false)[0];
      if (!h) return null;
      const n = h.face.normal.clone();
      if (n.z * lado < 0) n.negate();
      return h.point.clone().addScaledVector(n, despegue);
    }
    // Prenda sólida con grosor: capa exterior + interior unidas por el bajo, el borde de arriba y los
    // dos bordes de la abertura delantera (nada queda suelto ni hueco). Devuelve las piezas.
    function prendaSolida(secciones, abertura, grosor, opts = {}) {
      const S = secciones.map(([y, rx, rz, cx = 0, cz = 0]) => [y, rx, rz, cx, cz]);
      const sub = M.seg(opts.subdiv || 6, 1);
      const filas = [];
      for (let i = 0; i < S.length - 1; i++) {
        for (let k = 0; k < sub; k++) {
          const t = k / sub;
          const e = t * t * (3 - 2 * t);
          filas.push(S[i].map((v, j) => v + (S[i + 1][j] - v) * (j === 0 ? t : e)));
        }
      }
      filas.push(S[S.length - 1]);
      filas.reverse();
      const C = M.seg(opts.segRadio || 64, 10);
      const ext = [];
      const int = [];
      filas.forEach(([y, rx, rz, cx, cz]) => {
        const th0 = abertura ? Math.asin(Math.min(0.98, M.interp(abertura, y) / Math.max(rx, 1e-3))) : 0;
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const th = abertura ? th0 + u * (2 * Math.PI - 2 * th0) : Math.PI + u * Math.PI * 2;
          fe.push([cx + rx * Math.sin(th), y, cz + rz * Math.cos(th)]);
          fi.push([cx + (rx - grosor) * Math.sin(th), y, cz + (rz - grosor) * Math.cos(th)]);
        }
        ext.push(fe);
        int.push(fi);
      });
      const R = filas.length;
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      const piezas = [rejilla(pos, C, vuelta.length - 1, opts.nombre || 'Prenda')];
      piezas[0].userData.capas = { cols: C, exteriores: R };   // filas R..2R−1 = cara interior (forro)
      piezas[0].userData.filasExt = ext;                         // capa de fuera (para ribetes)
      if (abertura) {
        [0, C].forEach((c, k) => {
          const borde = [];
          for (let r = 0; r < R; r++) borde.push(...ext[r][c], ...int[r][c]);
          piezas.push(rejilla(borde, 1, R - 1, (opts.nombre || 'Prenda') + (k ? 'BordeDerecho' : 'BordeIzquierdo')));
        });
      }
      return piezas;
    }
    // Prenda sólida que cubre solo un arco (de angIni(y, rx) a angFin(y, rx); 0 = delante, π = detrás): faldones
    // abiertos delante y detrás. Capa de fuera + de dentro unidas por arriba, por el bajo y por los dos bordes.
    function prendaArco(secciones, angIni, angFin, grosor, opts = {}) {
      const S = secciones.map(([y, rx, rz, cx = 0, cz = 0]) => [y, rx, rz, cx, cz]);
      const sub = M.seg(opts.subdiv || 6, 1);
      const filas = [];
      for (let i = 0; i < S.length - 1; i++) {
        for (let k = 0; k < sub; k++) {
          const t = k / sub;
          const e = t * t * (3 - 2 * t);
          filas.push(S[i].map((v, j) => v + (S[i + 1][j] - v) * (j === 0 ? t : e)));
        }
      }
      filas.push(S[S.length - 1]);
      filas.reverse();
      const C = M.seg(opts.segRadio || 48, 8);
      const ext = [];
      const int = [];
      filas.forEach(([y, rx, rz, cx, cz]) => {
        const a0 = angIni(y, rx);
        const a1 = angFin(y, rx);
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const th = a0 + (a1 - a0) * (c / C);
          fe.push([cx + rx * Math.sin(th), y, cz + rz * Math.cos(th)]);
          fi.push([cx + (rx - grosor) * Math.sin(th), y, cz + (rz - grosor) * Math.cos(th)]);
        }
        ext.push(fe);
        int.push(fi);
      });
      const R = filas.length;
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      const nombre = opts.nombre || 'Prenda';
      const piezas = [rejilla(pos, C, vuelta.length - 1, nombre)];
      piezas[0].userData.capas = { cols: C, exteriores: R };
      [0, C].forEach((c, k) => {
        const borde = [];
        for (let r = 0; r < R; r++) borde.push(...ext[r][c], ...int[r][c]);
        piezas.push(rejilla(borde, 1, R - 1, nombre + (k ? 'BordeDerecho' : 'BordeIzquierdo')));
      });
      return { piezas, ext, int };
    }
    // Parche sólido (cuello y bolsillos): cara de arriba + paredes laterales hasta la superficie de la prenda
    function parcheSolido(obj, esquinas, despegue, nu, nv, nombre) {
      const [A, B, C, D] = esquinas;
      const arriba = [];
      const base = [];
      for (let iv = 0; iv <= nv; iv++) {
        const fa = [];
        const fb = [];
        for (let iu = 0; iu <= nu; iu++) {
          const u = iu / nu;
          const v = iv / nv;
          const x = (A[0] + (B[0] - A[0]) * u) * (1 - v) + (D[0] + (C[0] - D[0]) * u) * v;
          const y = (A[1] + (B[1] - A[1]) * u) * (1 - v) + (D[1] + (C[1] - D[1]) * u) * v;
          fa.push(sobre(obj, x, y, 1, despegue) || V(x, y, 0));
          fb.push(sobre(obj, x, y, 1, 0.001) || V(x, y, 0));
        }
        arriba.push(fa);
        base.push(fb);
      }
      const grupo = new THREE.Group();
      const plano = (filas) => { const p = []; filas.forEach((f) => f.forEach((q) => p.push(q.x, q.y, q.z))); return p; };
      grupo.add(rejilla(plano(arriba), nu, nv, nombre));
      grupo.add(rejilla(plano(base), nu, nv, nombre + 'Base'));            // cara de abajo, apoyada en la prenda
      const pared = (a, b) => { const p = []; a.forEach((q, i) => p.push(q.x, q.y, q.z, b[i].x, b[i].y, b[i].z)); return p; };
      const columna = (m, iu) => m.map((f) => f[iu]);
      [[arriba[0], base[0]], [arriba[nv], base[nv]], [columna(arriba, 0), columna(base, 0)], [columna(arriba, nu), columna(base, nu)]]
        .forEach(([a, b], k) => grupo.add(rejilla(pared(a, b), 1, a.length - 1, `${nombre}Pared${k + 1}`)));
      return grupo;
    }
    // Marco local sobre una superficie: origen en el punto tocado y eje Z según la normal (rasgos de la cara)
    function marco(obj, origen, dir) {
      obj.updateMatrixWorld(true);
      rayo.set(origen, dir);
      const h = rayo.intersectObject(obj, false)[0];
      if (!h) return null;
      const n = h.face.normal.clone();
      if (n.dot(dir) > 0) n.negate();
      const grupo = new THREE.Group();
      grupo.position.copy(h.point);
      grupo.quaternion.setFromUnitVectors(V(0, 0, 1), n);
      return grupo;
    }
    // Almendra (ojo): elipsoide con las esquinas afiladas
    function almendra(hx, hy, hz, nombre) {
      const sW = M.seg(28, 10);
      const sH = M.seg(18, 8);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        const pin = 1 - 0.45 * x * x;
        a.setXYZ(i, x * hx, a.getY(i) * hy * pin, a.getZ(i) * hz * (0.6 + 0.4 * pin));
      }
      return M.pieza(geo, nombre, sW, sH);
    }
    // Tira plana de ancho constante (correas): grosor hacia fuera del cuerpo
    function tira(puntos, ancho, grosor, nombre) {
      const curva = M.curva(puntos);
      const Ls = M.seg(24, 6);
      const C = M.seg(12, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= Ls; i++) {
        const t = i / Ls;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        const N = V(P.x * 0.6, 0, P.z + 0.02).normalize();
        N.addScaledVector(T, -N.dot(T)).normalize();
        const B = T.clone().cross(N).normalize();
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          const k = Math.pow(Math.abs(sn), 0.25) * Math.sign(sn);        // sección casi rectangular
          pos.push(P.x + N.x * grosor * 0.5 * c + B.x * ancho * 0.5 * k,
            P.y + N.y * grosor * 0.5 * c + B.y * ancho * 0.5 * k,
            P.z + N.z * grosor * 0.5 * c + B.z * ancho * 0.5 * k);
        }
      }
      return rejilla(pos, C, Ls, nombre);
    }
    const costura = (pts, nombre = 'Costura', r = 0.0022) => (pts.length > 1 ? M.tubo(pts, r, r, { segLargo: Math.max(6, pts.length * 5), segRadio: 6, nombre }) : null);

    // ---------------- CABEZA: cara ancha y casi cuadrada, barbilla plana ----------------
    const CRANEO = { x: 0, y: 1.0, z: 0, rx: 0.235, ry: 0.21, rz: 0.215 };
    const cabeza = (() => {
      const sW = M.seg(56, 12);
      const sH = M.seg(40, 10);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const a = geo.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i);
        let y = a.getY(i);
        let z = a.getZ(i);
        if (y < 0) {
          const s = Math.pow(-y, 1.8);
          x *= 1 - 0.16 * s;                                   // mandíbula ancha
          z *= 1 - 0.1 * s;
        }
        x *= 1 + 0.03 * Math.exp(-(((y + 0.4) / 0.25) ** 2));  // mofletes
        if (z > 0.55) z = 0.55 + (z - 0.55) * 0.65;             // cara plana de frente
        if (y < -0.82) y = -0.82 + (y + 0.82) * 0.45;           // barbilla plana
        a.setXYZ(i, x * CRANEO.rx, CRANEO.y + y * CRANEO.ry, z * CRANEO.rz);
      }
      const malla = M.pieza(geo, 'Cabeza', sW, sH);
      // Sombreado tipo anime: se giran hacia delante solo las normales de la cara (la forma no cambia)
      const N = geo.attributes.normal;
      const P = geo.attributes.position;
      const centro = V(0, 0.74, -0.3);
      const n = V(0, 0, 0);
      const d = V(0, 0, 0);
      for (let i = 0; i < N.count; i++) {
        n.fromBufferAttribute(N, i);
        const w = suave(0.1, 0.5, n.z) * (1 - suave(0.9, 0.99, -n.y));
        if (w <= 0) continue;
        d.fromBufferAttribute(P, i).sub(centro).normalize();
        n.lerp(d, w).normalize();
        N.setXYZ(i, n.x, n.y, n.z);
      }
      return malla;
    })();
    poner('Cabeza', cabeza);
    poner('Cuello', M.tubo([[0, 0.72, -0.01], [0, 0.8, -0.005], [0, 0.86, 0]], 0.064, 0.06, { segLargo: 6, segRadio: 28, nombre: 'Cuello' }));

    const deFrente = (x, y) => marco(cabeza, V(x, y, 3), V(0, 0, -1));
    LADOS.forEach((s) => {
      // Ojo grande por capas: almendra, iris ámbar, pupila, brillos, línea de pestañas gruesa
      const ojo = deFrente(s * 0.105, 0.87);
      if (ojo) {
        const blanco = almendra(0.058, 0.038, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);
        ojo.add(bloque(-s * 0.008, -0.003, 0.0045, 0.029, 0.035, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.008, -0.004, 0.0105, 0.013, 0.019, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.016, 0.01, 0.0135, 0.0075, 0.0075, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(s * 0.002, -0.017, 0.012, 0.0042, 0.0042, 0.0035, 1, 'BrilloOjoPequeno'));
        ojo.add(M.tubo([[-s * 0.058, -0.006, 0.007], [-s * 0.036, 0.022, 0.009], [0, 0.034, 0.009], [s * 0.036, 0.031, 0.009], [s * 0.062, 0.012, 0.007], [s * 0.074, 0.016, 0.005]],
          0.0095, 0.0045, { segLargo: 24, segRadio: 10, nombre: 'Pestanas' }));
        ojo.add(M.tubo([[-s * 0.044, -0.026, 0.005], [0, -0.034, 0.006], [s * 0.046, -0.027, 0.005]], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));
        poner('Cabeza', ojo);
      }
      // Ceja algo inclinada hacia el centro (gesto serio)
      const ceja = deFrente(s * 0.104, 0.918);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.034, -0.007, 0.007], [-s * 0.004, 0.0, 0.009], [s * 0.036, 0.004, 0.007]], 0.0095, 0.0062, { segLargo: 12, segRadio: 10, nombre: 'Ceja' }));
        poner('Cabeza', ceja);
      }
      // Oreja a la altura de los ojos, con su pliegue interior
      const oreja = marco(cabeza, V(s * 1, 0.875, -0.012), V(-s, 0, 0));
      if (oreja) {
        oreja.add(bloque(0, 0, 0.004, 0.026, 0.042, 0.014, 1, 'Oreja'));
        oreja.add(M.tubo([[s * -0.006, 0.028, 0.013], [s * 0.012, 0.02, 0.015], [s * 0.015, 0, 0.015], [s * 0.009, -0.021, 0.014], [s * -0.004, -0.028, 0.012]],
          0.0042, 0.0035, { segLargo: 14, segRadio: 8, nombre: 'PliegueOreja' }));
        poner('Cabeza', oreja);
      }
    });
    // Nariz recta y boca pequeña y seria
    const nariz = deFrente(0, 0.846);
    if (nariz) {
      nariz.add(bloque(0, 0.002, 0.002, 0.011, 0.013, 0.009, 1, 'Nariz'));
      poner('Cabeza', nariz);
    }
    const boca = deFrente(0, 0.826);
    if (boca) {
      boca.add(M.tubo([[-0.017, 0.001, 0.002], [0, -0.0015, 0.003], [0.017, 0.001, 0.002]], 0.0032, 0.003, { segLargo: 14, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- CASCO DORADO CON CRESTA Y VISERA OSCURA (pelo castaño solo asoma por la nuca) ----------------
    function hastaCraneo(o, u) {                                  // distancia desde o hasta el cráneo en la dirección u
      const ox = (o.x - CRANEO.x) / CRANEO.rx;
      const oy = (o.y - CRANEO.y) / CRANEO.ry;
      const oz = (o.z - CRANEO.z) / CRANEO.rz;
      const ux = u.x / CRANEO.rx;
      const uy = u.y / CRANEO.ry;
      const uz = u.z / CRANEO.rz;
      const A = ux * ux + uy * uy + uz * uz;
      const B = 2 * (ox * ux + oy * uy + oz * uz);
      const Cc = ox * ox + oy * oy + oz * oz - 1;
      return (-B + Math.sqrt(Math.max(0, B * B - 4 * A * Cc))) / (2 * A);
    }
    // Púa de pelo: cono aplanado (ancho alrededor de la cabeza, delgado hacia fuera) que acaba en punta
    function pua(raiz, dir, largo, ancho, grosor, ladeo, fi, nombre) {
      const tg = V(Math.cos(fi), 0, -Math.sin(fi));                     // tangente horizontal alrededor de la cabeza
      const p1 = raiz.clone().addScaledVector(dir, largo * 0.5);
      const p2 = raiz.clone().addScaledVector(dir, largo).addScaledVector(tg, ladeo * largo).add(V(0, -0.15 * largo * Math.abs(ladeo), 0));
      const curva = M.curva([raiz, p1, p2]);
      const Ls = M.seg(16, 4);
      const C = M.seg(12, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= Ls; i++) {
        const t = i / Ls;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        let A1 = tg.clone().addScaledVector(T, -tg.dot(T));
        if (A1.lengthSq() < 1e-4) A1 = V(1, 0, 0);
        A1.normalize();
        const A2 = T.clone().cross(A1).normalize();
        const a = Math.max(0.0008, ancho * 0.5 * Math.pow(1 - t, 1.1) * (1 + 0.25 * Math.sin(Math.PI * t * 0.8)));
        const b = Math.max(0.0008, grosor * 0.5 * Math.pow(1 - t, 0.85));
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          pos.push(P.x + A1.x * a * Math.cos(th) + A2.x * b * Math.sin(th),
            P.y + A1.y * a * Math.cos(th) + A2.y * b * Math.sin(th),
            P.z + A1.z * a * Math.cos(th) + A2.z * b * Math.sin(th));
        }
      }
      return rejilla(pos, C, Ls, nombre);
    }
    const CASCO = { y: 1.02, z: -0.012, rx: 0.276, ry: 0.252, rz: 0.268 };
    // Borde inferior del casco según el ángulo alrededor (0 = frente, π = nuca): alto sobre la visera,
    // carrilleras que bajan tapando las orejas hasta la mandíbula y nuca protegida
    const BORDE_CASCO = [[0, 0.962], [0.82, 0.958], [0.98, 0.91], [1.08, 0.842], [1.6, 0.826], [2.3, 0.838], [Math.PI, 0.852]];
    poner('Cabeza', (() => {
      const C = M.seg(112, 24);
      const NR = M.seg(44, 12);
      const O = V(0, CASCO.y, CASCO.z);
      const ext = [];
      const int = [];
      for (let i = 0; i <= NR; i++) { ext.push([]); int.push([]); }
      for (let c = 0; c <= C; c++) {
        const fi = -Math.PI + (2 * Math.PI * c) / C;
        const thB = Math.acos(Math.max(-0.99, Math.min(0.99, (M.interp(BORDE_CASCO, Math.abs(fi)) - CASCO.y) / CASCO.ry)));
        for (let i = 0; i <= NR; i++) {
          const th = thB * Math.pow(i / NR, 0.9);
          const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
          // acanalado: costillas que bajan desde la cresta (más marcadas arriba y en la nuca)
          const k = 1 + 0.018 * Math.pow(Math.max(0, Math.cos(fi * 9)), 6) * suave(0.25, 0.7, th) * (1 - suave(1.3, 1.7, th)) * suave(0.5, 1.2, Math.abs(fi))
            + 0.012 * suave(thB - 0.12, thB, th);                          // reborde grueso en el filo
          const pe = V(u.x * CASCO.rx * k, CASCO.y + u.y * CASCO.ry * k, CASCO.z + u.z * CASCO.rz * k);
          const dir = pe.clone().sub(O).normalize();
          ext[i].push(pe);
          int[i].push(O.clone().addScaledVector(dir, hastaCraneo(O, dir) + 0.004));
        }
      }
      const filas = [...ext, ...int.slice().reverse()];
      const pos = [];
      filas.forEach((fila) => fila.forEach((p) => pos.push(p.x, p.y, p.z)));
      return rejilla(pos, C, filas.length - 1, 'Casco');
    })());
    // Cresta central y dos nervios laterales: aleta que sigue el casco de la frente a la nuca
    function cresta(x0, alto, ancho, a0, a1, nombre) {
      const Ls = M.seg(48, 10);
      const Cs = M.seg(14, 6);
      const esc = Math.sqrt(Math.max(0, 1 - (x0 / CASCO.rx) ** 2));
      const pos = [];
      for (let i = 0; i <= Ls; i++) {
        const t = i / Ls;
        const a = a0 + (a1 - a0) * t;                                    // ángulo desde arriba (+ hacia delante)
        const P = V(x0, CASCO.y + CASCO.ry * esc * Math.cos(a), CASCO.z + CASCO.rz * esc * Math.sin(a));
        const n = V(0, Math.cos(a) / CASCO.ry, Math.sin(a) / CASCO.rz).normalize();
        const h = alto * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * t), 0.6));
        for (let j = 0; j <= Cs; j++) {
          const th = (j / Cs) * Math.PI * 2;
          const q = P.clone().addScaledVector(n, h * (0.3 + 0.7 * Math.cos(th)));
          q.x += ancho * 0.5 * Math.sin(th);
          pos.push(q.x, q.y, q.z);
        }
      }
      return rejilla(pos, Cs, Ls, nombre);
    }
    poner('Cabeza', cresta(0, 0.05, 0.028, 1.72, -2.15, 'Cresta'));
    LADOS.forEach((s) => poner('Cabeza', cresta(s * 0.07, 0.022, 0.016, 1.45, -1.9, 'Cresta')));
    // Visera oscura y brillante delante de los ojos, inclinada; sus extremos se esconden bajo las carrilleras
    poner('Cabeza', (() => {
      const R = M.seg(14, 6);
      const C = M.seg(64, 16);
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const t = r / R;
        const y = 0.966 + (0.834 - 0.966) * t;
        const rx = 0.258 + (0.236 - 0.258) * t;
        const rz = 0.25 + (0.206 - 0.25) * t + 0.012 * Math.sin(Math.PI * t);
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const th = -1.2 + 2.4 * (c / C);
          const f = 1 - 0.07 * suave(0.85, 1.2, Math.abs(th));
          fe.push([rx * f * Math.sin(th), y, -0.012 + rz * f * Math.cos(th)]);
          fi.push([(rx - 0.006) * f * Math.sin(th), y, -0.012 + (rz - 0.006) * f * Math.cos(th)]);
        }
        ext.push(fe);
        int.push(fi);
      }
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      return rejilla(pos, C, vuelta.length - 1, 'Visera');
    })());
    // Pelo castaño que asoma bajo el casco por la nuca
    const azar = M.azar(53);
    [2.35, 2.65, 2.95, -3.0, -2.7, -2.4].forEach((fi) => {
      const th = 2.05;
      const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
      const raiz = V(u.x * CRANEO.rx * 0.98, CRANEO.y + u.y * CRANEO.ry * 0.98, CRANEO.z + u.z * CRANEO.rz * 0.98);
      const dir = V(u.x * 0.5, -1, u.z * 0.5).normalize();
      poner('Cabeza', pua(raiz, dir, 0.06 + 0.025 * azar(), 0.075, 0.03, (azar() - 0.5) * 0.8, fi, 'Pelo'));
    });

    // ---------------- TÚNICA MORADA: peto, corsé negro con franjas doradas, correa cruzada y cuello alto ----------------
    const TUNICA = [
      [0.44, 0.19, 0.142], [0.52, 0.188, 0.14], [0.6, 0.19, 0.145], [0.68, 0.196, 0.151],
      [0.72, 0.19, 0.145], [0.755, 0.175, 0.13], [0.78, 0.142, 0.11], [0.8, 0.092, 0.086]
    ];
    prendaSolida(TUNICA, null, 0.011, { segRadio: 84, subdiv: 6, nombre: 'Tunica' }).forEach((p) => poner('Pecho', p));
    const molde = loftAbierto(TUNICA, null, { segRadio: 84, subdiv: 6, nombre: 'MoldeTunica' });
    const enMolde = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    // corsé negro sobre la cintura, del cinturón al peto, con franjas doradas verticales
    const CORSE = [[0.462, 0.199, 0.151], [0.53, 0.197, 0.149], [0.598, 0.199, 0.153]];
    prendaSolida(CORSE, null, 0.008, { segRadio: 84, subdiv: 4, nombre: 'Corse' }).forEach((p) => poner('Pecho', p));
    const enCorse = (x, y, lado) => {
      const rx = M.interp(CORSE.map((f) => [f[0], f[1]]), y);
      const rz = M.interp(CORSE.map((f) => [f[0], f[2]]), y);
      return V(x, y, lado * (rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + 0.0025));
    };
    [-0.13, -0.075, -0.03, 0.03, 0.075, 0.13].forEach((x) => [1, -1].forEach((lado) => {
      if (lado < 0 && Math.abs(x) < 0.05) return;
      poner('Pecho', M.tubo([0.47, 0.5, 0.54, 0.59].map((y) => enCorse(x, y, lado)), 0.0042, 0.0042, { segLargo: 12, segRadio: 6, nombre: 'Ribete' }));
    }));
    poner('Pecho', M.aro(0, 0.601, 0, 0.202, 0.156, 0.0058, 'Ribete'));                          // borde inferior del peto
    // correa negra cruzada sobre el peto (del hombro izquierdo a la cintura derecha) con remaches
    const correa = enMolde([[0.15, 0.765], [0.1, 0.725], [0.04, 0.685], [-0.03, 0.65], [-0.1, 0.622], [-0.165, 0.606]], 1, 0.006);
    poner('Pecho', tira(correa, 0.024, 0.006, 'Correa'));
    [0.1, -0.1].forEach((x) => {
      const p = sobre(molde, x, x > 0 ? 0.725 : 0.622, 1, 0.011);
      if (p) poner('Pecho', bloque(p.x, p.y, p.z, 0.006, 0.006, 0.003, 1, 'Remache'));
    });
    // volutas doradas en el pecho, junto a los hombros
    LADOS.forEach((s) => {
      const c = [s * 0.118, 0.738];
      const pts = [];
      for (let k = 0; k <= 26; k++) {
        const t = k / 26;
        const a = Math.PI * 0.5 + s * t * Math.PI * 3;
        const r = 0.024 * (1 - 0.82 * t);
        pts.push([c[0] + r * Math.cos(a) * s, c[1] + r * Math.sin(a)]);
      }
      const cola = [[c[0] + s * 0.012, c[1] + 0.06], [c[0] + s * 0.004, c[1] + 0.04], [c[0], c[1] + 0.024]];
      poner('Pecho', M.tubo(enMolde([...cola, ...pts.slice(1)], 1, 0.004), 0.0045, 0.003, { segLargo: 90, segRadio: 8, nombre: 'Voluta' }));
    });
    // cuello alto morado abierto en V (negro por dentro) con ribete dorado
    const cuelloAlto = prendaSolida([[0.765, 0.1, 0.088, 0, -0.004], [0.795, 0.097, 0.086, 0, -0.006], [0.826, 0.093, 0.082, 0, -0.008]],
      [[0.765, 0.03], [0.826, 0.052]], 0.009, { segRadio: 60, subdiv: 4, nombre: 'CuelloAlto' });
    cuelloAlto.forEach((p) => poner('Pecho', p));
    poner('Pecho', M.tubo(cuelloAlto[0].userData.filasExt[0].filter((_, k) => k % 3 === 0).map(([x, y, z]) => V(x * 1.02, y - 0.002, z * 1.02 - 0.0002)),
      0.006, 0.006, { segLargo: 80, segRadio: 8, nombre: 'Ribete' }));

    // Faldones morados hasta la rodilla, abiertos delante sobre un delantal negro y con abertura detrás; ribete dorado
    const FALDON = [[0.262, 0.236, 0.19], [0.3, 0.225, 0.178], [0.4, 0.208, 0.16], [0.485, 0.195, 0.147]];
    const ABRE_DEL = [[0.262, 0.084], [0.33, 0.074], [0.42, 0.056], [0.485, 0.034]];
    const ABRE_TRAS = [[0.262, 0.032], [0.31, 0.016], [0.36, 0.003], [0.485, 0.003]];
    const ang = (tabla, y, rx) => Math.asin(Math.min(0.98, M.interp(tabla, y) / Math.max(rx, 1e-3)));
    LADOS.forEach((s) => {
      const { piezas, ext, int } = prendaArco(FALDON,
        (y, rx) => (s > 0 ? ang(ABRE_DEL, y, rx) : Math.PI + ang(ABRE_TRAS, y, rx)),
        (y, rx) => (s > 0 ? Math.PI - ang(ABRE_TRAS, y, rx) : 2 * Math.PI - ang(ABRE_DEL, y, rx)),
        0.01, { segRadio: 48, subdiv: 6, nombre: 'Faldon' });
      piezas.forEach((p) => poner('Cadera', p));
      const R = ext.length;
      const C = ext[0].length - 1;
      const medio = (r, c, baja = 0) => V((ext[r][c][0] + int[r][c][0]) / 2, (ext[r][c][1] + int[r][c][1]) / 2 - baja, (ext[r][c][2] + int[r][c][2]) / 2);
      const cDel = s > 0 ? 0 : C;
      const cTras = s > 0 ? C : 0;
      const filas = (c) => Array.from({ length: R }, (_, r) => medio(r, c));
      const bajo = [];
      for (let c = 0; c <= C; c += 2) bajo.push(medio(R - 1, c, 0.002));
      [filas(cDel), bajo, filas(cTras).filter((p) => p.y < 0.37)].forEach((pts) => {
        if (pts.length > 1) poner('Cadera', M.tubo(pts, 0.0072, 0.0072, { segLargo: pts.length * 3, segRadio: 8, nombre: 'Ribete' }));
      });
    });
    const DELANTAL = [[0.272, 0.074, 0.006, 0, 0.156], [0.3, 0.074, 0.006, 0, 0.152], [0.4, 0.072, 0.006, 0, 0.146], [0.47, 0.07, 0.006, 0, 0.14]];
    poner('Cadera', M.loft(DELANTAL, { segRadio: 40, subdiv: 5, nombre: 'Delantal' }));
    const czDel = (y) => M.interp(DELANTAL.map((f) => [f[0], f[4]]), y) + 0.006;
    [-0.032, 0.032].forEach((x) => poner('Cadera', M.tubo([0.46, 0.4, 0.33, 0.282].map((y) => V(x, y, czDel(y))), 0.0042, 0.0042, { segLargo: 16, segRadio: 6, nombre: 'Ribete' })));
    poner('Cadera', M.tubo([-0.074, -0.04, 0, 0.04, 0.074].map((x) => V(x, 0.272, czDel(0.272))), 0.0045, 0.0045, { segLargo: 12, segRadio: 6, nombre: 'Ribete' }));
    // faja negra cruzada en la cadera, más baja por la derecha
    const faja = M.aro(0, 0, 0, 0.224, 0.174, 0.009, 'Faja');
    faja.position.set(0, 0.41, 0);
    faja.rotation.z = -0.1;
    poner('Cadera', faja);

    // ---------------- BRAZOS: manga corta negra, hombreras, brazales morados y guantes sin dedos ----------------
    LADOS.forEach((s) => {
      const base = (t) => (t < 0.14 ? 0.053 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.053 - 0.011 * (t - 0.14) / 0.86);
      const radioBrazo = (t) => base(t) * (1 + 0.08 * Math.exp(-(((t - 0.36) / 0.12) ** 2)) + 0.06 * Math.exp(-(((t - 0.7) / 0.1) ** 2)));
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.185, 0.712, -0.01], [s * 0.222, 0.655, -0.008], [s * 0.24, 0.585, -0.004], [s * 0.254, 0.5, 0.002], [s * 0.258, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 52, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      const funda = (t0, t1, extra, nombre, tapa, abomba = 0) => {
        const pts = [0, 0.5, 1].map((k) => curva.getPointAt(t0 + (t1 - t0) * k));
        poner('Brazo' + L(s), M.tubo(pts, 1, 1, { segLargo: 16, segRadio: 32, ruido: (t) => radioBrazo(t0 + (t1 - t0) * t) + extra + abomba * Math.sin(Math.PI * t), nombre }));
        [t0, t1].forEach((tt) => {
          const tS = M.seg(32, 12);
          const anillo = M.pieza(new THREE.RingGeometry(radioBrazo(tt) * 0.9, radioBrazo(tt) + extra, tS, 2), tapa, tS, 2);
          anillo.position.copy(curva.getPointAt(tt));
          anillo.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
          poner('Brazo' + L(s), anillo);
        });
      };
      const aro = (tt, r, g0, nombre) => {
        const tS = M.seg(36, 12);
        const m = M.pieza(new THREE.TorusGeometry(r, g0, 8, tS), nombre, tS, 8);
        m.position.copy(curva.getPointAt(tt));
        m.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), m);
      };
      funda(0.06, 0.4, 0.012, 'Manga', 'TapaManga');                       // manga corta negra
      aro(0.385, radioBrazo(0.385) + 0.013, 0.006, 'BandaManga');            // banda morada en el borde
      funda(0.6, 0.875, 0.013, 'Brazal', 'TapaBrazal', 0.004);              // brazal morado
      aro(0.605, radioBrazo(0.605) + 0.014, 0.005, 'Ribete');
      aro(0.87, radioBrazo(0.87) + 0.014, 0.005, 'Ribete');
      const lado = (tt, d) => curva.getPointAt(tt).add(V(s * (radioBrazo(tt) + d), 0, 0));
      poner('Brazo' + L(s), M.tubo([lado(0.62, 0.016), lado(0.74, 0.019), lado(0.86, 0.016)], 0.0045, 0.0045, { segLargo: 12, segRadio: 6, nombre: 'Ribete' }));
      funda(0.875, 0.985, 0.008, 'Munequera', 'TapaMunequera');             // muñequera del guante
      // puño: guante negro sin dedos, dedos y pulgar al aire
      poner('Mano' + L(s), bloque(s * 0.262, 0.43, 0.012, 0.05, 0.054, 0.054, 0.6, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.266, 0.385, 0.02, 0.041, 0.024, 0.045, 0.7, 'Dedos'));
      poner('Mano' + L(s), bloque(s * 0.24, 0.41, 0.058, 0.017, 0.026, 0.016, 0.8, 'Dedos'));
      // hombrera morada en dos capas con borde dorado
      [[0.208, 0.722, -0.008, 0.094, 0.078, 0.1, -0.32, 'Hombrera'], [0.25, 0.664, -0.008, 0.075, 0.054, 0.088, -0.74, 'HombreraBaja']]
        .forEach(([x, y, z, hx, hy, hz, giro, nombre]) => {
          const sW = M.seg(36, 12);
          const sH = M.seg(14, 6);
          const geo = new THREE.SphereGeometry(1, sW, sH, 0, Math.PI * 2, 0, Math.PI / 2);
          geo.scale(hx, hy, hz);
          const casco = M.pieza(geo, nombre, sW, sH);
          casco.position.set(s * x, y, z);
          casco.rotation.z = s * giro;
          poner('Brazo' + L(s), casco);
          const tB = M.seg(40, 12);
          const borde = M.pieza(new THREE.TorusGeometry(1, 0.008 / hx, 8, tB), 'Ribete', tB, 8);
          borde.rotation.x = Math.PI / 2;
          borde.scale.set(hx, hz, hx);
          const piv = new THREE.Group();
          piv.position.set(s * x, y, z);
          piv.rotation.z = s * giro;
          piv.add(borde);
          poner('Brazo' + L(s), piv);
        });
    });

    // ---------------- CINTURÓN NEGRO, HEBILLA Y BOLSA ----------------
    prendaSolida([[0.45, 0.205, 0.157], [0.488, 0.203, 0.155]], null, 0.012, { segRadio: 72, subdiv: 2, nombre: 'Cinturon' }).forEach((p) => poner('Cadera', p));
    poner('Cadera', bloque(-0.004, 0.469, 0.162, 0.028, 0.022, 0.005, 0.25, 'Hebilla'));
    poner('Cadera', bloque(-0.001, 0.469, 0.166, 0.019, 0.013, 0.004, 0.25, 'HuecoHebilla'));
    poner('Cadera', M.tubo([[-0.018, 0.469, 0.17], [0.01, 0.469, 0.17]], 0.0025, 0.0025, { segLargo: 4, segRadio: 6, nombre: 'Hebilla' }));
    poner('Cadera', bloque(0.042, 0.469, 0.162, 0.016, 0.019, 0.004, 0.4, 'Cinturon'));
    const bolsa = new THREE.Group();
    const aB = -1.3;                                                          // en la cadera derecha, algo hacia atrás
    bolsa.position.set(0.236 * Math.sin(aB), 0.43, 0.186 * Math.cos(aB));
    bolsa.rotation.y = aB;
    bolsa.add(bloque(0, 0, 0, 0.032, 0.04, 0.015, 0.35, 'Bolsa'));
    bolsa.add(bloque(0, 0.026, 0.007, 0.034, 0.016, 0.011, 0.35, 'TapaBolsa'));
    poner('Cadera', bolsa);

    // ---------------- PANTALÓN NEGRO ANCHO Y BOTAS CON DOBLEZ DORADO ----------------
    poner('Cadera', M.loft([[0.27, 0.05, 0.05], [0.3, 0.198, 0.132], [0.4, 0.2, 0.138], [0.45, 0.188, 0.136], [0.47, 0.18, 0.13], [0.478, 0.158, 0.116]],
      { segRadio: 60, subdiv: 4, nombre: 'CaderaPantalon' }));
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.222, 0.072, 0.077, x, -0.019], [0.25, 0.097, 0.102, x, -0.019], [0.28, 0.1, 0.105, x, -0.018], [0.31, 0.097, 0.102, x, -0.016], [0.335, 0.097, 0.103, x * 0.97, -0.015]],
        { segRadio: 44, subdiv: 4, nombre: 'Pierna' }));
      poner('Pierna' + L(s), M.loft([[0.07, 0.072, 0.078, x, -0.02], [0.14, 0.074, 0.08, x, -0.02], [0.2, 0.079, 0.085, x, -0.019]], { segRadio: 40, subdiv: 4, nombre: 'CanaBota' }));
      prendaSolida([[0.19, 0.087, 0.093, x, -0.019], [0.22, 0.092, 0.098, x, -0.019], [0.252, 0.097, 0.103, x, -0.019]], null, 0.009, { segRadio: 44, subdiv: 3, nombre: 'DoblezBota' })
        .forEach((p) => poner('Pierna' + L(s), p));
      poner('Pierna' + L(s), M.aro(x, 0.252, -0.019, 0.097, 0.103, 0.006, 'Ribete'));
      poner('Pierna' + L(s), M.aro(x, 0.19, -0.019, 0.088, 0.094, 0.005, 'Ribete'));
    });
    const BOTA = [
      [-0.105, 0, 0, 0, -0.09], [-0.095, 0.058, 0.075, 0, -0.09], [-0.06, 0.077, 0.088, 0, -0.092], [0.0, 0.082, 0.088, 0, -0.09],
      [0.06, 0.084, 0.078, 0, -0.08], [0.12, 0.08, 0.064, 0, -0.068], [0.16, 0.064, 0.05, 0, -0.058], [0.182, 0.03, 0.028, 0, -0.054], [0.19, 0, 0, 0, -0.054]
    ];
    const SUELA = BOTA.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.007, rx < 0.01 ? 0 : 0.014, 0, -0.012]);
    const INCLINA = 0.08;
    LADOS.forEach((s) => {
      const piezas = [[BOTA, 'BotaPie'], [SUELA, 'SuelaBota']].map(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2 + INCLINA;
        m.position.set(s * PIE_X, 0.016, -0.02);
        poner('Pie' + L(s), m);
        return m;
      });
      poner('Pie' + L(s), bloque(s * PIE_X, 0.014, -0.105, 0.05, 0.016, 0.036, 0.5, 'Tacon'));
      // placa dorada sobre la puntera, apoyada en la bota con rayos desde arriba
      const bota = piezas[0];
      bota.updateMatrixWorld(true);
      const pts = [];
      for (let iz = 0; iz <= 6; iz++) {
        const fila = [];
        for (let ix = 0; ix <= 8; ix++) {
          const px = s * PIE_X + (ix / 8 - 0.5) * 0.11 * (1 - 0.25 * iz / 6);
          const pz = 0.1 + 0.055 * (iz / 6);
          rayo.set(V(px, 3, pz), V(0, -1, 0));
          const h = rayo.intersectObject(bota, false)[0];
          fila.push(h ? h.point.clone().add(V(0, 0.006, 0)) : null);
        }
        pts.push(fila);
      }
      if (pts.every((f) => f.every(Boolean))) {
        const plano = [];
        pts.forEach((f) => f.forEach((p) => plano.push(p.x, p.y, p.z)));
        poner('Pie' + L(s), rejilla(plano, 8, 6, 'PunteraOro'));
      }
      // correa al tobillo con hebilla por fuera
      poner('Pie' + L(s), M.aro(s * PIE_X, 0.17, -0.025, 0.083, 0.088, 0.007, 'CorreaBota'));
      poner('Pie' + L(s), bloque(s * (PIE_X + 0.084), 0.17, -0.02, 0.005, 0.014, 0.016, 0.3, 'Hebilla'));
    });

    // ---------------- ESQUELETO ----------------
    // Huesos (THREE.Bone) en las articulaciones; cada pieza cuelga del hueso que la mueve, sin cambiar
    // su sitio en la pose de reposo. Girar un hueso mueve todo lo que cuelga de él (y de sus hijos):
    //   grupo.getObjectByName('HuesoBrazoI').rotation.z = 1.2;   // levanta el brazo izquierdo
    // Lados vistos desde el personaje (mira hacia +Z): I = izquierdo (+X), D = derecho (−X).
    const HUESOS = [
      // [nombre, padre, x, y, z] — posición de la articulación en la pose de reposo
      ['Raiz', null, 0, 0, 0],
      ['Cadera', 'Raiz', 0, 0.31, -0.015],
      ['Pecho', 'Cadera', 0, 0.42, -0.012],
      ['Cuello', 'Pecho', 0, 0.78, -0.008],
      ['Cabeza', 'Cuello', 0, 0.85, -0.004],
      ...LADOS.flatMap((s) => [
        ['Brazo' + L(s), 'Pecho', s * 0.188, 0.7, -0.011],          // hombro
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.256, 0.49, 0.002],    // muñeca (dentro de la muñequera del guante)
        ['Pierna' + L(s), 'Cadera', s * PIE_X, 0.3, -0.015],         // cadera
        ['Pie' + L(s), 'Pierna' + L(s), s * PIE_X, 0.13, -0.02]      // tobillo (dentro de la bota)
      ])
    ];
    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = 'Hueso' + nombre;
      b.userData.reposo = [x, y, z];
      const p = padre ? hueso[padre] : null;
      b.position.set(x - (p ? p.userData.reposo[0] : 0), y - (p ? p.userData.reposo[1] : 0), z - (p ? p.userData.reposo[2] : 0));
      (p || g).add(b);
      hueso[nombre] = b;
    });
    g.updateMatrixWorld(true);
    Object.keys(PARTES).forEach((nombre) => PARTES[nombre].forEach((pieza) => hueso[nombre].attach(pieza)));


    // ---------------- COLORES (paleta de la hoja: dorado, morado, morado oscuro, negro y plata) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xc2a28a, pielSombra: 0x9a7a66, labio: 0x84564a,
      pelo: 0x7e5f2c,
      ojo: 0xf6f3ee, iris: 0x7a5e48, pupila: 0x221810, brillo: 0xffffff, pestanas: 0x2a1e16, ceja: 0x6a4e26,
      oro: 0xb08a40, visera: 0x24222e,
      tunica: 0x463f66, tunicaForro: 0x302c46, negro: 0x232428, corse: 0x26262c,
      pantalon: 0x26282e, bota: 0x2c2521, botaClara: 0x3a302a, suela: 0x1a1614, plata: 0x9c9da6
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', BrazoPiel: 'piel', Dedos: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Casco: 'oro', Cresta: 'oro', Visera: 'visera',
      Tunica: 'tunica', Corse: 'corse', Ribete: 'oro', Voluta: 'oro', Correa: 'negro', Remache: 'plata',
      CuelloAlto: 'tunica', CuelloAltoBordeIzquierdo: 'oro', CuelloAltoBordeDerecho: 'oro',
      Faldon: 'tunica', FaldonBordeIzquierdo: 'oro', FaldonBordeDerecho: 'oro', Delantal: 'negro', Faja: 'negro',
      Manga: 'negro', TapaManga: 'negro', BandaManga: 'tunica', Brazal: 'tunica', TapaBrazal: 'tunicaForro',
      Munequera: 'negro', TapaMunequera: 'negro', Guante: 'negro',
      Hombrera: 'tunica', HombreraBaja: 'tunica',
      Cinturon: 'negro', Hebilla: 'plata', HuecoHebilla: 'negro', Bolsa: 'negro', TapaBolsa: 'corse',
      CaderaPantalon: 'pantalon', Pierna: 'pantalon',
      CanaBota: 'bota', DoblezBota: 'botaClara', BotaPie: 'bota', SuelaBota: 'suela', Tacon: 'suela', PunteraOro: 'oro', CorreaBota: 'suela'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Tunica: ['tunica', 'tunicaForro'], CuelloAlto: ['tunica', 'negro'], Faldon: ['tunica', 'tunicaForro'], Corse: ['corse', 'negro'],
      Cinturon: ['negro', 'negro'], DoblezBota: ['botaClara', 'bota'] };
    const METAL = { plata: [0x9a9ca0, 60], oro: [0x6a5028, 40], visera: [0x8a8aa0, 90] };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; metales y visera brillan
    function material(clave, porVertice) {
      const id = clave + (porVertice ? '+v' : '');
      if (!materiales[id]) {
        const m = METAL[clave]
          ? new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
            specular: METAL[clave][0], shininess: METAL[clave][1] })
          : clayMaterial.clone();
        m.color.setHex(porVertice ? 0xffffff : COLOR[clave]);
        m.vertexColors = !!porVertice;
        materiales[id] = m;
      }
      return materiales[id];
    }
    function pintarVertices(malla, fn) {
      const p = malla.geometry.attributes.position;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) fn(i, p).toArray(col, i * 3);
      malla.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    g.traverse((o) => {
      if (!o.isMesh) return;
      const nombre = PINTURA[o.name] ? o.name : o.name.replace(/(BordeIzquierdo|BordeDerecho|Base|Pared\d+)$/, '');
      const clave = PINTURA[nombre];
      if (!clave) return;
      if (o.userData.capas && CAPAS[o.name]) {
        const [fuera, dentro] = CAPAS[o.name].map((k) => new THREE.Color(COLOR[k]));
        const { cols, exteriores } = o.userData.capas;
        pintarVertices(o, (i) => {
          const fila = Math.floor(i / (cols + 1));
          return fila >= exteriores && fila < 2 * exteriores ? dentro : fuera;
        });
        o.material = material(clave, true);
      } else {
        o.material = material(clave);
      }
      applyRenderStyleToMesh(o);                                // respeta el modo actual del editor (arcilla / wireframe)
    });

    // ---------------- ANIMACIONES (clips para THREE.AnimationMixer sobre este grupo) ----------------
    const grados = Math.PI / 180;
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();
    // Pista de giro de un hueso: fn(t de 0 a 1) → [x, y, z] en grados (ciclo cerrado: t = 1 igual que t = 0)
    function giro(nombre, dur, fn, n = 24) {
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        q.setFromEuler(eu.set(x * grados, y * grados, z * grados));
        tiempos.push((i / n) * dur);
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombre}.quaternion`, tiempos, valores);
    }
    function sube(nombre, dur, fn, n = 24) {                    // pista de altura (rebote al caminar)
      const [x, y, z] = hueso[nombre].position.toArray();
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) { tiempos.push((i / n) * dur); valores.push(x, y + fn(i / n), z); }
      return new THREE.VectorKeyframeTrack(`Hueso${nombre}.position`, tiempos, valores);
    }
    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Reposo: respira y mueve un poco la cabeza
    const dR = 2.4;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('Pecho', dR, (t) => [-1.2 * sen(t), 0, 0]),
      giro('Cabeza', dR, (t) => [1.5 * sen(t), 0, 1.5 * sen(t)]),
      ...LADOS.map((s) => giro('Brazo' + L(s), dR, (t) => [0, 0, s * 2 * (1 - cos(t)) / 2]))
    ]);
    // Caminar: piernas y brazos alternos, rebote de la cadera y giro suave del tronco
    const dC = 0.9;
    const PASO = 26;
    const caminar = new THREE.AnimationClip('Caminar', dC, [
      sube('Cadera', dC, (t) => 0.012 * (1 - cos(t, 2)) / 2),
      giro('Cadera', dC, (t) => [0, 5 * sen(t), 0]),
      giro('Pecho', dC, (t) => [3, -8 * sen(t), 0]),
      giro('Cabeza', dC, (t) => [-2, 3 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro('Pierna' + L(s), dC, (t) => [s * PASO * sen(t), 0, 0]),
        giro('Pie' + L(s), dC, (t) => [s * -0.45 * PASO * sen(t) + 8 * Math.max(0, s * cos(t)) ** 2, 0, 0]),
        giro('Brazo' + L(s), dC, (t) => [s * -0.9 * PASO * sen(t), 0, s * 4]),
        giro('Mano' + L(s), dC, (t) => [s * -8 * sen(t), 0, 0])
      ])
    ]);
    // Celebrar: brazos en cruz, arriba y vuelta abajo
    const dF = 1.6;
    const alzar = [[0, 0], [0.18, 92], [0.35, 92], [0.55, 128], [0.75, 128], [1, 0]];   // brazos cortos: más arriba chocarían con la cabeza
    const adelante = [[0, 0], [0.35, 0], [0.55, 14], [0.75, 14], [1, 0]];
    const celebrar = new THREE.AnimationClip('Celebrar', dF, [
      giro('Pecho', dF, (t) => [-4 * Math.sin(Math.PI * t), 0, 0], 32),
      giro('Cabeza', dF, (t) => [-8 * Math.sin(Math.PI * t), 0, 0], 32),
      sube('Cadera', dF, (t) => 0.03 * Math.max(0, Math.sin(Math.PI * (t - 0.4) / 0.45)) * (t > 0.4 && t < 0.85 ? 1 : 0), 48),
      ...LADOS.flatMap((s) => [
        giro('Brazo' + L(s), dF, (t) => [M.interp(adelante, t), 0, s * M.interp(alzar, t)], 48),
        giro('Mano' + L(s), dF, (t) => [0, 0, s * 0.15 * M.interp(alzar, t)], 48)
      ])
    ]);
    g.animations = [reposo, caminar, celebrar];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
