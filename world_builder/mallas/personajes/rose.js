/**
 * Rose — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/rose.jpeg
 * (vistas de frente, perfil y espalda, caras, coleta con adorno, obi, mangas, guantes y sandalias).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rosa corto y alborotado: casco cerrado + flequillo en mechones + puntas alrededor + mechones hasta la
 *   barbilla + coleta de lado con penacho de puntas + pelo de punta en la coronilla + adorno (flor negra,
 *   disco y colgante dorados)
 *   → piel clara, ojos rosa, sonrisa y rubor en las mejillas
 *   → kimono turquesa largo hasta los tobillos: cuello cruzado morado y rosa, banda morada delantera y bajo
 *     morado con ribetes dorados
 *   → capa corta morada con capucha recogida, ribete dorado y nudos rosas con borlas delante
 *   → mangas anchas con forro magenta, borde morado y bolsa colgante en punta (furisode); manguitos y guantes
 *     sin dedos oscuros con banda rosa
 *   → obi magenta con dibujo dorado, faja morada, cordón turquesa con nudo y borlas y lazo grande detrás
 *   → tabi oscuros con banda rosa y zori rosas con tira en V.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'rose',
  categoria: 'personajes',
  nombre: 'Rose (chibi)',
  icono: '🌸',
  origen: 'assets/personajes 3d/rose.jpeg',

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
      // Ceja fina y arqueada (gesto alegre)
      const ceja = deFrente(s * 0.1, 0.922);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.032, -0.002, 0.007], [0, 0.006, 0.009], [s * 0.036, 0.001, 0.007]], 0.0075, 0.005, { segLargo: 12, segRadio: 10, nombre: 'Ceja' })); // fina y algo seria
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
    // Nariz de botón y sonrisa abierta
    const nariz = deFrente(0, 0.846);
    if (nariz) { nariz.add(bloque(0, 0, 0.002, 0.013, 0.011, 0.009, 1, 'Nariz')); poner('Cabeza', nariz); }
    const boca = deFrente(0, 0.828);
    if (boca) {
      boca.add(M.tubo([[-0.022, 0.005, 0.002], [-0.01, -0.003, 0.003], [0.01, -0.003, 0.003], [0.022, 0.005, 0.002]], 0.0028, 0.0028, { segLargo: 12, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- PELO ROSA CORTO Y ALBOROTADO: casco, flequillo, puntas alrededor, mechones hasta la barbilla y coleta alta ----------------
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
    const azar = M.azar(43);
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
        const l = largo * 0.85 * (0.85 + 0.3 * azar());
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


    // Coleta de lado (arriba a la izquierda): coletero y penacho de mechones en punta que salen hacia arriba y
    // hacia fuera y caen curvados; adorno de flor negra con disco y colgante dorados junto a la coleta
    const RAIZ_COLETA = V(0.15, 1.165, -0.1);
    const DIR_COLETA = V(0.55, 0.7, -0.45).normalize();
    const coletero = M.pieza(new THREE.TorusGeometry(0.035, 0.013, 10, 24), 'Coletero', 24, 10);
    coletero.position.copy(RAIZ_COLETA);
    coletero.quaternion.setFromUnitVectors(V(0, 0, 1), DIR_COLETA);
    poner('Cabeza', coletero);
    poner('Cabeza', M.tubo([RAIZ_COLETA.clone().addScaledVector(DIR_COLETA, -0.04), RAIZ_COLETA, RAIZ_COLETA.clone().addScaledVector(DIR_COLETA, 0.025)], 0.03, 0.032, { segLargo: 8, segRadio: 16, nombre: 'Pelo' }));
    const puntaColeta = RAIZ_COLETA.clone().addScaledVector(DIR_COLETA, 0.02);
    [[0.6, 0.9, -0.3, 0.13], [1, 0.4, -0.4, 0.14], [0.9, -0.1, -0.5, 0.15], [0.5, -0.5, -0.6, 0.13], [0.2, 0.9, -0.6, 0.12], [1, 0.2, 0.1, 0.11],
      [0.7, -0.4, 0.1, 0.12], [0.3, 0.4, -1, 0.12], [0.8, 0.8, 0.2, 0.1]].forEach(([dx, dy, dz, largo]) => {
      const dir = V(dx, dy, dz).normalize();
      const fi = Math.atan2(dir.x, dir.z);
      poner('Cabeza', pua(puntaColeta.clone().addScaledVector(dir, 0.015), dir, largo * (0.9 + 0.2 * azar()), 0.07, 0.035, (azar() - 0.5) * 0.8, fi, 'PuaColeta'));
    });
    // adorno del pelo (kanzashi): flor negra, disco dorado, varilla y colgante
    const flor = V(0.205, 1.11, 0.0);
    for (let k = 0; k < 5; k++) {
      const a = (2 * Math.PI * k) / 5;
      poner('Cabeza', bloque(flor.x + 0.004, flor.y + 0.018 * Math.cos(a), flor.z + 0.018 * Math.sin(a), 0.007, 0.013, 0.013, 1, 'Flor'));
    }
    poner('Cabeza', bloque(flor.x + 0.01, flor.y, flor.z, 0.006, 0.01, 0.01, 1, 'Oro'));
    poner('Cabeza', M.tubo([V(0.19, 1.15, -0.05), V(0.215, 1.11, 0.0), V(0.225, 1.06, 0.04)], 0.0035, 0.0035, { segLargo: 10, segRadio: 6, nombre: 'Oro' }));
    poner('Cabeza', M.tubo([V(0.214, 1.095, 0.008), V(0.218, 1.06, 0.01)], 0.002, 0.002, { segLargo: 4, segRadio: 5, nombre: 'Oro' }));
    poner('Cabeza', bloque(0.219, 1.05, 0.01, 0.004, 0.012, 0.009, 1, 'Flor'));
    // pelo de punta (antena) en la coronilla
    poner('Cabeza', pua(V(-0.02, 1.235, 0.0), V(-0.1, 1, 0.5).normalize(), 0.085, 0.04, 0.022, 0.8, 0, 'PuaColeta'));
    // rubor en las mejillas
    LADOS.forEach((s) => {
      const m = deFrente(s * 0.13, 0.835);
      if (m) { m.add(bloque(0, 0, 0.003, 0.03, 0.012, 0.004, 1, 'Rubor')); poner('Cabeza', m); }
    });

    // ---------------- KIMONO TURQUESA: parte de arriba con el cuello cruzado morado y rosa ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));
    const TUNICA = [[0.44, 0.176, 0.134], [0.52, 0.168, 0.126], [0.6, 0.17, 0.128], [0.66, 0.176, 0.136, 0, 0.006], [0.71, 0.177, 0.132, 0, 0.004],
      [0.745, 0.168, 0.12], [0.775, 0.14, 0.102], [0.8, 0.092, 0.08]];
    prendaSolida(TUNICA, null, 0.01, { segRadio: 84, subdiv: 6, nombre: 'Kimono' }).forEach((p) => poner('Pecho', p));
    const molde = loftAbierto(TUNICA, null, { segRadio: 84, subdiv: 6, nombre: 'MoldeTunica' });
    const enMolde = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    const linea = (A, B, n) => Array.from({ length: n + 1 }, (_, k) => [A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n]);
    // cuello cruzado (el lado izquierdo sobre el derecho): banda morada por fuera y rosa por dentro, hasta el obi
    LADOS.forEach((s) => {
      const fin = s > 0 ? [-0.03, 0.535] : [0.03, 0.57];
      poner('Pecho', tira(enMolde(linea([s * 0.085, 0.8], fin, 10), 1, 0.006 + (s > 0 ? 0.004 : 0)), 0.032, 0.007, 'Eri'));
      poner('Pecho', tira(enMolde(linea([s * 0.062, 0.8], [fin[0] + s * 0.012, fin[1] + 0.02], 10), 1, 0.004 + (s > 0 ? 0.004 : 0)), 0.014, 0.005, 'EriRosa'));
    });
    // cuello por detrás de la nuca
    poner('Pecho', M.tubo([[-0.085, 0.8, 0.0], [-0.07, 0.81, -0.06], [0, 0.815, -0.088], [0.07, 0.81, -0.06], [0.085, 0.8, 0.0]], 0.016, 0.016, { segLargo: 30, segRadio: 10, nombre: 'Eri' }));

    // ---------------- CAPA CORTA MORADA SOBRE LOS HOMBROS (ribete dorado, en punta detrás, capucha recogida) ----------------
    const RX_CAPA = [[0.6, 0.355], [0.66, 0.345], [0.73, 0.305], [0.77, 0.22], [0.8, 0.12]];
    const RZ_CAPA = [[0.6, 0.235], [0.66, 0.225], [0.73, 0.198], [0.77, 0.155], [0.8, 0.1]];
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
          const yFin = 0.645 - 0.06 * Math.exp(-(((u - 0.5) / 0.05) ** 2)) + 0.02 * Math.cos(2 * Math.PI * u);
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
      return [m, ...bordes, M.tubo(bajo, 0.006, 0.006, { segLargo: 140, segRadio: 6, nombre: 'Oro' })];
    })();
    capa.forEach((p) => poner('Pecho', p));

    // capucha recogida detrás del cuello y nudos rosas con borlas delante de la capa
    poner('Pecho', bloque(0, 0.795, -0.13, 0.13, 0.065, 0.07, 0.8, 'Capucha'));
    poner('Pecho', M.tubo([[-0.12, 0.8, -0.1], [0, 0.835, -0.17], [0.12, 0.8, -0.1]], 0.006, 0.006, { segLargo: 24, segRadio: 6, nombre: 'Oro' }));
    LADOS.forEach((s) => {
      const nudo = V(s * 0.135, 0.745, 0.122);
      poner('Pecho', bloque(nudo.x, nudo.y, nudo.z, 0.011, 0.011, 0.008, 1, 'Borla'));
      [-1, 1].forEach((k) => {
        const lazo = M.pieza(new THREE.TorusGeometry(0.009, 0.003, 6, 14), 'Borla', 14, 6);
        lazo.position.set(nudo.x + k * 0.014, nudo.y + 0.004, nudo.z);
        poner('Pecho', lazo);
      });
      poner('Pecho', M.tubo([nudo, nudo.clone().add(V(0, -0.04, 0.004)), nudo.clone().add(V(0, -0.065, 0.006))], 0.004, 0.012, { segLargo: 10, segRadio: 10, nombre: 'Borla' }));
    });
    poner('Pecho', M.tubo([[-0.135, 0.748, 0.124], [0, 0.73, 0.152], [0.135, 0.748, 0.124]], 0.0028, 0.0028, { segLargo: 16, segRadio: 6, nombre: 'Borla' }));

    // ---------------- BRAZOS: manga ancha de kimono (forro magenta y bolsa colgante en punta), manguitos y guantes ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      const aro = (tt, r, g0, nombre) => {
        const tS = M.seg(36, 12);
        const m = M.pieza(new THREE.TorusGeometry(r, g0, 8, tS), nombre, tS, 8);
        m.position.copy(curva.getPointAt(tt));
        m.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), m);
      };
      // manguito oscuro hasta la mano con banda rosa y guante sin dedos
      const ptsM = [0, 0.5, 1].map((k) => curva.getPointAt(0.45 + 0.53 * k));
      poner('Brazo' + L(s), M.tubo(ptsM, 1, 1, { segLargo: 16, segRadio: 28, ruido: (t) => radioBrazo(0.45 + 0.53 * t) + 0.006, nombre: 'Manguito' }));
      aro(0.86, radioBrazo(0.86) + 0.009, 0.006, 'Rosa');
      poner('Mano' + L(s), bloque(s * 0.258, 0.43, 0.012, 0.047, 0.052, 0.05, 0.65, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.384, 0.018, 0.039, 0.023, 0.043, 0.7, 'Dedos'));
      poner('Mano' + L(s), bloque(s * 0.238, 0.41, 0.054, 0.016, 0.025, 0.015, 0.8, 'Dedos'));
      // manga ancha: se abre desde el hombro hasta antes de la muñeca
      const T1 = 0.7;
      const radioManga = (t) => radioBrazo(t) + 0.012 + 0.055 * Math.pow(t / T1, 1.5);
      const ptsK = [0, 0.25, 0.5, 0.75, 1].map((k) => curva.getPointAt(0.03 + (T1 - 0.03) * k));
      poner('Brazo' + L(s), M.tubo(ptsK, 1, 1, { segLargo: 24, segRadio: 36, ruido: (t) => radioManga(0.03 + (T1 - 0.03) * t), nombre: 'MangaKimono' }));
      const tS = M.seg(36, 12);
      const boca = M.pieza(new THREE.RingGeometry(radioBrazo(T1) + 0.004, radioManga(T1), tS, 2), 'ForroManga', tS, 2);
      boca.position.copy(curva.getPointAt(T1));
      boca.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(T1));
      poner('Brazo' + L(s), boca);
      aro(T1, radioManga(T1), 0.007, 'Morado');
      aro(T1 - 0.03, radioManga(T1 - 0.03) + 0.002, 0.0035, 'Oro');
      // bolsa colgante de la manga (furisode), turquesa con franja morada y punta magenta
      const c = curva.getPointAt(0.6);
      poner('Brazo' + L(s), bloque(c.x + s * 0.01, 0.4, c.z - 0.055, 0.036, 0.14, 0.075, 0.85, 'Furi'));
    });

    // ---------------- OBI MAGENTA CON DIBUJO DORADO, CORDÓN TURQUESA Y LAZO GRANDE DETRÁS ----------------
    prendaSolida([[0.425, 0.2, 0.155], [0.48, 0.203, 0.158], [0.54, 0.196, 0.15]], null, 0.012, { segRadio: 72, subdiv: 3, nombre: 'Obi' }).forEach((p) => poner('Cadera', p));
    poner('Cadera', M.aro(0, 0.428, 0, 0.206, 0.161, 0.01, 'Morado'));                // faja morada de abajo
    poner('Cadera', M.aro(0, 0.537, 0, 0.199, 0.153, 0.005, 'Morado'));
    // dibujo dorado ondulado
    [[0.465, 0.0], [0.505, 1.6]].forEach(([y0, fase]) => {
      const pts = [];
      for (let k = 0; k <= 72; k++) {
        const a = (2 * Math.PI * k) / 72;
        pts.push(V(Math.sin(a) * 0.2045, y0 + 0.008 * Math.sin(a * 9 + fase), Math.cos(a) * 0.1595));
      }
      poner('Cadera', M.tubo(pts, 0.0028, 0.0028, { segLargo: 220, segRadio: 6, nombre: 'Oro' }));
    });
    poner('Cadera', M.aro(0, 0.485, 0, 0.207, 0.162, 0.005, 'Cordon'));               // cordón (obijime)
    const nudoC = V(0.07, 0.485, 0.158);
    poner('Cadera', bloque(nudoC.x, nudoC.y, nudoC.z, 0.012, 0.012, 0.009, 1, 'Cordon'));
    [[-1, 0.4], [1, -0.4]].forEach(([k, giro]) => {
      const l = M.pieza(new THREE.TorusGeometry(0.012, 0.0035, 6, 14), 'Cordon', 14, 6);
      l.position.set(nudoC.x + k * 0.017, nudoC.y + 0.006, nudoC.z);
      l.rotation.z = giro;
      poner('Cadera', l);
    });
    [-0.008, 0.008].forEach((dx) => poner('Cadera', M.tubo([nudoC.clone().add(V(dx, 0, 0.002)), nudoC.clone().add(V(dx * 1.5, -0.04, 0.008)), nudoC.clone().add(V(dx * 1.6, -0.07, 0.01))],
      0.0035, 0.009, { segLargo: 10, segRadio: 8, nombre: 'Cordon' })));
    // lazo grande detrás: dos lazadas, nudo y dos caídas con el dibujo dorado
    const LAZO = V(0, 0.49, -0.19);
    LADOS.forEach((s) => {
      const p = new THREE.Group();
      p.position.set(s * 0.085, LAZO.y + 0.015, LAZO.z - 0.012);
      p.rotation.z = -s * 0.25;
      p.add(bloque(0, 0, 0, 0.085, 0.06, 0.03, 0.8, 'Lazo'));
      poner('Cadera', p);
      const caida = [V(s * 0.02, LAZO.y - 0.02, LAZO.z - 0.02), V(s * 0.045, 0.4, -0.205), V(s * 0.06, 0.33, -0.205), V(s * 0.068, 0.28, -0.2)];
      poner('Cadera', M.tubo(caida, 0.035, 0.04, { segLargo: 20, segRadio: 14, ruido: (t, a) => 1 - 0.78 * Math.abs(Math.cos(a)), nombre: 'Lazo' }));
      poner('Cadera', M.tubo([V(s * 0.04, 0.315, -0.214), V(s * 0.065, 0.305, -0.214), V(s * 0.09, 0.315, -0.212)], 0.0028, 0.0028, { segLargo: 10, segRadio: 6, nombre: 'Oro' }));
    });
    poner('Cadera', bloque(LAZO.x, LAZO.y, LAZO.z - 0.02, 0.03, 0.04, 0.025, 0.8, 'Lazo'));

    // ---------------- FALDA LARGA DEL KIMONO HASTA LOS TOBILLOS (bajo morado y dorado, banda delantera) ----------------
    const FALDA = [[0.085, 0.218, 0.172], [0.16, 0.214, 0.168], [0.26, 0.207, 0.161], [0.35, 0.199, 0.154], [0.44, 0.19, 0.146]];
    prendaSolida(FALDA, null, 0.01, { segRadio: 84, subdiv: 5, nombre: 'Falda' }).forEach((p) => poner('Cadera', p));
    const moldeF = loftAbierto(FALDA, null, { segRadio: 84, subdiv: 5, nombre: 'MoldeFalda' });
    poner('Cadera', tira([0.43, 0.33, 0.23, 0.13, 0.092].map((y) => sobre(moldeF, 0.035, y, 1, 0.006)).filter(Boolean), 0.036, 0.008, 'BandaMorada'));
    poner('Cadera', tira([0.43, 0.33, 0.23, 0.13, 0.092].map((y) => sobre(moldeF, 0.06, y, 1, 0.005)).filter(Boolean), 0.01, 0.005, 'Rosa'));
    poner('Cadera', M.aro(0, 0.087, 0, 0.219, 0.173, 0.005, 'Oro'));
    poner('Cadera', M.aro(0, 0.126, 0, 0.217, 0.171, 0.0035, 'Oro'));

    // ---------------- TABI OSCUROS Y ZORI ROSAS ----------------
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.05, 0.06, 0.066, x, -0.02], [0.12, 0.062, 0.068, x, -0.02], [0.2, 0.066, 0.072, x, -0.019]], { segRadio: 32, subdiv: 3, nombre: 'Tabi' }));
      poner('Pierna' + L(s), M.aro(x, 0.075, -0.02, 0.063, 0.069, 0.007, 'Rosa'));
    });
    const PIE = [
      [-0.105, 0, 0, 0, -0.045], [-0.095, 0.058, 0.045, 0, -0.045], [-0.06, 0.075, 0.05, 0, -0.05], [0.0, 0.08, 0.052, 0, -0.052],
      [0.06, 0.084, 0.048, 0, -0.048], [0.12, 0.08, 0.04, 0, -0.04], [0.16, 0.064, 0.034, 0, -0.034], [0.182, 0.03, 0.024, 0, -0.026], [0.19, 0, 0, 0, -0.026]
    ];
    const ZORI = PIE.map(([l, rx]) => [l * 1.06, rx < 0.01 ? 0 : rx + 0.012, rx < 0.01 ? 0 : 0.012, 0, 0.0]);
    LADOS.forEach((s) => {
      const tabi = M.loft(PIE, { segRadio: 44, subdiv: 4, nombre: 'Tabi' });
      tabi.rotation.x = Math.PI / 2;
      tabi.position.set(s * PIE_X, 0.03, -0.02);
      poner('Pie' + L(s), tabi);
      const zori = M.loft(ZORI, { segRadio: 44, subdiv: 4, nombre: 'Zori' });
      zori.rotation.x = Math.PI / 2;
      zori.position.set(s * PIE_X, 0.017, -0.02);
      poner('Pie' + L(s), zori);
      poner('Pie' + L(s), bloque(s * PIE_X, 0.008, -0.02, 0.085, 0.009, 0.16, 0.4, 'ZoriBase'));
      // tira de la sandalia en V desde entre los dedos y separación del dedo gordo del tabi
      const dedo = V(s * PIE_X - s * 0.022, 0.06, 0.135);
      LADOS.forEach((k) => poner('Pie' + L(s), M.tubo([dedo, V(s * PIE_X + k * 0.05, 0.072, 0.07), V(s * PIE_X + k * 0.082, 0.03, 0.02)], 0.0065, 0.0065, { segLargo: 14, segRadio: 8, nombre: 'Hanao' })));
      poner('Pie' + L(s), M.tubo([V(dedo.x, 0.062, 0.168), V(dedo.x, 0.07, 0.12)], 0.002, 0.002, { segLargo: 4, segRadio: 5, nombre: 'Manguito' }));
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


    // ---------------- COLORES (paleta de la hoja: rosa, turquesa, morado, magenta y dorado) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xeec2aa, pielSombra: 0xc69a84, labio: 0xb85a6a, rubor: 0xf0a0a8,
      pelo: 0xd8689a, peloClaro: 0xe478a6, ceja: 0xb8507e,
      ojo: 0xf7f2f0, iris: 0xb8466e, pupila: 0x3a0c1e, brillo: 0xffffff, pestanas: 0x3a1a24,
      turquesa: 0x2a7480, turquesaOscuro: 0x1e5862, morado: 0x553a72, moradoOscuro: 0x3c2852, magenta: 0x96285a, magentaOscuro: 0x6e1c42,
      rosa: 0xd27aa0, oro: 0xc0a050, negro: 0x222026, oscuro: 0x3a2a30, zori: 0xc66a92, zoriBase: 0x8a3a60
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Dedos: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio', Rubor: 'rubor',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Pua: 'pelo', PuaColeta: 'peloClaro', Flequillo: 'pelo', FlequilloClaro: 'peloClaro', Patilla: 'peloClaro', Coletero: 'negro', Flor: 'negro', Oro: 'oro',
      Kimono: 'turquesa', Eri: 'morado', EriRosa: 'rosa',
      Capa: 'morado', CapaBorde: 'moradoOscuro', Capucha: 'morado', Borla: 'rosa',
      MangaKimono: 'turquesa', ForroManga: 'magenta', Morado: 'morado', Furi: 'turquesa', Rosa: 'rosa',
      Manguito: 'oscuro', Guante: 'oscuro',
      Obi: 'magenta', Cordon: 'turquesa', Lazo: 'magenta',
      Falda: 'turquesa', BandaMorada: 'morado',
      Tabi: 'oscuro', Zori: 'zori', ZoriBase: 'zoriBase', Hanao: 'magenta'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Kimono: ['turquesa', 'turquesaOscuro'], Capa: ['morado', 'moradoOscuro'], Obi: ['magenta', 'magentaOscuro'] };
    const METAL = { oro: [0x6a5a30, 36] };
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
      if (o.name === 'Falda') {
        // turquesa con el bajo morado; forro turquesa oscuro
        const { cols, exteriores } = o.userData.capas;
        const [tq, mo, forro] = [c('turquesa'), c('morado'), c('turquesaOscuro')];
        pintarVertices(o, (i, p) => {
          const fila = Math.floor(i / (cols + 1));
          if (fila >= exteriores && fila < 2 * exteriores) return forro;
          return p.getY(i) < 0.124 ? mo : tq;
        });
        o.material = material(clave, true);
      } else if (o.name === 'Furi') {
        // bolsa de la manga: turquesa, franja morada y punta magenta
        o.geometry.computeBoundingBox();
        const y0 = o.geometry.boundingBox.min.y;
        const [tq, mo, mg] = [c('turquesa'), c('morado'), c('magenta')];
        pintarVertices(o, (i, p) => { const h = p.getY(i) - y0; return h < 0.07 ? mg : h < 0.092 ? mo : tq; });
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
