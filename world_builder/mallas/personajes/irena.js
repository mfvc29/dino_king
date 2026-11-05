/**
 * Irena — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/irena.jpeg
 * (vistas de frente, perfil y espalda, trenza, cuello del polo, cinturones, guante, botín y caras).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rubio muy largo: casco cerrado + flequillo + melena lisa hasta la cintura + mechones delante de los
 *   hombros + trenzas de corona en los lados + dos coletas altas que acaban en trenza con lazo morado
 *   → piel clara y ojos ámbar
 *   → polo azul de manga corta: cuello de camisa con botones en las puntas, tapeta con dos botones, flor de
 *     lis dorada en el pecho y puños en las mangas
 *   → guanteletes negros con bandas moradas y franja morada ribeteada en dorado
 *   → dos cinturones morados cruzados con ribete y medallones dorados y un paño oscuro anudado a la cintura
 *     que cae por la izquierda con cenefa dorada
 *   → pantalón negro ajustado y botines con doblez morado ribeteado, correa plateada en el empeine y tacón.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * La melena, los mechones y las coletas se doblan con la cabeza (arriba) y el pecho (abajo) (M.pielConHuesos).
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'irena',
  categoria: 'personajes',
  nombre: 'Irena (chibi)',
  icono: '🌻',
  origen: 'assets/personajes 3d/irena.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.112;                              // separación de piernas y botines desde el centro
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
      // Ceja fina y algo arqueada
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

    // ---------------- PELO RUBIO LARGO: casco, flequillo, melena lisa, mechones, trenzas de corona y dos coletas trenzadas ----------------
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
    // Flequillo salvaje en mechones en punta, abierto al centro; no tapa los ojos
    [[-0.02, -0.05, -0.06, 0.9, 0.085], [0.03, 0.06, 0.07, 0.905, 0.085], [0.0, -0.008, -0.02, 0.922, 0.07],
      [-0.06, -0.1, -0.12, 0.91, 0.07], [0.07, 0.11, 0.13, 0.912, 0.07],
      [-0.11, -0.15, -0.18, 0.88, 0.1], [0.115, 0.155, 0.185, 0.88, 0.1], [-0.19, -0.235, -0.26, 0.845, 0.1], [0.195, 0.24, 0.265, 0.845, 0.1]]
      .forEach(([x0, x1, x2, yFin, ancho], k) => {
        poner('Cabeza', mechon([enPelo(x0 * 0.6, 1.16, 0.008), enPelo(x0, 1.07, 0.016), enPelo(x1, 0.97, 0.018), enPelo(x2, yFin, 0.008)], ancho, 0.038, k < 5 ? 'FlequilloCentro' : 'Flequillo'));
      });
    // Melena lisa por la espalda hasta la cintura, cerrada (capa de fuera con mechones + capa de dentro + bordes)
    // Perfil por altura: [y, semiancho, semifondo, centro z, medio ángulo libre delante]
    const PERFIL_MELENA = [[0.42, 0.25, 0.27, -0.03, 1.9], [0.56, 0.255, 0.272, -0.03, 1.9], [0.68, 0.258, 0.27, -0.025, 1.9],
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
          const yFin = 0.47 - 0.035 * Math.pow(pico, 1.2) - 0.012 * Math.sin(u * 23);
          const t = r / R;
          const y = 0.985 + (yFin - 0.985) * t;
          const medio = perfil(y, 4);
          const th = medio + u * (2 * Math.PI - 2 * medio);
          const rx = perfil(y, 1);
          const rz = perfil(y, 2);
          const cz = perfil(y, 3);
          const mechones = 1 + 0.04 * Math.pow(Math.cos(Math.PI * fase), 2) * suave(0.93, 0.8, y);   // relieve de mechones
          const abre = 1;                                                 // pelo liso: las puntas no se abren
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
      // Mechones largos delante de los hombros, hasta la cintura
      pieles.push([mechonLargo([V(s * 0.235, 0.985, 0.0), V(s * 0.262, 0.87, 0.035), V(s * 0.248, 0.75, 0.098), V(s * 0.22, 0.62, 0.14), V(s * 0.205, 0.5, 0.158), V(s * 0.215, 0.42, 0.16)], 0.1, 0.034, 'MechonDelantero'), pesoPelo]);
      pieles.push([mechonLargo([V(s * 0.25, 0.97, -0.04), V(s * 0.285, 0.85, -0.01), V(s * 0.285, 0.72, 0.05), V(s * 0.265, 0.6, 0.09), V(s * 0.26, 0.5, 0.1)], 0.09, 0.03, 'MechonDelantero'), pesoPelo]);
    });

    // Trenza: tubo con lóbulos que se alternan a un lado y al otro (los mechones entrelazados)
    const trenzado = (vueltas, base = 0.8) => (t, a) => {
      const k = Math.floor(t * vueltas);
      const fase = (t * vueltas) % 1;
      const lado = k % 2 ? 1 : -1;
      return base + (1 - base) * 1.6 * Math.sin(Math.PI * fase) * (0.55 + 0.45 * Math.max(0, Math.cos(a - lado * 1.1)));
    };
    LADOS.forEach((s) => {
      // trenza de corona: de la sien a la raíz de la coleta, pegada al casco de pelo
      const corona = [V(s * 0.205, 1.0, 0.115), V(s * 0.236, 1.05, 0.06), V(s * 0.244, 1.1, -0.0), V(s * 0.228, 1.15, -0.06), V(s * 0.2, 1.17, -0.1)];
      poner('Cabeza', M.tubo(corona, 0.017, 0.019, { segLargo: 60, segRadio: 12, ruido: trenzado(9), nombre: 'TrenzaCorona' }));
      // coleta alta: nace en el lado de la coronilla, cae lisa y gruesa y acaba en trenza con lazo morado
      const lisa = [V(s * 0.205, 1.17, -0.1), V(s * 0.27, 1.17, -0.12), V(s * 0.315, 1.06, -0.13), V(s * 0.33, 0.9, -0.12),
        V(s * 0.33, 0.72, -0.11), V(s * 0.32, 0.55, -0.1), V(s * 0.305, 0.43, -0.09)];
      const rLisa = (t) => (t < 0.12 ? 0.04 + 0.025 * (t / 0.12) : 0.065 - 0.032 * Math.pow((t - 0.12) / 0.88, 1.2));
      pieles.push([M.tubo(lisa, 1, 1, { segLargo: 70, segRadio: 22, ruido: (t, a) => rLisa(t) * (1 + 0.06 * Math.cos(a * 5)), nombre: 'Coleta' }), pesoPelo]);
      const trenza = [V(s * 0.305, 0.44, -0.09), V(s * 0.298, 0.36, -0.085), V(s * 0.292, 0.28, -0.08), V(s * 0.288, 0.215, -0.078)];
      pieles.push([M.tubo(trenza, 0.033, 0.024, { segLargo: 60, segRadio: 14, ruido: trenzado(8), nombre: 'Trenza' }), pesoPelo]);
      const nudo = M.pieza(new THREE.TorusGeometry(0.02, 0.008, 8, 18), 'Lazo', 18, 8);
      nudo.position.set(s * 0.288, 0.205, -0.078);
      nudo.rotation.x = Math.PI / 2;
      pieles.push([nudo, pesoPelo]);
      pieles.push([M.tubo([V(s * 0.288, 0.205, -0.078), V(s * 0.29, 0.17, -0.08), V(s * 0.296, 0.13, -0.084)], 0.022, 0.002, { segLargo: 12, segRadio: 12, nombre: 'PuntaTrenza' }), pesoPelo]);
    });

    // ---------------- CUERPO (asoma en la abertura del cuello y en los brazos) ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));

    // ---------------- POLO AZUL: cuello de camisa, tapeta con botones, emblema dorado y manga corta ----------------
    const POLO = [[0.44, 0.163, 0.122], [0.52, 0.153, 0.113], [0.6, 0.159, 0.118], [0.66, 0.169, 0.13, 0, 0.006], [0.71, 0.171, 0.128, 0, 0.004],
      [0.745, 0.165, 0.116], [0.775, 0.136, 0.099], [0.8, 0.088, 0.076]];
    // cerrado de la cintura a la tapeta y abierto en V solo en el cuello
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
    LADOS.forEach((s) => {
      poner('Pecho', parcheSolido(molde, [[s * 0.05, 0.806], [s * 0.112, 0.792], [s * 0.094, 0.742], [s * 0.046, 0.758]], 0.009, 6, 8, 'PuntaCuello'));
      botonEn(s * 0.088, 0.753, 0.011, 0.0045);                          // botones en las puntas del cuello
    });
    // tapeta: costuras a los lados de la abertura y dos botones
    LADOS.forEach((s) => poner('Pecho', costura(enMolde([[s * 0.018, 0.74], [s * 0.016, 0.7], [s * 0.014, 0.655], [s * 0.012, 0.645]]), 'CosturaPolo', 0.0018)));
    poner('Pecho', costura(enMolde([[-0.014, 0.645], [0, 0.642], [0.014, 0.645]]), 'CosturaPolo', 0.0018));
    botonEn(0.0, 0.69);
    botonEn(0.0, 0.66);
    // emblema dorado (flor de lis) en el pecho izquierdo
    const pe = sobre(molde, 0.075, 0.672, 1, 0.003);
    if (pe) {
      const em = new THREE.Group();
      em.position.copy(pe);
      em.add(M.tubo([[0, -0.012, 0], [0, 0.002, 0.001], [0, 0.016, 0]], 0.0042, 0.001, { segLargo: 8, segRadio: 8, nombre: 'Emblema' }));
      LADOS.forEach((s) => em.add(M.tubo([[0, -0.002, 0.001], [s * 0.008, 0.006, 0.001], [s * 0.012, 0.0, 0.001], [s * 0.009, -0.006, 0]], 0.0026, 0.0012, { segLargo: 10, segRadio: 6, nombre: 'Emblema' })));
      em.add(M.tubo([[-0.008, -0.004, 0.001], [0.008, -0.004, 0.001]], 0.0022, 0.0022, { segLargo: 4, segRadio: 6, nombre: 'Emblema' }));
      poner('Pecho', em);
    }

    // ---------------- BRAZOS: manga corta con puño, guantelete negro con bandas y franja moradas ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
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
      funda(0.06, 0.34, 0.014, 'Manga', 'ForroManga', 0.004);               // manga corta abullonada
      aro(0.325, radioBrazo(0.325) + 0.015, 0.0065, 'Manga');                 // puño de la manga
      const pb = curva.getPointAt(0.325);
      poner('Brazo' + L(s), bloque(pb.x + s * (radioBrazo(0.325) + 0.02), pb.y, pb.z + 0.008, 0.003, 0.005, 0.005, 1, 'BotonPolo'));
      funda(0.56, 0.985, 0.009, 'Guantelete', 'TapaGuantelete');
      aro(0.575, radioBrazo(0.575) + 0.011, 0.006, 'BandaMorada');
      aro(0.93, radioBrazo(0.93) + 0.011, 0.006, 'BandaMorada');
      // franja morada con ribete dorado por fuera del antebrazo
      const fuera = (tt, d) => curva.getPointAt(tt).add(V(s * (radioBrazo(tt) + d), 0, 0));
      poner('Brazo' + L(s), M.tubo([fuera(0.6, 0.008), fuera(0.72, 0.01), fuera(0.86, 0.008)], 0.013, 0.007, { segLargo: 16, segRadio: 10, ruido: (t, a) => 1 - 0.7 * Math.abs(Math.cos(a)), nombre: 'FranjaMorada' }));
      poner('Brazo' + L(s), M.tubo([fuera(0.6, 0.012), fuera(0.72, 0.014), fuera(0.86, 0.012)], 0.0025, 0.0025, { segLargo: 16, segRadio: 6, nombre: 'Oro' }));
      // mano con guante negro
      poner('Mano' + L(s), bloque(s * 0.258, 0.43, 0.012, 0.048, 0.054, 0.052, 0.65, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.384, 0.018, 0.04, 0.024, 0.044, 0.7, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.238, 0.41, 0.054, 0.016, 0.025, 0.015, 0.8, 'Guante'));
    });

    // ---------------- PANTALÓN NEGRO AJUSTADO, CINTURONES MORADOS CRUZADOS Y PAÑO ANUDADO ----------------
    const cadera = M.loft([[0.27, 0.05, 0.05], [0.3, 0.185, 0.125], [0.42, 0.19, 0.13], [0.5, 0.168, 0.12], [0.52, 0.15, 0.11]], { segRadio: 60, subdiv: 4, nombre: 'CaderaPantalon' });
    poner('Cadera', cadera);
    const enCadera = (lista, lado = 1) => lista.map(([x, y]) => sobre(cadera, x, y, lado, 0.0015)).filter(Boolean);
    LADOS.forEach((s) => {
      poner('Cadera', costura(enCadera([[s * 0.045, 0.39], [s * 0.08, 0.392], [s * 0.115, 0.388], [s * 0.112, 0.35], [s * 0.08, 0.338], [s * 0.048, 0.352], [s * 0.045, 0.39]], -1), 'CosturaPantalon'));   // bolsillos de atrás
      poner('Cadera', costura(enCadera([[s * 0.1, 0.44], [s * 0.13, 0.41], [s * 0.155, 0.385]]), 'CosturaPantalon'));
    });
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.13, 0.068, 0.073, x, -0.02], [0.2, 0.072, 0.077, x, -0.02], [0.27, 0.078, 0.083, x, -0.018], [0.335, 0.088, 0.093, x * 0.96, -0.015]],
        { segRadio: 40, subdiv: 5, nombre: 'Pierna' }));
      poner('Pierna' + L(s), costura([0.15, 0.22, 0.29].map((y) => V(x, y, -0.02 + 0.073 + (y - 0.13) * 0.07 + 0.0015)), 'CosturaPantalon'));   // raya delantera
    });
    // cinturón morado en banda plana e inclinada (dos, cruzados delante y detrás)
    function cinta(y0, incl, rx, rz, alto, grosor, nombre) {
      const C = M.seg(96, 24);
      const pos = [];
      for (let c = 0; c <= C; c++) {
        const th = (c / C) * Math.PI * 2;
        const sx = Math.sin(th);
        const cz = Math.cos(th);
        const y = y0 + incl * rx * sx;
        [[rx, alto], [rx, -alto], [rx - grosor, -alto], [rx - grosor, alto], [rx, alto]].forEach(([r, h]) => {
          const k = r / rx;
          pos.push(rx * k * sx, y + h * 0.5, rz * k * cz);
        });
      }
      return rejilla(pos, 4, C, nombre);
    }
    [[0.425, 0.32], [0.425, -0.32]].forEach(([y0, incl]) => {
      poner('Cadera', cinta(y0, incl, 0.2, 0.142, 0.024, 0.007, 'Cinturon'));
      poner('Cadera', cinta(y0, incl, 0.202, 0.144, 0.026, 0.002, 'RibeteCinturon'));
    });
    // medallones dorados con gema morada sobre los cinturones
    [[0.085, 0.32], [-0.13, 0.32]].forEach(([x, incl]) => {
      const y = 0.425 + incl * x;
      const z = 0.142 * Math.sqrt(1 - (x / 0.2) ** 2) + 0.004;
      const m = new THREE.Group();
      m.position.set(x, y, z);
      m.rotation.y = Math.atan2(x / 0.2 ** 2, z / 0.142 ** 2);
      m.add(bloque(0, 0, 0, 0.02, 0.02, 0.006, 0.55, 'Medallon'));
      m.add(bloque(0, 0, 0.005, 0.009, 0.009, 0.004, 1, 'Gema'));
      poner('Cadera', m);
    });
    // paño oscuro anudado a la cintura: banda alrededor y caída por el lado izquierdo con cenefa dorada
    prendaSolida([[0.455, 0.178, 0.13], [0.505, 0.168, 0.124]], null, 0.01, { segRadio: 72, subdiv: 3, nombre: 'Pano' }).forEach((p) => poner('Cadera', p));
    const CAIDA = [[0.19, 0.228, 0.18], [0.28, 0.215, 0.165], [0.38, 0.205, 0.152], [0.47, 0.19, 0.142]];
    const caida = prendaArco(CAIDA, (y) => 0.35 + 0.25 * (0.47 - y), (y) => 2.1 - 0.3 * (0.47 - y), 0.008, { segRadio: 40, subdiv: 6, nombre: 'Pano' });
    caida.piezas.forEach((p) => poner('Cadera', p));
    const R = caida.ext.length;
    [0.004, 0.022].forEach((sube, k) => {
      const pts = caida.ext[R - 1].filter((_, c) => c % 2 === 0).map(([x, y, z]) => V(x * 1.012, y + sube, z * 1.012));
      poner('Cadera', M.tubo(pts, k ? 0.0035 : 0.005, k ? 0.0035 : 0.005, { segLargo: 60, segRadio: 6, nombre: 'Oro' }));
    });
    poner('Cadera', bloque(0.115, 0.47, 0.115, 0.03, 0.028, 0.022, 0.7, 'Nudo'));          // nudo del paño
    poner('Cadera', M.tubo([[0.12, 0.46, 0.13], [0.13, 0.42, 0.135], [0.135, 0.38, 0.132]], 0.018, 0.006, { segLargo: 12, segRadio: 12, nombre: 'Nudo' }));

    // ---------------- BOTINES: doblez morado ribeteado, hebilla plateada en el empeine y tacón ----------------
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.07, 0.07, 0.076, x, -0.02], [0.12, 0.072, 0.078, x, -0.02]], { segRadio: 40, subdiv: 3, nombre: 'CanaBota' }));
      prendaSolida([[0.115, 0.08, 0.086, x, -0.02], [0.14, 0.083, 0.089, x, -0.02], [0.168, 0.086, 0.092, x, -0.02]], null, 0.008, { segRadio: 44, subdiv: 3, nombre: 'DoblezBota' })
        .forEach((p) => poner('Pierna' + L(s), p));
      poner('Pierna' + L(s), M.aro(x, 0.168, -0.02, 0.086, 0.092, 0.0045, 'Oro'));
      poner('Pierna' + L(s), M.aro(x, 0.116, -0.02, 0.081, 0.087, 0.0045, 'Oro'));
    });
    const BOTA = [
      [-0.105, 0, 0, 0, -0.09], [-0.095, 0.058, 0.075, 0, -0.09], [-0.06, 0.077, 0.088, 0, -0.092], [0.0, 0.082, 0.088, 0, -0.09],
      [0.06, 0.084, 0.078, 0, -0.08], [0.12, 0.078, 0.064, 0, -0.068], [0.16, 0.06, 0.05, 0, -0.058], [0.182, 0.027, 0.028, 0, -0.054], [0.19, 0, 0, 0, -0.054]
    ];
    const SUELA = BOTA.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.007, rx < 0.01 ? 0 : 0.014, 0, -0.012]);
    const INCLINA = 0.1;
    LADOS.forEach((s) => {
      const piezas = [[BOTA, 'BotaPie'], [SUELA, 'SuelaBota']].map(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2 + INCLINA;
        m.position.set(s * PIE_X, 0.02, -0.02);
        poner('Pie' + L(s), m);
        return m;
      });
      poner('Pie' + L(s), bloque(s * PIE_X, 0.018, -0.108, 0.034, 0.02, 0.032, 0.6, 'Tacon'));
      // correa plateada sobre el empeine (pegada con rayos desde arriba)
      const bota = piezas[0];
      bota.updateMatrixWorld(true);
      const filas = [];
      for (let iz = 0; iz <= 3; iz++) {
        const fila = [];
        for (let ix = 0; ix <= 10; ix++) {
          const px = s * PIE_X + (ix / 10 - 0.5) * 0.15;
          rayo.set(V(px, 3, 0.045 + 0.028 * (iz / 3)), V(0, -1, 0));
          const h = rayo.intersectObject(bota, false)[0];
          fila.push(h ? h.point.clone().add(V(0, 0.005, 0)) : null);
        }
        filas.push(fila.filter(Boolean));
      }
      if (filas.every((f) => f.length === 11)) {
        const plano = [];
        filas.forEach((f) => f.forEach((p) => plano.push(p.x, p.y, p.z)));
        poner('Pie' + L(s), rejilla(plano, 10, 3, 'CorreaPlata'));
      }
      const pc = filas[1][Math.floor(filas[1].length / 2)];
      if (pc) poner('Pie' + L(s), bloque(pc.x, pc.y + 0.004, pc.z, 0.016, 0.004, 0.014, 0.4, 'Hebilla'));
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
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.252, 0.49, 0.002],    // muñeca (dentro del guantelete)
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
    // melena, mechones y coletas: se doblan suave entre la cabeza y el pecho
    pieles.forEach(([malla, pesos]) => { g.add(malla); M.pielConHuesos(malla, g, pesos); });

    // ---------------- COLORES (paleta de la hoja: rubio, azul, negro, morado y dorado) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xdcbaa4, pielSombra: 0xb48e7a, labio: 0xb06a66,
      pelo: 0xd6a85a, peloClaro: 0xe4b866, peloSombra: 0xb08640, ceja: 0xb0843e,
      ojo: 0xf7f2ee, iris: 0xb8862a, pupila: 0x3a2008, brillo: 0xffffff, pestanas: 0x3a2412,
      polo: 0x3e5fa0, poloForro: 0x2c4478, costura: 0x2e4a84, negro: 0x262428, morado: 0x6e3a74, moradoOscuro: 0x4a2850,
      oro: 0xc8a650, pano: 0x3a3240, panoForro: 0x2a2430, bota: 0x4a4236, suela: 0x1e1c1e, plata: 0xb4b6bc
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Melena: 'pelo', MelenaBorde: 'peloSombra', MechonDelantero: 'peloClaro', Flequillo: 'peloClaro', FlequilloCentro: 'peloClaro',
      TrenzaCorona: 'peloClaro', Coleta: 'pelo', Trenza: 'peloClaro', PuntaTrenza: 'pelo', Lazo: 'morado',
      Polo: 'polo', PoloBordeIzquierdo: 'poloForro', PoloBordeDerecho: 'poloForro', CuelloPolo: 'polo', PuntaCuello: 'polo', BotonPolo: 'poloForro',
      CosturaPolo: 'costura', Emblema: 'oro', Manga: 'polo', ForroManga: 'poloForro',
      Guantelete: 'negro', TapaGuantelete: 'negro', BandaMorada: 'morado', FranjaMorada: 'morado', Oro: 'oro', Guante: 'negro',
      CaderaPantalon: 'negro', Pierna: 'negro', CosturaPantalon: 'suela',
      Cinturon: 'morado', RibeteCinturon: 'oro', Medallon: 'oro', Gema: 'moradoOscuro',
      Pano: 'pano', Nudo: 'pano',
      CanaBota: 'bota', DoblezBota: 'moradoOscuro', BotaPie: 'bota', SuelaBota: 'suela', Tacon: 'suela', CorreaPlata: 'plata', Hebilla: 'plata'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Polo: ['polo', 'poloForro'], CuelloPolo: ['polo', 'poloForro'], Pano: ['pano', 'panoForro'], Melena: ['pelo', 'peloSombra'],
      DoblezBota: ['moradoOscuro', 'negro'] };
    const METAL = { plata: [0x9a9ca0, 60], oro: [0x6a5428, 36] };
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
