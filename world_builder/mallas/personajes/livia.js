/**
 * Livia — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/livia.jpeg
 * (vistas de frente, perfil y espalda, coleta, caras, brazal, guante y botas).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rosa corto en puntas: casco cerrado + flequillo en mechones + puntas por los lados y la nuca +
 *   mechones hasta la barbilla + coleta alta con coletero negro y penacho de puntas
 *   → piel clara y ojos rosa rojizo
 *   → túnica verde sin mangas: interior negro en V ribeteado en rosa y dorado, panel rosa con volutas doradas
 *     y cuello alto negro con forro rosa
 *   → capa corta negra sobre los hombros, forro rosa oscuro y en punta detrás
 *   → hombrera granate con borde y voluta dorados solo en el hombro izquierdo
 *   → mangas rosas estampadas, brazales granate con panel rosa y guantes negros sin dedos
 *   → faja verde con ribete rosa, vuelta cruzada granate y hebilla plateada
 *   → faldones verdes hasta medio muslo abiertos delante, con franja rosa y ribete dorado, y tabardo rosa en punta
 *   → pantalón verde muy oscuro y botas altas ciruela con doblez rojo, franja dorada, talón rojo y placa plateada.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'livia',
  categoria: 'personajes',
  nombre: 'Livia (chibi)',
  icono: '🌸',
  origen: 'assets/personajes 3d/livia.jpeg',

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
      // Ojo grande y bajo, por capas: almendra, iris, pupila, dos brillos, pestañas gruesas y párpado inferior
      const ojo = deFrente(s * 0.105, 0.872);
      if (ojo) {
        const blanco = almendra(0.058, 0.04, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);
        ojo.add(bloque(-s * 0.007, -0.002, 0.0045, 0.03, 0.037, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.007, -0.003, 0.0105, 0.014, 0.02, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.016, 0.013, 0.0135, 0.0085, 0.0085, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(s * 0.004, -0.019, 0.012, 0.0048, 0.0048, 0.0035, 1, 'BrilloOjoPequeno'));
        ojo.add(M.tubo([[-s * 0.06, -0.004, 0.007], [-s * 0.037, 0.03, 0.009], [0, 0.043, 0.009], [s * 0.038, 0.037, 0.009], [s * 0.064, 0.016, 0.007], [s * 0.082, 0.03, 0.005], [s * 0.09, 0.042, 0.003]],
          0.0085, 0.003, { segLargo: 28, segRadio: 10, nombre: 'Pestanas' }));           // pestañas largas con rabillo
        ojo.add(M.tubo([[s * 0.05, -0.024, 0.006], [s * 0.066, -0.03, 0.004]], 0.003, 0.0015, { segLargo: 6, segRadio: 6, nombre: 'PestanaInferior' }));
        ojo.add(M.tubo([[-s * 0.046, -0.03, 0.005], [0, -0.039, 0.006], [s * 0.048, -0.031, 0.005]], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));
        poner('Cabeza', ojo);
      }
      // Ceja fina y algo seria
      const ceja = deFrente(s * 0.1, 0.922);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.032, -0.006, 0.007], [0, 0.003, 0.009], [s * 0.036, 0.002, 0.007]], 0.0075, 0.005, { segLargo: 12, segRadio: 10, nombre: 'Ceja' })); // fina y algo seria
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
    // Nariz de botón y boca pequeña con media sonrisa
    const nariz = deFrente(0, 0.846);
    if (nariz) { nariz.add(bloque(0, 0, 0.002, 0.013, 0.011, 0.009, 1, 'Nariz')); poner('Cabeza', nariz); }
    const boca = deFrente(0, 0.828);
    if (boca) {
      boca.add(M.tubo([[-0.018, 0.001, 0.002], [0, -0.002, 0.003], [0.018, 0.002, 0.002]], 0.0028, 0.0028, { segLargo: 12, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- PELO ROSA CORTO EN PUNTAS: casco, flequillo, puntas alrededor, mechones hasta la barbilla y coleta alta ----------------
    const PELO = { y: 1.02, z: -0.012, rx: 0.265, ry: 0.235, rz: 0.255 };
    const REMOLINO = V(0, 0.8, -0.6).normalize();
    const E1 = V(1, 0, 0);
    const E2 = REMOLINO.clone().cross(E1).normalize();
    function relieve(u) {
      const polar = Math.acos(Math.max(-1, Math.min(1, u.dot(REMOLINO))));
      const fi = Math.atan2(u.dot(E2), u.dot(E1)) + 0.15 * polar;
      return { banda: Math.cos(fi * 7) ** 2, peso: suave(0.15, 0.8, polar) }; // 14 mechones
    }
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
    // Nacimiento del pelo (0 = frente, π = nuca): bajo en la frente, encima de las orejas y hasta la nuca
    const NACIMIENTO = [[0, 0.952], [0.5, 0.948], [1.1, 0.928], [1.57, 0.925], [2.2, 0.875], [2.7, 0.835], [Math.PI, 0.825]];
    poner('Cabeza', (() => {
      const C = M.seg(96, 24);
      const NR = M.seg(40, 12);
      const O = V(0, PELO.y, PELO.z);
      const ext = [];
      const int = [];
      for (let i = 0; i <= NR; i++) { ext.push([]); int.push([]); }
      for (let c = 0; c <= C; c++) {
        const fi = -Math.PI + (2 * Math.PI * c) / C;
        const cosB = Math.max(-0.99, Math.min(0.99, (M.interp(NACIMIENTO, Math.abs(fi)) - PELO.y) / PELO.ry));
        let thB = Math.acos(cosB);
        const uB = V(Math.sin(thB) * Math.sin(fi), Math.cos(thB), Math.sin(thB) * Math.cos(fi));
        const rb = relieve(uB);
        thB += 0.12 * rb.peso * rb.banda * rb.banda * suave(0.7, 1.6, Math.abs(fi));   // borde en puntas
        for (let i = 0; i <= NR; i++) {
          const th = thB * Math.pow(i / NR, 0.9);
          const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
          const { banda, peso } = relieve(u);
          const frente = suave(0.55, 0.95, Math.cos(fi)) * suave(1.1, 1.6, th);
          const k = 1 - 0.08 * peso * (1 - Math.pow(banda, 0.8)) * (1 - 0.8 * frente);
          const pe = V(u.x * PELO.rx * k, PELO.y + u.y * PELO.ry * k, PELO.z + u.z * PELO.rz * k);
          const dir = pe.clone().sub(O).normalize();
          const pi = O.clone().addScaledVector(dir, hastaCraneo(O, dir) + 0.006);
          ext[i].push(pe);
          int[i].push(pi);
        }
      }
      const filas = [...ext, ...int.slice().reverse()];
      const pos = [];
      filas.forEach((fila) => fila.forEach((p) => pos.push(p.x, p.y, p.z)));
      return rejilla(pos, C, filas.length - 1, 'Pelo');
    })());
    // Mechón plano y en punta (flequillo y patillas)
    function mechon(puntos, ancho, grosor, nombre) {
      const curva = M.curva(puntos);
      const Ls = M.seg(22, 4);
      const C = M.seg(18, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= Ls; i++) {
        const t = i / Ls;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        const N = P.clone().sub(V(0, 1.0, 0)).normalize();
        N.addScaledVector(T, -N.dot(T)).normalize();
        const B = T.clone().cross(N).normalize();
        const f = Math.pow(1 - t, 0.85) * (0.8 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.5)));
        const a = Math.max(0.001, ancho * 0.5 * f);
        const b = Math.max(0.001, grosor * 0.5 * Math.pow(1 - t, 0.8));
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          pos.push(P.x + N.x * b * Math.cos(th) + B.x * a * Math.sin(th),
            P.y + N.y * b * Math.cos(th) + B.y * a * Math.sin(th),
            P.z + N.z * b * Math.cos(th) + B.z * a * Math.sin(th));
        }
      }
      return rejilla(pos, C, Ls, nombre);
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
    const azar = M.azar(37);
    const ARRIBA = V(0, 1, 0);
    // [ángulo desde arriba, lista de ángulos alrededor, largo, cuánto sube (+) o baja (−) la punta]
    const ANILLOS_PUAS = [
      [0.55, [0.0, 0.6, 1.2, 1.9, -1.9, -1.2, -0.6], 0.09, 0.35],
      [0.92, [1.0, 1.5, 2.0, 2.5, 3.0, -2.8, -2.3, -1.8, -1.3], 0.095, -0.15],
      [1.3, [1.3, 1.75, 2.2, 2.65, 3.1, -2.9, -2.45, -2.0, -1.55], 0.09, -0.75],   // caen por los lados
      [1.75, [2.45, 2.8, 3.14, -2.8, -2.45], 0.085, -1.6]                  // nuca: en punta hacia abajo
    ];
    ANILLOS_PUAS.forEach(([th, fis, largo, sube]) => {
      fis.forEach((fi) => {
        const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
        const raiz = V(u.x * PELO.rx * 0.86, PELO.y + u.y * PELO.ry * 0.86, PELO.z + u.z * PELO.rz * 0.86);
        const dir = u.clone().addScaledVector(ARRIBA, sube).normalize();
        const l = largo * (0.85 + 0.3 * azar());
        poner('Cabeza', pua(raiz, dir, l, 0.12 + 0.04 * azar(), 0.05, (azar() - 0.5) * 0.9, fi, 'Pua'));
      });
    });
    // Punto apoyado sobre el casco de pelo (profundidad calculada del elipsoide + separación)
    const enPelo = (x, y, d = 0.012) => {
      const e = 1 - (x / PELO.rx) ** 2 - ((y - PELO.y) / PELO.ry) ** 2;
      return V(x, y, PELO.z + PELO.rz * Math.sqrt(Math.max(0, e)) + d);
    };
    // Flequillo espeso y despeinado que tapa la frente, con mechones entre y sobre los ojos
    [[-0.01, -0.02, -0.024, 0.884, 0.08], [0.05, 0.075, 0.088, 0.902, 0.085], [-0.06, -0.09, -0.112, 0.906, 0.085], [0.1, 0.13, 0.152, 0.91, 0.09],
      [-0.12, -0.16, -0.186, 0.895, 0.095], [0.155, 0.195, 0.22, 0.874, 0.09], [-0.18, -0.22, -0.242, 0.862, 0.085], [0.02, 0.03, 0.035, 0.9, 0.07]]
      .forEach(([x0, x1, x2, yFin, ancho], k) => {
        poner('Cabeza', mechon([enPelo(x0 * 0.6, 1.17, 0.01), enPelo(x0, 1.08, 0.02), enPelo(x1, 0.985, 0.02), enPelo(x2, yFin, 0.008)], ancho, 0.04, k % 2 ? 'Flequillo' : 'FlequilloClaro'));
      });
    // Mechón de punta hacia arriba sobre la frente (como en la hoja)
    poner('Cabeza', pua(enPelo(-0.02, 1.15, -0.01), V(-0.15, 1, 0.45).normalize(), 0.1, 0.1, 0.045, 0.3, 0, 'Pua'));
    // Mechones que caen delante de las orejas hasta la barbilla
    LADOS.forEach((s) => {
      const pts = [[0.975, 0.045], [0.885, 0.07], [0.8, 0.075]].map(([y, z]) => {
        cabeza.updateMatrixWorld(true);
        rayo.set(V(s * 3, y, z), V(-s, 0, 0));
        const h = rayo.intersectObject(cabeza, false)[0];
        return h ? h.point.clone().add(V(s * 0.016, 0, 0)) : null;
      }).filter(Boolean);
      if (pts.length === 3) poner('Cabeza', mechon(pts, 0.075, 0.03, 'Patilla'));
    });


    // Coleta alta en la coronilla: coletero negro y un penacho de mechones en punta que salen hacia arriba y
    // atrás y caen curvados
    const RAIZ_COLETA = V(0, 1.2, -0.17);
    const coletero = M.pieza(new THREE.TorusGeometry(0.04, 0.016, 10, 24), 'Coletero', 24, 10);
    coletero.position.copy(RAIZ_COLETA);
    coletero.quaternion.setFromUnitVectors(V(0, 0, 1), V(0, 0.75, -0.66).normalize());
    poner('Cabeza', coletero);
    poner('Cabeza', M.tubo([V(0, 1.16, -0.12), RAIZ_COLETA, V(0, 1.23, -0.2)], 0.034, 0.036, { segLargo: 8, segRadio: 16, nombre: 'Pelo' }));
    [[0, 1.0, -0.2, 0.2], [0.5, 0.7, -0.5, 0.18], [-0.5, 0.7, -0.5, 0.18], [0.25, 0.4, -0.9, 0.2], [-0.25, 0.4, -0.9, 0.2],
      [0.7, 0.2, -0.6, 0.15], [-0.7, 0.2, -0.6, 0.15], [0, 0.15, -1, 0.22], [0.35, 0.9, -0.1, 0.14], [-0.35, 0.9, -0.1, 0.14], [0.1, -0.2, -1, 0.17]]
      .forEach(([dx, dy, dz, largo]) => {
        const dir = V(dx, dy, dz).normalize();
        const fi = Math.atan2(dir.x, dir.z);
        poner('Cabeza', pua(V(0, 1.215, -0.19).addScaledVector(dir, 0.02), dir, largo * (0.9 + 0.2 * azar()), 0.075, 0.04, (azar() - 0.5) * 0.7, fi, 'PuaColeta'));
      });

    // ---------------- TÚNICA VERDE SIN MANGAS: interior negro en V, panel rosa con adorno dorado y cuello alto ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));
    const TUNICA = [[0.44, 0.168, 0.126], [0.52, 0.158, 0.118], [0.6, 0.163, 0.122], [0.66, 0.172, 0.134, 0, 0.006], [0.71, 0.174, 0.13, 0, 0.004],
      [0.745, 0.166, 0.118], [0.775, 0.138, 0.1], [0.8, 0.09, 0.078]];
    prendaSolida(TUNICA, null, 0.01, { segRadio: 84, subdiv: 6, nombre: 'Tunica' }).forEach((p) => poner('Pecho', p));
    const molde = loftAbierto(TUNICA, null, { segRadio: 84, subdiv: 6, nombre: 'MoldeTunica' });
    const enMolde = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    const linea = (A, B, n) => Array.from({ length: n + 1 }, (_, k) => [A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n]);
    // interior negro en V bajo el cuello, ribeteado en rosa y dorado
    poner('Pecho', parcheSolido(molde, [[-0.075, 0.79], [0.075, 0.79], [0.006, 0.63], [-0.006, 0.63]], 0.004, 12, 10, 'Interior'));
    LADOS.forEach((s) => {
      poner('Pecho', M.tubo(enMolde(linea([s * 0.08, 0.79], [s * 0.004, 0.628], 8), 1, 0.006), 0.0055, 0.0055, { segLargo: 40, segRadio: 8, nombre: 'RibeteRosa' }));
      poner('Pecho', M.tubo(enMolde(linea([s * 0.094, 0.79], [s * 0.018, 0.628], 8), 1, 0.004), 0.003, 0.003, { segLargo: 40, segRadio: 6, nombre: 'Oro' }));
    });
    // panel rosa central del pecho a la cintura con bordes dorados y voluta
    poner('Pecho', parcheSolido(molde, [[-0.036, 0.628], [0.036, 0.628], [0.036, 0.47], [-0.036, 0.47]], 0.004, 6, 10, 'PanelRosa'));
    LADOS.forEach((s) => poner('Pecho', M.tubo(enMolde(linea([s * 0.038, 0.63], [s * 0.038, 0.47], 6), 1, 0.006), 0.0035, 0.0035, { segLargo: 24, segRadio: 6, nombre: 'Oro' })));
    LADOS.forEach((s) => {
      const pts = [];
      for (let k = 0; k <= 22; k++) {
        const t = k / 22;
        const a = Math.PI * 0.5 + s * t * Math.PI * 2.6;
        const r = 0.017 * (1 - 0.8 * t);
        pts.push([s * 0.012 + s * r * Math.cos(a), 0.56 + r * Math.sin(a)]);
      }
      poner('Pecho', M.tubo(enMolde([[0, 0.61], [s * 0.006, 0.59], ...pts], 1, 0.008), 0.0032, 0.002, { segLargo: 70, segRadio: 6, nombre: 'Oro' }));
    });
    // cuello alto negro con forro rosa y ribete rosa
    const cuelloAlto = prendaSolida([[0.765, 0.098, 0.086, 0, -0.004], [0.8, 0.096, 0.085, 0, -0.006], [0.832, 0.096, 0.084, 0, -0.008]],
      [[0.765, 0.03], [0.832, 0.05]], 0.009, { segRadio: 60, subdiv: 4, nombre: 'CuelloAlto' });
    cuelloAlto.forEach((p) => poner('Pecho', p));
    poner('Pecho', M.tubo(cuelloAlto[0].userData.filasExt[0].filter((_, k) => k % 3 === 0).map(([x, y, z]) => V(x * 1.02, y - 0.002, z * 1.02)),
      0.0055, 0.0055, { segLargo: 80, segRadio: 8, nombre: 'RibeteRosa' }));

    // ---------------- CAPA CORTA NEGRA SOBRE LOS HOMBROS (forro rosa oscuro, en punta detrás) ----------------
    const RX_CAPA = [[0.56, 0.3], [0.66, 0.292], [0.73, 0.27], [0.77, 0.2], [0.8, 0.118]];
    const RZ_CAPA = [[0.56, 0.205], [0.66, 0.195], [0.73, 0.175], [0.77, 0.145], [0.8, 0.098]];
    const capa = (() => {
      const C = M.seg(90, 20);
      const R = M.seg(24, 8);
      const A0 = 0.62;                                                   // abierta delante, deja ver el pecho
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const th = A0 + u * (2 * Math.PI - 2 * A0);
          const yFin = 0.62 - 0.06 * Math.exp(-(((u - 0.5) / 0.05) ** 2)) + 0.02 * Math.cos(2 * Math.PI * u);
          const t = r / R;
          const y = 0.8 + (yFin - 0.8) * t;
          const rx = M.interp(RX_CAPA, y);
          const rz = M.interp(RZ_CAPA, y);
          fe.push([rx * Math.sin(th), y, -0.025 + rz * Math.cos(th)]);
          fi.push([(rx - 0.009) * Math.sin(th), y, -0.025 + (rz - 0.009) * Math.cos(th)]);
        }
        ext.push(fe);
        int.push(fi);
      }
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      const m = rejilla(pos, C, vuelta.length - 1, 'Capa');
      m.userData.capas = { cols: C, exteriores: R + 1 };
      const bordes = [0, C].map((c) => {
        const b = [];
        for (let r = 0; r <= R; r++) b.push(...ext[r][c], ...int[r][c]);
        return rejilla(b, 1, R, 'CapaBorde');
      });
      const bajo = ext[R].filter((_, c) => c % 2 === 0).map(([x, y, z]) => V(x * 1.01, y - 0.002, -0.025 + (z + 0.025) * 1.01));
      return [m, ...bordes, M.tubo(bajo, 0.005, 0.005, { segLargo: 140, segRadio: 6, nombre: 'RibeteRosa' })];
    })();
    capa.forEach((p) => poner('Pecho', p));

    // ---------------- BRAZOS: manga rosa estampada, brazales granate con panel rosa, guantes sin dedos y hombrera izquierda ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t) + 0.004, nombre: 'MangaRosa' }));
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
      aro(0.3, radioBrazo(0.3) + 0.007, 0.007, 'Granate');                  // banda en lo alto de la manga
      funda(0.55, 0.88, 0.013, 'Brazal', 'TapaBrazal', 0.004);
      aro(0.555, radioBrazo(0.555) + 0.014, 0.0055, 'RibeteRosa');
      aro(0.875, radioBrazo(0.875) + 0.014, 0.0055, 'RibeteRosa');
      const fuera = (tt, d) => curva.getPointAt(tt).add(V(s * (radioBrazo(tt) + d), 0, 0));
      poner('Brazo' + L(s), M.tubo([fuera(0.58, 0.013), fuera(0.715, 0.016), fuera(0.85, 0.013)], 0.016, 0.011, { segLargo: 16, segRadio: 10, ruido: (t, a) => 1 - 0.72 * Math.abs(Math.cos(a)), nombre: 'PanelRosa' }));
      poner('Brazo' + L(s), M.tubo([fuera(0.6, 0.019), fuera(0.715, 0.022), fuera(0.83, 0.019)], 0.0028, 0.0028, { segLargo: 16, segRadio: 6, nombre: 'Oro' }));
      funda(0.88, 0.985, 0.008, 'Munequera', 'TapaMunequera');
      poner('Mano' + L(s), bloque(s * 0.258, 0.43, 0.012, 0.048, 0.054, 0.052, 0.65, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.384, 0.018, 0.04, 0.024, 0.044, 0.7, 'Dedos'));
      poner('Mano' + L(s), bloque(s * 0.238, 0.41, 0.054, 0.016, 0.025, 0.015, 0.8, 'Dedos'));
      // hombrera granate solo en el hombro izquierdo, con borde y adorno dorados
      if (s > 0) {
        [[0.21, 0.73, -0.01, 0.09, 0.075, 0.098, -0.34, 'Hombrera'], [0.25, 0.672, -0.01, 0.072, 0.052, 0.086, -0.76, 'HombreraBaja']]
          .forEach(([x, y, z, hx, hy, hz, giro, nombre]) => {
            const sW = M.seg(36, 12);
            const sH = M.seg(14, 6);
            const geo = new THREE.SphereGeometry(1, sW, sH, 0, Math.PI * 2, 0, Math.PI / 2);
            geo.scale(hx, hy, hz);
            const casco = M.pieza(geo, nombre, sW, sH);
            casco.position.set(x, y, z);
            casco.rotation.z = giro;
            poner('BrazoI', casco);
            const tB = M.seg(40, 12);
            const borde = M.pieza(new THREE.TorusGeometry(1, 0.008 / hx, 8, tB), 'Oro', tB, 8);
            borde.rotation.x = Math.PI / 2;
            borde.scale.set(hx, hz, hx);
            const piv = new THREE.Group();
            piv.position.set(x, y, z);
            piv.rotation.z = giro;
            piv.add(borde);
            poner('BrazoI', piv);
          });
        const pts = [];
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const a = Math.PI * 0.2 + t * Math.PI * 2.4;
          const r = 0.026 * (1 - 0.75 * t);
          pts.push(V(0.24 + 0.012 * Math.cos(-0.34) * 0 + r * Math.cos(a) * 0.5, 0.735 + r * Math.sin(a), 0.07 + r * Math.cos(a) * 0.85));
        }
        poner('BrazoI', M.tubo(pts, 0.0035, 0.0025, { segLargo: 60, segRadio: 6, nombre: 'Oro' }));
      }
    });

    // ---------------- FAJA VERDE Y ROSA CON HEBILLA ----------------
    prendaSolida([[0.448, 0.188, 0.142], [0.492, 0.184, 0.139]], null, 0.011, { segRadio: 72, subdiv: 2, nombre: 'Faja' }).forEach((p) => poner('Cadera', p));
    poner('Cadera', M.aro(0, 0.449, 0, 0.19, 0.144, 0.004, 'RibeteRosa'));
    poner('Cadera', M.aro(0, 0.491, 0, 0.186, 0.141, 0.004, 'RibeteRosa'));
    const vuelta = M.aro(0, 0, 0, 0.198, 0.152, 0.008, 'Granate');           // segunda vuelta cruzada, más baja por la derecha
    vuelta.position.set(0, 0.44, 0);
    vuelta.rotation.z = -0.09;
    poner('Cadera', vuelta);
    poner('Cadera', bloque(-0.03, 0.47, 0.145, 0.022, 0.017, 0.005, 0.25, 'Hebilla'));
    poner('Cadera', bloque(-0.028, 0.47, 0.149, 0.014, 0.009, 0.004, 0.25, 'HuecoHebilla'));

    // Faldones verdes hasta medio muslo, abiertos delante, con borde rosa y ribete dorado; tabardo rosa en punta delante
    const FALDON = [[0.25, 0.232, 0.185], [0.32, 0.218, 0.17], [0.4, 0.203, 0.155], [0.48, 0.19, 0.143]];
    const ABRE_DEL = [[0.25, 0.09], [0.33, 0.078], [0.42, 0.06], [0.48, 0.04]];
    const ABRE_TRAS = [[0.25, 0.002], [0.48, 0.002]];
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
      const filas = (c) => Array.from({ length: R }, (_, r) => medio(r, c));
      const bajo = [];
      for (let c = 0; c <= C; c += 2) bajo.push(medio(R - 1, c, 0.002));
      [filas(cDel), bajo].forEach((pts) => poner('Cadera', M.tubo(pts, 0.006, 0.006, { segLargo: pts.length * 3, segRadio: 8, nombre: 'Oro' })));
      // línea dorada interior paralela al bajo (sobre la franja rosa)
      const sobreBajo = [];
      for (let c = 0; c <= C; c += 2) {
        const [x, y, z] = ext[R - 1][c];
        sobreBajo.push(V(x * 1.012, y + 0.034, z * 1.012));
      }
      poner('Cadera', M.tubo(sobreBajo, 0.0028, 0.0028, { segLargo: sobreBajo.length * 3, segRadio: 6, nombre: 'Oro' }));
    });
    const TABARDO = [[0.3, 0, 0.006, 0, 0.16], [0.325, 0.032, 0.006, 0, 0.158], [0.36, 0.05, 0.006, 0, 0.155], [0.42, 0.054, 0.006, 0, 0.15], [0.47, 0.054, 0.006, 0, 0.146]];
    poner('Cadera', M.loft(TABARDO, { segRadio: 40, subdiv: 5, nombre: 'Tabardo' }));
    const czTab = (y) => M.interp(TABARDO.map((f) => [f[0], f[4]]), y) + 0.006;
    poner('Cadera', M.tubo([[-0.054, 0.47], [-0.054, 0.4], [-0.048, 0.355], [-0.028, 0.322], [0, 0.302], [0.028, 0.322], [0.048, 0.355], [0.054, 0.4], [0.054, 0.47]]
      .map(([x, y]) => V(x * 0.96, y, czTab(y))), 0.0045, 0.0045, { segLargo: 60, segRadio: 6, nombre: 'Oro' }));
    poner('Cadera', M.tubo([[-0.03, 0.4], [0, 0.345], [0.03, 0.4]].map(([x, y]) => V(x, y, czTab(y))), 0.0035, 0.0035, { segLargo: 16, segRadio: 6, nombre: 'Oro' }));
    poner('Cadera', bloque(0, 0.415, czTab(0.415) + 0.001, 0.011, 0.013, 0.004, 0.6, 'Oro'));

    // ---------------- PANTALÓN VERDE MUY OSCURO Y BOTAS ALTAS CON DOBLEZ ROJO ----------------
    poner('Cadera', M.loft([[0.27, 0.05, 0.05], [0.3, 0.185, 0.125], [0.42, 0.19, 0.13], [0.5, 0.168, 0.12], [0.52, 0.15, 0.11]], { segRadio: 60, subdiv: 4, nombre: 'CaderaPantalon' }));
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.2, 0.07, 0.075, x, -0.02], [0.26, 0.076, 0.081, x, -0.019], [0.3, 0.082, 0.087, x, -0.017], [0.335, 0.088, 0.093, x * 0.96, -0.015]],
        { segRadio: 40, subdiv: 4, nombre: 'Pierna' }));
      poner('Pierna' + L(s), M.loft([[0.07, 0.072, 0.078, x, -0.02], [0.14, 0.074, 0.08, x, -0.02], [0.205, 0.078, 0.084, x, -0.019]], { segRadio: 40, subdiv: 4, nombre: 'CanaBota' }));
      prendaSolida([[0.195, 0.085, 0.091, x, -0.019], [0.222, 0.089, 0.095, x, -0.019], [0.25, 0.093, 0.099, x, -0.019]], null, 0.009, { segRadio: 44, subdiv: 3, nombre: 'DoblezBota' })
        .forEach((p) => poner('Pierna' + L(s), p));
      poner('Pierna' + L(s), M.aro(x, 0.25, -0.019, 0.093, 0.099, 0.005, 'Plata'));
      poner('Pierna' + L(s), M.aro(x, 0.195, -0.019, 0.085, 0.091, 0.005, 'Plata'));
      // franja dorada por delante de la caña
      poner('Pierna' + L(s), M.tubo([V(x, 0.19, -0.02 + 0.086), V(x, 0.15, -0.02 + 0.082), V(x, 0.11, -0.02 + 0.082)], 0.009, 0.009, { segLargo: 12, segRadio: 10, ruido: (t, a) => 1 - 0.7 * Math.abs(Math.cos(a)), nombre: 'Oro' }));
    });
    const BOTA = [
      [-0.105, 0, 0, 0, -0.09], [-0.095, 0.058, 0.075, 0, -0.09], [-0.06, 0.077, 0.088, 0, -0.092], [0.0, 0.082, 0.088, 0, -0.09],
      [0.06, 0.084, 0.078, 0, -0.08], [0.12, 0.078, 0.064, 0, -0.068], [0.16, 0.06, 0.05, 0, -0.058], [0.182, 0.027, 0.028, 0, -0.054], [0.19, 0, 0, 0, -0.054]
    ];
    const SUELA = BOTA.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.007, rx < 0.01 ? 0 : 0.014, 0, -0.012]);
    LADOS.forEach((s) => {
      const piezas = [[BOTA, 'BotaPie'], [SUELA, 'SuelaBota']].map(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2 + 0.1;
        m.position.set(s * PIE_X, 0.02, -0.02);
        poner('Pie' + L(s), m);
        return m;
      });
      poner('Pie' + L(s), bloque(s * PIE_X, 0.018, -0.108, 0.034, 0.02, 0.032, 0.6, 'Tacon'));
      poner('Pie' + L(s), bloque(s * PIE_X, 0.07, -0.098, 0.05, 0.045, 0.02, 0.6, 'Granate'));      // talón rojo
      // placa plateada sobre el empeine, pegada con rayos desde arriba
      const bota = piezas[0];
      bota.updateMatrixWorld(true);
      const filas = [];
      for (let iz = 0; iz <= 3; iz++) {
        const fila = [];
        for (let ix = 0; ix <= 10; ix++) {
          rayo.set(V(s * PIE_X + (ix / 10 - 0.5) * 0.15, 3, 0.045 + 0.03 * (iz / 3)), V(0, -1, 0));
          const h = rayo.intersectObject(bota, false)[0];
          if (h) fila.push(h.point.clone().add(V(0, 0.005, 0)));
        }
        filas.push(fila);
      }
      if (filas.every((f) => f.length === 11)) {
        const plano = [];
        filas.forEach((f) => f.forEach((p) => plano.push(p.x, p.y, p.z)));
        poner('Pie' + L(s), rejilla(plano, 10, 3, 'Plata'));
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
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.252, 0.49, 0.002],    // muñeca (dentro de la muñequera del guante)
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


    // ---------------- COLORES (paleta de la hoja: rosa, rosa oscuro, verde, verde muy oscuro, ciruela y dorado) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xeac2b0, pielSombra: 0xc29a88, labio: 0xb86a6c,
      pelo: 0xd88894, peloClaro: 0xe498a4, ceja: 0xb86474,
      ojo: 0xf7f2f0, iris: 0xb03850, pupila: 0x3a0a14, brillo: 0xffffff, pestanas: 0x3a1a22,
      verde: 0x34503e, verdeForro: 0x24382c, rosa: 0xd88896, rosaOscuro: 0x9a4058, granate: 0x5e3442,
      negro: 0x2c2a30, pantalon: 0x2c3632, bota: 0x34262e, suela: 0x1e181c, oro: 0xc4a860, plata: 0xa8aab0
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', Dedos: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Pua: 'pelo', PuaColeta: 'peloClaro', Flequillo: 'pelo', FlequilloClaro: 'peloClaro', Patilla: 'peloClaro', Coletero: 'negro',
      Tunica: 'verde', Interior: 'negro', PanelRosa: 'rosa', RibeteRosa: 'rosaOscuro', Oro: 'oro',
      CuelloAlto: 'negro', CuelloAltoBordeIzquierdo: 'rosaOscuro', CuelloAltoBordeDerecho: 'rosaOscuro',
      Capa: 'negro', CapaBorde: 'rosaOscuro',
      MangaRosa: 'rosa', Granate: 'granate', Brazal: 'granate', TapaBrazal: 'granate', Munequera: 'negro', TapaMunequera: 'negro', Guante: 'negro',
      Hombrera: 'granate', HombreraBaja: 'granate',
      Faja: 'verde', Hebilla: 'plata', HuecoHebilla: 'verdeForro',
      Faldon: 'verde', FaldonBordeIzquierdo: 'rosa', FaldonBordeDerecho: 'rosa', Tabardo: 'rosa',
      CaderaPantalon: 'pantalon', Pierna: 'pantalon',
      CanaBota: 'bota', DoblezBota: 'rosaOscuro', BotaPie: 'bota', SuelaBota: 'suela', Tacon: 'suela', Plata: 'plata'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Tunica: ['verde', 'verdeForro'], CuelloAlto: ['negro', 'rosaOscuro'], Capa: ['negro', 'rosaOscuro'], Faja: ['verde', 'verdeForro'],
      DoblezBota: ['rosaOscuro', 'bota'] };
    const METAL = { plata: [0x9a9ca0, 60], oro: [0x6a5a30, 36] };
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
    const c = (k) => new THREE.Color(COLOR[k]);
    g.traverse((o) => {
      if (!o.isMesh) return;
      const nombre = PINTURA[o.name] ? o.name : o.name.replace(/(BordeIzquierdo|BordeDerecho|Base|Pared\d+)$/, '');
      const clave = PINTURA[nombre];
      if (!clave) return;
      if (o.name === 'Faldon') {
        // verde por fuera con franja rosa en el bajo y en los bordes delanteros; forro rosa oscuro
        const { cols, exteriores } = o.userData.capas;
        const [verde, rosa, forro] = [c('verde'), c('rosa'), c('rosaOscuro')];
        pintarVertices(o, (i, p) => {
          const fila = Math.floor(i / (cols + 1));
          if (fila >= exteriores && fila < 2 * exteriores) return forro;
          const y = p.getY(i);
          const borde = p.getZ(i) > 0 && Math.abs(p.getX(i)) - M.interp(ABRE_DEL, y) < 0.022;
          return y < 0.278 || borde ? rosa : verde;
        });
        o.material = material(clave, true);
      } else if (o.name === 'MangaRosa') {
        // manga estampada: arabescos rosa oscuro sobre rosa
        const [rosa, oscuro] = [c('rosa'), c('rosaOscuro')];
        pintarVertices(o, (i, p) => {
          const v = Math.sin(p.getY(i) * 140 + Math.sin(p.getX(i) * 90) * 2) * Math.sin(p.getZ(i) * 120 + p.getY(i) * 40);
          return v > 0.55 ? oscuro : rosa;
        });
        o.material = material(clave, true);
      } else if (o.userData.capas && CAPAS[o.name]) {
        const [fuera, dentro] = CAPAS[o.name].map(c);
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
