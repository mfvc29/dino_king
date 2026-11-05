/**
 * Nelly — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/nelly.jpeg
 * (vistas de frente, perfil y espalda, caras, polo negro, short vaquero, jersey y zapatillas).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rubio despeinado: casco cerrado + flequillo en mechones (uno cae entre los ojos) + melena corta
 *   recogida + pelos sueltos en punta por la coronilla y los lados + mechones que enmarcan la cara + coleta
 *   baja en la nuca con coletero verde oscuro y puntas abiertas
 *   → piel clara y ojos azul claro medio cerrados (párpado caído, mirada cansada)
 *   → polo negro de manga corta con cuello de camisa y tapeta, sobre una camiseta beige de manga larga
 *     arremangada
 *   → jersey beige atado a la cintura: cuelga por detrás y los lados, mangas anudadas delante
 *   → short vaquero con bajo deshilachado, rotos y costuras claras
 *   → piernas al aire, calcetines grisáceos arrugados y zapatillas bajas gris oscuro con puntera y suela claras.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'nelly',
  categoria: 'personajes',
  nombre: 'Nelly (chibi)',
  icono: '🥱',
  origen: 'assets/personajes 3d/nelly.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.112;                              // separación de piernas y botas desde el centro
    const pieles = [];                                // piezas largas que se doblan con varios huesos
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

    // ---------------- CABEZA: cara ancha y casi cuadrada (como en el sprite), barbilla plana ----------------
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
        x *= 1 + 0.04 * Math.exp(-(((y + 0.4) / 0.25) ** 2));  // mofletes
        if (z > 0.55) z = 0.55 + (z - 0.55) * 0.65;             // cara plana de frente
        if (y < -0.82) y = -0.82 + (y + 0.82) * 0.45;           // barbilla plana
        a.setXYZ(i, x * CRANEO.rx, CRANEO.y + y * CRANEO.ry, z * CRANEO.rz);
      }
      const malla = M.pieza(geo, 'Cabeza', sW, sH);
      // Sombreado tipo anime: la cara está en la mitad baja de la esfera y sus normales miran al suelo, así que
      // la luz de arriba la dejaba oscura. Se giran hacia delante solo las normales de la cara (la forma no cambia).
      const N = geo.attributes.normal;
      const P = geo.attributes.position;
      const centro = V(0, 0.74, -0.3);                       // más abajo: también ilumina la barbilla
      const n = V(0, 0, 0);
      const d = V(0, 0, 0);
      for (let i = 0; i < N.count; i++) {
        n.fromBufferAttribute(N, i);
        const w = suave(0.1, 0.5, n.z) * (1 - suave(0.9, 0.99, -n.y));   // cara sí; debajo de la barbilla no
        if (w <= 0) continue;
        d.fromBufferAttribute(P, i).sub(centro).normalize();
        n.lerp(d, w).normalize();
        N.setXYZ(i, n.x, n.y, n.z);
      }
      return malla;
    })();
    poner('Cabeza', cabeza);
    poner('Cuello', M.tubo([[0, 0.72, -0.01], [0, 0.8, -0.005], [0, 0.86, 0]], 0.062, 0.058, { segLargo: 6, segRadio: 28, nombre: 'Cuello' }));

    const deFrente = (x, y) => marco(cabeza, V(x, y, 3), V(0, 0, -1));
    LADOS.forEach((s) => {
      // Ojo grande y bajo, medio cerrado: almendra, iris, pupila, brillos, párpado caído con pestañas y párpado inferior
      const ojo = deFrente(s * 0.105, 0.872);
      if (ojo) {
        const blanco = almendra(0.058, 0.04, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);
        ojo.add(bloque(-s * 0.007, -0.002, 0.0045, 0.03, 0.037, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.007, -0.003, 0.0105, 0.014, 0.02, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.014, 0.0, 0.0135, 0.0075, 0.0075, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(0, 0.038, 0.012, 0.064, 0.026, 0.013, 1, 'Parpado'));                    // párpado caído
        ojo.add(bloque(s * 0.004, -0.019, 0.012, 0.0048, 0.0048, 0.0035, 1, 'BrilloOjoPequeno'));
        ojo.add(M.tubo([[-s * 0.06, -0.004, 0.01], [-s * 0.04, 0.012, 0.019], [0, 0.017, 0.022], [s * 0.04, 0.014, 0.02], [s * 0.064, 0.006, 0.012], [s * 0.08, 0.014, 0.006]],
          0.0075, 0.003, { segLargo: 28, segRadio: 10, nombre: 'Pestanas' }));           // pestañas largas con rabillo
        ojo.add(M.tubo([[s * 0.05, -0.024, 0.006], [s * 0.066, -0.03, 0.004]], 0.003, 0.0015, { segLargo: 6, segRadio: 6, nombre: 'PestanaInferior' }));
        ojo.add(M.tubo([[-s * 0.046, -0.03, 0.005], [0, -0.039, 0.006], [s * 0.048, -0.031, 0.005]], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));
        poner('Cabeza', ojo);
      }
      // Ceja fina, relajada
      const ceja = deFrente(s * 0.1, 0.922);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.032, -0.001, 0.007], [0, 0.004, 0.009], [s * 0.036, -0.003, 0.007]], 0.0075, 0.005, { segLargo: 12, segRadio: 10, nombre: 'Ceja' })); // fina y algo seria
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
    // Nariz de botón y boca pequeña, desganada
    const nariz = deFrente(0, 0.846);
    if (nariz) { nariz.add(bloque(0, 0, 0.002, 0.013, 0.011, 0.009, 1, 'Nariz')); poner('Cabeza', nariz); }
    const boca = deFrente(0, 0.828);
    if (boca) {
      boca.add(M.tubo([[-0.016, 0.0, 0.002], [0, 0.0005, 0.003], [0.016, -0.001, 0.002]], 0.0028, 0.0028, { segLargo: 12, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- PELO RUBIO DESPEINADO: casco, flequillo, melena recogida, pelos sueltos, mechones y coleta baja ----------------
    const PELO = { y: 1.02, z: -0.012, rx: 0.265, ry: 0.235, rz: 0.255 };
    const REMOLINO = V(0, 0.75, -0.66).normalize();           // raya y remolino en la coronilla
    const E1 = V(1, 0, 0);
    const E2 = REMOLINO.clone().cross(E1).normalize();
    function relieve(u) {
      const polar = Math.acos(Math.max(-1, Math.min(1, u.dot(REMOLINO))));
      const fi = Math.atan2(u.dot(E2), u.dot(E1)) + 0.1 * polar;
      return { banda: Math.cos(fi * 6) ** 2, peso: suave(0.15, 0.8, polar) }; // 12 mechones anchos
    }
    // Pelo cerrado: capa exterior (con los mechones) + capa interior pegada a la cabeza + borde que las une
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
    // Nacimiento del pelo (altura del borde según el ángulo alrededor de la cabeza: 0 = frente, π = nuca):
    // bajo en la frente (justo encima de las cejas, como en el sprite), encima de las orejas y hasta la nuca
    const NACIMIENTO = [[0, 0.952], [0.5, 0.948], [1.1, 0.928], [1.57, 0.925], [2.2, 0.88], [2.7, 0.842], [Math.PI, 0.832]];
    poner('Cabeza', (() => {
      const C = M.seg(96, 24);                     // alrededor
      const NR = M.seg(40, 12);                    // de la coronilla al borde
      const O = V(0, PELO.y, PELO.z);
      const ext = [];
      const int = [];
      for (let i = 0; i <= NR; i++) { ext.push([]); int.push([]); }
      for (let c = 0; c <= C; c++) {
        const fi = -Math.PI + (2 * Math.PI * c) / C;
        const cosB = Math.max(-0.99, Math.min(0.99, (M.interp(NACIMIENTO, Math.abs(fi)) - PELO.y) / PELO.ry));
        let thB = Math.acos(cosB);
        // en la nuca y los lados los mechones acaban en punta (en la frente el borde es limpio)
        const uB = V(Math.sin(thB) * Math.sin(fi), Math.cos(thB), Math.sin(thB) * Math.cos(fi));
        const rb = relieve(uB);
        thB += 0.09 * rb.peso * rb.banda * rb.banda * suave(0.7, 1.6, Math.abs(fi));
        for (let i = 0; i <= NR; i++) {
          const th = thB * Math.pow(i / NR, 0.9);
          const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
          const { banda, peso } = relieve(u);
          const frente = suave(0.55, 0.95, Math.cos(fi)) * suave(1.1, 1.6, th); // borde de la frente más limpio
          const k = 1 - 0.07 * peso * (1 - Math.pow(banda, 0.8)) * (1 - 0.8 * frente);
          const pe = V(u.x * PELO.rx * k, PELO.y + u.y * PELO.ry * k, PELO.z + u.z * PELO.rz * k);
          const dir = pe.clone().sub(O).normalize();
          const pi = O.clone().addScaledVector(dir, hastaCraneo(O, dir) + 0.006);
          ext[i].push(pe);
          int[i].push(pi);
        }
      }
      // una sola superficie cerrada: exterior (coronilla → borde) + borde + interior (borde → coronilla)
      const filas = [...ext, ...int.slice().reverse()];
      const pos = [];
      filas.forEach((fila) => fila.forEach((p) => pos.push(p.x, p.y, p.z)));
      return rejilla(pos, C, filas.length - 1, 'Pelo');
    })());
    // Mechón plano y en punta (flequillo)
    function mechon(puntos, ancho, grosor, nombre) {
      const curva = M.curva(puntos);
      const L = M.seg(22, 4);
      const C = M.seg(18, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= L; i++) {
        const t = i / L;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        const N = P.clone().sub(V(0, 1.0, 0)).normalize();             // grosor: hacia fuera de la cabeza
        N.addScaledVector(T, -N.dot(T)).normalize();
        const B = T.clone().cross(N).normalize();                       // ancho: de lado
        const f = Math.pow(1 - t, 0.7) * (0.75 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.5)));
        const a = Math.max(0.001, ancho * 0.5 * f);
        const b = Math.max(0.001, grosor * 0.5 * Math.pow(1 - t, 0.8));
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          pos.push(P.x + N.x * b * Math.cos(th) + B.x * a * Math.sin(th),
            P.y + N.y * b * Math.cos(th) + B.y * a * Math.sin(th),
            P.z + N.z * b * Math.cos(th) + B.z * a * Math.sin(th));
        }
      }
      return rejilla(pos, C, L, nombre);
    }
    // Mechón largo que cae por delante del hombro: plano de frente (grosor hacia fuera del cuerpo)
    function mechonLargo(puntos, ancho, grosor, nombre) {
      const curva = M.curva(puntos);
      const L = M.seg(40, 8);
      const C = M.seg(18, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= L; i++) {
        const t = i / L;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        const N = V(P.x * 0.6, 0, P.z + 0.02).normalize();             // hacia fuera del cuerpo
        N.addScaledVector(T, -N.dot(T)).normalize();
        const B = T.clone().cross(N).normalize();
        const f = (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + t))) * Math.pow(1 - t, 0.55);
        const a = Math.max(0.001, ancho * 0.5 * f);
        const b = Math.max(0.001, grosor * 0.5 * Math.pow(1 - t, 0.5));
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          pos.push(P.x + N.x * b * Math.cos(th) + B.x * a * Math.sin(th),
            P.y + N.y * b * Math.cos(th) + B.y * a * Math.sin(th),
            P.z + N.z * b * Math.cos(th) + B.z * a * Math.sin(th));
        }
      }
      return rejilla(pos, C, L, nombre);
    }
    // Punto apoyado sobre el casco de pelo (profundidad calculada del elipsoide + separación)
    const enPelo = (x, y, d = 0.012) => {
      const e = 1 - (x / PELO.rx) ** 2 - ((y - PELO.y) / PELO.ry) ** 2;
      return V(x, y, PELO.z + PELO.rz * Math.sqrt(Math.max(0, e)) + d);
    };
    // Flequillo despeinado en mechones en punta; uno cae entre los ojos
    [[-0.02, -0.05, -0.06, 0.9, 0.085], [0.03, 0.06, 0.07, 0.905, 0.085], [0.0, -0.008, -0.02, 0.922, 0.07],
      [-0.06, -0.1, -0.12, 0.91, 0.07], [0.07, 0.11, 0.13, 0.912, 0.07],
      [-0.11, -0.15, -0.18, 0.88, 0.1], [0.115, 0.155, 0.185, 0.88, 0.1], [-0.19, -0.235, -0.26, 0.845, 0.1], [0.195, 0.24, 0.265, 0.845, 0.1], [0.0, 0.012, 0.028, 0.858, 0.055]]
      .forEach(([x0, x1, x2, yFin, ancho], k) => {
        poner('Cabeza', mechon([enPelo(x0 * 0.6, 1.16, 0.008), enPelo(x0, 1.07, 0.016), enPelo(x1, 0.97, 0.018), enPelo(x2, yFin, 0.008)], ancho, 0.038, k < 5 ? 'FlequilloCentro' : 'Flequillo'));
      });
    // Melena por encima de los hombros, recogida detrás, cerrada (capa de fuera con mechones + capa de dentro + bordes)
    // Perfil por altura: [y, semiancho, semifondo, centro z, medio ángulo libre delante]
    const PERFIL_MELENA = [[0.7, 0.238, 0.262, -0.035, 1.9],
      [0.78, 0.252, 0.262, -0.02, 1.7], [0.86, 0.245, 0.242, -0.02, 1.48], [0.93, 0.258, 0.248, -0.014, 1.3], [0.985, 0.245, 0.235, -0.012, 1.2]];
    const perfil = (y, j) => M.interp(PERFIL_MELENA.map((f) => [f[0], f[j]]), y);
    const melena = (() => {
      const C = M.seg(110, 20);
      const R = M.seg(80, 14);
      const N_PUNTAS = 16;
      const GROSOR = 0.024;
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const fase = (u * N_PUNTAS) % 1;
          const pico = 1 - Math.abs(fase - 0.5) * 2;                    // 0 entre mechones, 1 en la punta
          const yFin = 0.74 - 0.03 * Math.pow(pico, 1.2) - 0.01 * Math.sin(u * 23);
          const t = r / R;
          const y = 0.985 + (yFin - 0.985) * t;
          const medio = perfil(y, 4);
          const th = medio + u * (2 * Math.PI - 2 * medio);
          const rx = perfil(y, 1);
          const rz = perfil(y, 2);
          const cz = perfil(y, 3);
          const mechones = 1 + 0.04 * Math.pow(Math.cos(Math.PI * fase), 2) * suave(0.93, 0.8, y);   // relieve de mechones
          const abre = 1 + 0.06 * Math.pow(pico, 2) * suave(0.85, 0.74, y);   // despeinada: las puntas se abren
          const estrecha = 1 - 0.15 * suave(0.8, 1, t) * (1 - pico);
          fe.push([rx * mechones * abre * Math.sin(th), y, cz + rz * mechones * abre * Math.cos(th) * estrecha + (1 - estrecha) * 0.03]);
          fi.push([(rx - GROSOR) * abre * Math.sin(th), y, cz + (rz - GROSOR) * abre * Math.cos(th) * estrecha + (1 - estrecha) * 0.03]);
        }
        ext.push(fe);
        int.push(fi);
      }
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      const m = rejilla(pos, C, vuelta.length - 1, 'Melena');
      m.userData.capas = { cols: C, exteriores: R + 1 };
      const bordes = [0, C].map((c) => {
        const b = [];
        for (let r = 0; r <= R; r++) b.push(...ext[r][c], ...int[r][c]);
        return rejilla(b, 1, R, 'MelenaBorde');
      });
      return [m, ...bordes];
    })();
    const pesoPelo = (i, x, y) => { const w = suave(0.7, 0.88, y); return [[hueso.Cabeza, w], [hueso.Pecho, 1 - w]]; };
    melena.forEach((m) => pieles.push([m, pesoPelo]));
    LADOS.forEach((s) => {
      // Mechones despeinados que enmarcan la cara hasta la barbilla
      pieles.push([mechonLargo([V(s * 0.228, 0.99, 0.03), V(s * 0.252, 0.92, 0.058), V(s * 0.25, 0.85, 0.074), V(s * 0.236, 0.785, 0.08)], 0.08, 0.028, 'MechonDelantero'), pesoPelo]);
    });
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
    const azar = M.azar(53);
    const ARRIBA = V(0, 1, 0);
    // Pelos sueltos y despeinados que salen del casco: remolino de la coronilla, alrededor y por los lados
    // [ángulo desde arriba, ángulos alrededor (0 = frente), largo, cuánto sube (+) o baja (−) la punta]
    [[0.12, [0.6, 2.2, -1.4], 0.1, 1.1], [0.55, [0.25, 0.9, 1.6, 2.4, -2.9, -2.1, -1.35, -0.6], 0.075, 0.2], [1.05, [1.25, 1.75, 2.3, -2.3, -1.75, -1.25], 0.085, -0.45],
      [1.4, [1.5, 1.9, -1.9, -1.5], 0.08, -1.0]]
      .forEach(([th, fis, largo, sube]) => fis.forEach((fi) => {
        const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
        const raiz = V(u.x * PELO.rx * 0.9, PELO.y + u.y * PELO.ry * 0.9, PELO.z + u.z * PELO.rz * 0.9);
        const dir = u.clone().addScaledVector(ARRIBA, sube).normalize();
        poner('Cabeza', pua(raiz, dir, largo * (0.8 + 0.4 * azar()), 0.07 + 0.03 * azar(), 0.028, (azar() - 0.5) * 1.3, fi, azar() > 0.5 ? 'Pua' : 'PuaClara'));
      }));
    // Coleta baja en la nuca: coletero verde oscuro, mechón recogido y puntas abiertas
    const nuca = V(0, 0.805, -0.29);
    const coletero = M.pieza(new THREE.TorusGeometry(0.03, 0.011, 8, 20), 'Coletero', 20, 8);
    coletero.position.copy(nuca);
    coletero.quaternion.setFromUnitVectors(V(0, 0, 1), V(0, -0.55, -0.83).normalize());
    pieles.push([coletero, pesoPelo]);
    const coleta = [V(0, 0.845, -0.26), nuca, V(0.01, 0.74, -0.312), V(0.02, 0.66, -0.296), V(0.026, 0.6, -0.27)];
    pieles.push([M.tubo(coleta, 0.044, 0.034, { segLargo: 30, segRadio: 20, ruido: (t, a) => (1 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.4))) * (1 + 0.08 * Math.cos(a * 7)), nombre: 'Coleta' }), pesoPelo]);
    const finColeta = V(0.026, 0.61, -0.272);
    [[-0.5, -1, 0.3], [0.1, -1, 0.15], [0.6, -1, 0.1], [0.3, -1, -0.35], [-0.2, -1, -0.25], [0.9, -0.7, -0.1]].forEach(([dx, dy, dz], k) => {
      const dir = V(dx, dy, dz).normalize();
      pieles.push([pua(finColeta.clone().addScaledVector(dir, -0.02), dir, 0.07 + 0.02 * (k % 3), 0.05, 0.022, (azar() - 0.5) * 0.8, Math.PI, k % 2 ? 'PuntaColeta' : 'PuaClara'), pesoPelo]);
    });

    // ---------------- CUERPO (asoma en la abertura del cuello y en los brazos) ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));

    // ---------------- POLO NEGRO: cuello de camisa, tapeta con dos botones, manga corta con puño y bajo suelto ----------------
    const POLO = [[0.395, 0.202, 0.147], [0.45, 0.193, 0.14], [0.52, 0.172, 0.125], [0.6, 0.159, 0.118], [0.66, 0.169, 0.13, 0, 0.006], [0.71, 0.171, 0.128, 0, 0.004],
      [0.745, 0.165, 0.116], [0.775, 0.136, 0.099], [0.8, 0.088, 0.076]];
    // cerrado del bajo a la tapeta y abierto en V solo en el cuello
    prendaSolida(POLO.filter((f) => f[0] <= 0.66), null, 0.009, { segRadio: 84, subdiv: 6, nombre: 'Polo' }).forEach((p) => poner('Pecho', p));
    prendaSolida(POLO.filter((f) => f[0] >= 0.66), [[0.66, 0.004], [0.7, 0.012], [0.74, 0.026], [0.8, 0.048]], 0.009,
      { segRadio: 84, subdiv: 6, nombre: 'Polo' }).forEach((p) => poner('Pecho', p));
    const molde = loftAbierto(POLO, null, { segRadio: 84, subdiv: 6, nombre: 'MoldePolo' });
    const enMolde = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    prendaSolida([[0.785, 0.1, 0.086, 0, -0.008], [0.808, 0.095, 0.082, 0, -0.01], [0.828, 0.098, 0.085, 0, -0.01]],
      [[0.78, 0.042], [0.832, 0.058]], 0.008, { segRadio: 60, subdiv: 4, nombre: 'CuelloPolo' }).forEach((p) => poner('Pecho', p));
    const botonEn = (x, y, d = 0.003, r = 0.0055) => {
      const m = marco(molde, V(x, y, 3), V(0, 0, -1));
      if (!m) return;
      m.add(bloque(0, 0, d, r, r, 0.003, 0.8, 'BotonPolo'));
      poner('Pecho', m);
    };
    LADOS.forEach((s) => poner('Pecho', parcheSolido(molde, [[s * 0.05, 0.806], [s * 0.112, 0.792], [s * 0.094, 0.742], [s * 0.046, 0.758]], 0.009, 6, 8, 'PuntaCuello')));
    LADOS.forEach((s) => poner('Pecho', costura(enMolde([[s * 0.018, 0.74], [s * 0.016, 0.7], [s * 0.014, 0.655], [s * 0.012, 0.645]]), 'CosturaPolo', 0.0018)));
    poner('Pecho', costura(enMolde([[-0.014, 0.645], [0, 0.642], [0.014, 0.645]]), 'CosturaPolo', 0.0018));
    botonEn(0.0, 0.69);
    botonEn(0.0, 0.66);
    // pliegues suaves y aberturas laterales del bajo
    LADOS.forEach((s) => {
      poner('Pecho', costura(enMolde([[s * 0.06, 0.6], [s * 0.1, 0.55], [s * 0.13, 0.52]]), 'PlieguePolo', 0.0022));
      poner('Pecho', costura(enMolde([[s * 0.04, 0.7], [s * 0.09, 0.64], [s * 0.12, 0.6]], -1), 'PlieguePolo', 0.0022));
      const a = 1.5;
      poner('Pecho', M.tubo([0.396, 0.415, 0.432].map((y) => V(s * (M.interp(POLO.map((f) => [f[0], f[1]]), y) + 0.001) * Math.sin(a), y, M.interp(POLO.map((f) => [f[0], f[2]]), y) * Math.cos(a))),
        0.0025, 0.0025, { segLargo: 6, segRadio: 6, nombre: 'CosturaPolo' }));
    });

    // ---------------- BRAZOS: manga corta negra sobre manga larga beige arremangada y manos al aire ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      const pts = [0, 0.5, 1].map((k) => curva.getPointAt(0.06 + 0.28 * k));
      poner('Brazo' + L(s), M.tubo(pts, 1, 1, { segLargo: 16, segRadio: 32, ruido: (t) => radioBrazo(0.06 + 0.28 * t) + 0.014 + 0.004 * Math.sin(Math.PI * t), nombre: 'Manga' }));
      [0.06, 0.34].forEach((tt) => {
        const tS = M.seg(32, 12);
        const anillo = M.pieza(new THREE.RingGeometry(radioBrazo(tt) * 0.9, radioBrazo(tt) + 0.014, tS, 2), 'ForroManga', tS, 2);
        anillo.position.copy(curva.getPointAt(tt));
        anillo.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), anillo);
      });
      const tS = M.seg(36, 12);
      const puno = M.pieza(new THREE.TorusGeometry(radioBrazo(0.325) + 0.015, 0.0065, 8, tS), 'Manga', tS, 8);
      puno.position.copy(curva.getPointAt(0.325));
      puno.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(0.325));
      poner('Brazo' + L(s), puno);
      // manga larga beige de la camiseta de debajo, arremangada antes de la muñeca
      const ptsL = [0, 0.5, 1].map((k) => curva.getPointAt(0.3 + 0.5 * k));
      poner('Brazo' + L(s), M.tubo(ptsL, 1, 1, { segLargo: 20, segRadio: 28, ruido: (t) => radioBrazo(0.3 + 0.5 * t) + 0.008, nombre: 'MangaLarga' }));
      [[0.76, 0.012, 0.0075], [0.795, 0.011, 0.007]].forEach(([tt, extra, gr]) => {
        const aro = M.pieza(new THREE.TorusGeometry(radioBrazo(tt) + extra, gr, 8, tS), 'PunoManga', tS, 8);
        aro.position.copy(curva.getPointAt(tt));
        aro.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), aro);
      });
      // mano relajada: palma, dedos juntos y pulgar
      poner('Mano' + L(s), M.tubo([[s * 0.254, 0.475, 0.006], [s * 0.257, 0.455, 0.009]], 0.041, 0.043, { segLargo: 4, segRadio: 24, nombre: 'Mano' }));
      poner('Mano' + L(s), bloque(s * 0.258, 0.425, 0.012, 0.042, 0.05, 0.05, 0.65, 'Mano'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.37, 0.016, 0.034, 0.03, 0.044, 0.7, 'Mano'));
      poner('Mano' + L(s), bloque(s * 0.24, 0.41, 0.052, 0.014, 0.026, 0.014, 0.8, 'Mano'));
      [-0.026, -0.009, 0.009, 0.026].forEach((dz) => poner('Mano' + L(s), M.tubo([[s * 0.265, 0.36, 0.016 + dz], [s * 0.262, 0.34, 0.017 + dz]], 0.0018, 0.0018, { segLargo: 3, segRadio: 5, nombre: 'PliegueMano' })));
    });

    // ---------------- SHORT VAQUERO DESHILACHADO ----------------
    const cadera = M.loft([[0.27, 0.05, 0.05], [0.3, 0.19, 0.13], [0.42, 0.193, 0.133], [0.5, 0.17, 0.122], [0.52, 0.15, 0.11]], { segRadio: 60, subdiv: 4, nombre: 'CaderaShort' });
    poner('Cadera', cadera);
    const enCadera = (lista, lado = 1) => lista.map(([x, y]) => sobre(cadera, x, y, lado, 0.0015)).filter(Boolean);
    LADOS.forEach((s) => {
      poner('Cadera', costura(enCadera([[s * 0.045, 0.37], [s * 0.08, 0.372], [s * 0.115, 0.368], [s * 0.112, 0.33], [s * 0.08, 0.318], [s * 0.048, 0.332], [s * 0.045, 0.37]], -1), 'CosturaVaquero'));  // bolsillos de atrás
      poner('Cadera', costura(enCadera([[s * 0.16, 0.39], [s * 0.172, 0.34], [s * 0.178, 0.3]]), 'CosturaVaquero'));   // costura lateral
      const x = s * PIE_X;
      const PERNERA = [[0.25, 0.094, 0.1, x, -0.02], [0.29, 0.095, 0.1, x, -0.018], [0.335, 0.098, 0.103, x * 0.96, -0.015]];
      poner('Pierna' + L(s), M.loft(PERNERA, { segRadio: 44, subdiv: 4, nombre: 'PiernaShort' }));
      const rxP = (y) => M.interp(PERNERA.map((f) => [f[0], f[1]]), y);
      const rzP = (y) => M.interp(PERNERA.map((f) => [f[0], f[2]]), y);
      const enPierna = (a, y, d = 0.0015) => V(x + Math.sin(a) * (rxP(y) + d), y, -0.02 + Math.cos(a) * (rzP(y) + d));
      // bajo deshilachado: franja clara con el borde de abajo en flecos irregulares
      const C = M.seg(72, 24);
      const pos = [];
      [0, 1].forEach((fila) => {
        for (let c = 0; c <= C; c++) {
          const a = (c / C) * Math.PI * 2;
          const r = fila ? 0.006 : 0.0015;
          const y = fila ? 0.236 - 0.012 * azar() : 0.258;
          pos.push(x + Math.sin(a) * (0.094 + r), y, -0.02 + Math.cos(a) * (0.1 + r));
        }
      });
      poner('Pierna' + L(s), rejilla(pos, C, 1, 'Deshilachado'));
      // rotos claros en la parte de delante
      [[-0.35, 0.3, 0.03], [0.2, 0.285, 0.024], [-0.1, 0.27, 0.02], [0.45, 0.305, 0.018]].forEach(([a, y, ancho]) => {
        const aa = s * a;
        poner('Pierna' + L(s), M.tubo([enPierna(aa - ancho / 0.1, y), enPierna(aa, y + 0.002), enPierna(aa + ancho / 0.1, y)], 0.0032, 0.0032, { segLargo: 8, segRadio: 6, nombre: 'Roto' }));
      });
      // pierna al aire, calcetín arrugado y zapatilla
      poner('Pierna' + L(s), M.loft([[0.08, 0.052, 0.056, x, -0.02], [0.13, 0.058, 0.062, x, -0.02], [0.18, 0.064, 0.068, x, -0.018], [0.22, 0.064, 0.068, x, -0.017],
        [0.27, 0.08, 0.084, x, -0.017]], { segRadio: 36, subdiv: 4, nombre: 'PiernaPiel' }));
      poner('Pierna' + L(s), M.loft([[0.06, 0.063, 0.067, x, -0.02], [0.09, 0.067, 0.071, x, -0.02], [0.12, 0.066, 0.07, x, -0.02], [0.15, 0.064, 0.068, x, -0.02]],
        { segRadio: 36, subdiv: 4, nombre: 'Calcetin' }));
      [[0.1, 0.069, 0.073, 0.004], [0.122, 0.068, 0.072, 0.0045], [0.15, 0.065, 0.069, 0.0045]].forEach(([y, rx, rz, gr]) => {
        poner('Pierna' + L(s), M.aro(x, y, -0.02, rx, rz, gr, 'CalcetinSombra'));
      });
    });
    // fly del short (asoma por debajo del nudo)
    poner('Cadera', costura(enCadera([[0.002, 0.33], [0.012, 0.305], [0.026, 0.312], [0.03, 0.34]]), 'CosturaVaquero'));

    // ---------------- JERSEY BEIGE ATADO A LA CINTURA ----------------
    // cuerpo del jersey colgando por detrás y los lados (abierto delante), con elástico abajo
    const JERSEY = [[0.2, 0.252, 0.207], [0.26, 0.242, 0.194], [0.34, 0.228, 0.178], [0.41, 0.215, 0.164], [0.445, 0.212, 0.161]];
    const jersey = prendaArco(JERSEY, () => 1.05, () => 2 * Math.PI - 1.05, 0.012, { segRadio: 56, subdiv: 5, nombre: 'Jersey' });
    jersey.piezas.forEach((p) => poner('Cadera', p));
    const bajoJ = jersey.ext[jersey.ext.length - 1].filter((_, k) => k % 2 === 0).map(([x, y, z]) => V(x * 1.01, y + 0.006, z * 1.01));
    poner('Cadera', M.tubo(bajoJ, 0.008, 0.008, { segLargo: 60, segRadio: 8, nombre: 'Elastico' }));
    const rxJ = (y) => M.interp(JERSEY.map((f) => [f[0], f[1]]), y);
    const rzJ = (y) => M.interp(JERSEY.map((f) => [f[0], f[2]]), y);
    [1.5, 2.0, 2.45, 2.9, 3.4, 3.85, 4.3, 4.75].forEach((a, k) => {                    // pliegues verticales
      const pts = [0.42, 0.34, 0.26, 0.215].map((y, j) => V(Math.sin(a + 0.05 * j * (k % 2 ? 1 : -1)) * (rxJ(y) + 0.002), y, Math.cos(a + 0.05 * j * (k % 2 ? 1 : -1)) * (rzJ(y) + 0.002)));
      poner('Cadera', costura(pts, 'PliegueJersey', 0.003));
    });
    // mangas que rodean la cintura y se anudan delante, y puntas colgando con su puño
    const NUDO = V(0.008, 0.425, 0.182);
    LADOS.forEach((s) => {
      const vuelta = [1.1, 0.8, 0.5, 0.22].map((a) => V(s * Math.sin(a) * 0.226, 0.432 - 0.004 * (1.1 - a), Math.cos(a) * 0.176));
      vuelta.push(NUDO.clone().add(V(s * 0.022, 0, -0.004)));
      poner('Cadera', M.tubo(vuelta, 0.034, 0.03, { segLargo: 30, segRadio: 14, ruido: (t, a) => 1 - 0.3 * Math.abs(Math.cos(a)), nombre: 'MangaJersey' }));
      const cae = s > 0
        ? [V(0.02, 0.41, 0.19), V(0.036, 0.36, 0.182), V(0.044, 0.3, 0.17), V(0.048, 0.262, 0.164)]
        : [V(-0.006, 0.41, 0.19), V(-0.03, 0.355, 0.184), V(-0.052, 0.3, 0.172), V(-0.06, 0.272, 0.166)];
      poner('Cadera', M.tubo(cae, 0.034, 0.028, { segLargo: 24, segRadio: 14, ruido: (t, a) => 1 - 0.32 * Math.abs(Math.cos(a)), nombre: 'MangaJersey' }));
      const fin = cae[cae.length - 1];
      const dirFin = fin.clone().sub(cae[cae.length - 2]).normalize();
      poner('Cadera', M.tubo([fin.clone().addScaledVector(dirFin, -0.012), fin.clone().addScaledVector(dirFin, 0.006)], 0.027, 0.024, { segLargo: 4, segRadio: 14, nombre: 'Elastico' }));
    });
    poner('Cadera', bloque(NUDO.x, NUDO.y, NUDO.z + 0.004, 0.05, 0.04, 0.036, 0.75, 'MangaJersey'));

    // ---------------- ZAPATILLAS BAJAS: lona gris oscura, puntera y suela grisáceas y cordones ----------------
    // Se modelan a lo largo del pie (eje Z) y se giran: [largo, semiancho, semialto, 0, -altura del centro]
    const ZAPATO = [
      [-0.112, 0, 0, 0, -0.045], [-0.1, 0.063, 0.045, 0, -0.045], [-0.06, 0.084, 0.05, 0, -0.05], [0.0, 0.088, 0.052, 0, -0.052],
      [0.06, 0.092, 0.05, 0, -0.05], [0.12, 0.09, 0.043, 0, -0.043], [0.16, 0.074, 0.036, 0, -0.036], [0.184, 0.034, 0.025, 0, -0.026], [0.192, 0, 0, 0, -0.026]
    ];
    const SUELA = ZAPATO.map(([l, rx]) => [l * 1.035, rx < 0.01 ? 0 : rx + 0.008, rx < 0.01 ? 0 : 0.016, 0, -0.014]);
    const PUNTERA = ZAPATO.filter(([l]) => l >= 0.12).map(([l, rx, rz, cx, cz]) => [l * 1.012, rx ? rx + 0.004 : 0, rz ? rz + 0.003 : 0, cx, cz]);
    LADOS.forEach((s) => {
      const piezas = [[ZAPATO, 'Zapatilla'], [SUELA, 'SuelaZapatilla'], [PUNTERA, 'Puntera']].map(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 48, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(s * PIE_X, 0, -0.02);
        poner('Pie' + L(s), m);
        return m;
      });
      // boca de la zapatilla (ribete oscuro alrededor del tobillo)
      poner('Pie' + L(s), M.aro(s * PIE_X, 0.098, -0.04, 0.068, 0.07, 0.006, 'Cordon'));
      // cordones cruzados sobre el empeine (pegados a la zapatilla con rayos desde arriba)
      const zap = piezas[0];
      zap.updateMatrixWorld(true);
      const arribaDe = (x, z) => {
        rayo.set(V(x, 3, z), V(0, -1, 0));
        const h = rayo.intersectObject(zap, false)[0];
        return h ? h.point.clone().add(V(0, 0.004, 0)) : null;
      };
      const filas = [0.04, 0.058, 0.076, 0.094].map((z) => [arribaDe(s * PIE_X - 0.026, z), arribaDe(s * PIE_X + 0.026, z)]);
      for (let k = 0; k < filas.length - 1; k++) {
        [[filas[k][0], filas[k + 1][1]], [filas[k][1], filas[k + 1][0]]].forEach(([a, b]) => {
          if (a && b) poner('Pie' + L(s), M.tubo([a, b], 0.0042, 0.0042, { segLargo: 4, segRadio: 6, nombre: 'Cordon' }));
        });
      }
      filas.flat().filter(Boolean).forEach((p) => poner('Pie' + L(s), bloque(p.x, p.y - 0.002, p.z, 0.0055, 0.003, 0.0055, 1, 'Ojal')));
      const nudo = arribaDe(s * PIE_X, 0.036);
      if (nudo) {
        poner('Pie' + L(s), M.tubo([nudo, nudo.clone().add(V(s * 0.03, -0.004, 0.012)), nudo.clone().add(V(s * 0.04, -0.034, 0.02))], 0.004, 0.003, { segLargo: 12, segRadio: 6, nombre: 'Cordon' }));
        poner('Pie' + L(s), M.tubo([nudo, nudo.clone().add(V(-s * 0.02, -0.004, 0.014)), nudo.clone().add(V(-s * 0.024, -0.03, 0.024))], 0.004, 0.003, { segLargo: 12, segRadio: 6, nombre: 'Cordon' }));
      }
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
        ['Brazo' + L(s), 'Pecho', s * 0.18, 0.7, -0.01],            // hombro
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.252, 0.49, 0.002],    // muñeca
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
    // melena, mechones y coleta: se doblan suave entre la cabeza y el pecho
    pieles.forEach(([malla, pesos]) => { g.add(malla); M.pielConHuesos(malla, g, pesos); });

    // ---------------- COLORES (paleta de la hoja: rubio, piel, azul claro, negro, vaquero, gris pardo y beige) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xdcb49c, pielSombra: 0xb08c78, labio: 0xa66a60,
      pelo: 0xb8a674, peloClaro: 0xc6b484, peloSombra: 0x948454, ceja: 0x9a8858,
      ojo: 0xf7f3ef, iris: 0x6a98c0, pupila: 0x1a2a3e, brillo: 0xffffff, pestanas: 0x3a3228,
      polo: 0x1e2024, poloForro: 0x141518, costura: 0x2e3036, pliegue: 0x2c2e32, coletero: 0x34503e,
      mangaLarga: 0xa89480, mangaLargaSombra: 0x8a7866,
      vaquero: 0x46607e, costuraVaquero: 0x7a92ac, deshilachado: 0xbcc6ce, roto: 0x9cacbc,
      jersey: 0xa48a70, jerseyOscuro: 0x86705a,
      calcetin: 0xa8a090, calcetinSombra: 0x8c8678,
      zapatilla: 0x343438, suela: 0x6c675e, cordon: 0x262628, plata: 0x9a9ca2
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Mano: 'piel', Oreja: 'piel', Nariz: 'piel', Parpado: 'piel', PiernaPiel: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', PliegueMano: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Melena: 'pelo', MelenaBorde: 'peloSombra', MechonDelantero: 'peloClaro', Flequillo: 'peloClaro', FlequilloCentro: 'peloClaro',
      Pua: 'pelo', PuaClara: 'peloClaro', Coleta: 'pelo', PuntaColeta: 'pelo', Coletero: 'coletero',
      Polo: 'polo', PoloBordeIzquierdo: 'poloForro', PoloBordeDerecho: 'poloForro', CuelloPolo: 'polo', PuntaCuello: 'polo', BotonPolo: 'poloForro',
      CosturaPolo: 'costura', PlieguePolo: 'pliegue', Manga: 'polo', ForroManga: 'poloForro',
      MangaLarga: 'mangaLarga', PunoManga: 'mangaLargaSombra',
      CaderaShort: 'vaquero', PiernaShort: 'vaquero', CosturaVaquero: 'costuraVaquero', Deshilachado: 'deshilachado', Roto: 'roto',
      Jersey: 'jersey', MangaJersey: 'jersey', Elastico: 'jerseyOscuro', PliegueJersey: 'jerseyOscuro',
      Calcetin: 'calcetin', CalcetinSombra: 'calcetinSombra',
      Zapatilla: 'zapatilla', SuelaZapatilla: 'suela', Puntera: 'suela', Cordon: 'cordon', Ojal: 'plata'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Polo: ['polo', 'poloForro'], CuelloPolo: ['polo', 'poloForro'], Melena: ['pelo', 'peloSombra'], Jersey: ['jersey', 'jerseyOscuro'] };
    const METAL = { plata: [0x9a9ca0, 60] };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; los metales brillan
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
    // Celebrar (como en el sprite): brazos en cruz, arriba y vuelta abajo
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
