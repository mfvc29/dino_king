/**
 * Alvin — personaje chibi hecho a partir de su sprite (assets/characters/Alvin.png, cuadros de 64×64,
 * fila de caminar: frente, lado y espalda). Medidas tomadas píxel a píxel: el sprite mide 51 px y aquí
 * 1 px = 2,55 cm → 1,30 m con el mechón.
 *
 * Estilo chibi y con pocos detalles: cabeza grande (~40 % de la altura), ojos grandes y bajos, cuerpo
 * corto, piernas muy cortas y zapatos grandes y redondos.
 *   pelo rubio corto, cerrado (capa exterior e interior unidas), con flequillo de lado y mechón de punta
 *   → cara ancha y casi cuadrada: ojos grandes por capas (almendra, iris, pupila, brillos, pestañas y
 *     párpado), cejas arqueadas, nariz de botón, boca pequeña y orejas con pliegue
 *   → abrigo azul abierto y sólido (bajo, bordes y cuello cerrados; solapas pegadas; puños con tapas)
 *   → pecho al aire → pantalón oscuro → zapatos dorados redondos con suela → muñecas y puños.
 *
 * Mira hacia +Z, de pie, con las piernas rectas y juntas.
 *
 * Colores: paleta de la hoja de personaje assets/3d personajes/alvin.jpeg (piel morena, pelo dorado, ojos
 * azules, abrigo azul violeta con forro morado oscuro, pantalón gris y botas doradas con el tobillo morado).
 *
 * Esqueleto (THREE.Bone, 13 huesos): HuesoRaiz → HuesoCadera → HuesoPecho → HuesoCuello → HuesoCabeza,
 * HuesoBrazoI/D → HuesoManoI/D (desde el pecho) y HuesoPiernaI/D → HuesoPieI/D (desde la cadera).
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar' (para THREE.AnimationMixer).
 */
registrarMalla({
  id: 'alvin',
  categoria: 'personajes',
  nombre: 'Alvin (chibi)',
  icono: '🧒',
  origen: 'assets/chibi/personajes/alvin.png',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.115;                              // separación de piernas y zapatos desde el centro
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
      if (abertura) {
        [0, C].forEach((c, k) => {
          const borde = [];
          for (let r = 0; r < R; r++) borde.push(...ext[r][c], ...int[r][c]);
          piezas.push(rejilla(borde, 1, R - 1, (opts.nombre || 'Prenda') + (k ? 'BordeDerecho' : 'BordeIzquierdo')));
        });
      }
      return piezas;
    }
    // Parche sólido (solapas): cara de arriba + paredes laterales hasta la superficie de la prenda
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
      const centro = V(0, 0.8, -0.3);
      const n = V(0, 0, 0);
      const d = V(0, 0, 0);
      for (let i = 0; i < N.count; i++) {
        n.fromBufferAttribute(N, i);
        const w = suave(0.15, 0.55, n.z) * (1 - suave(0.82, 0.95, -n.y));   // cara sí; debajo de la barbilla no
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
        ojo.add(M.tubo([[-s * 0.06, -0.004, 0.007], [-s * 0.037, 0.029, 0.009], [0, 0.042, 0.009], [s * 0.037, 0.036, 0.009], [s * 0.063, 0.015, 0.007], [s * 0.078, 0.026, 0.005]],
          0.008, 0.004, { segLargo: 24, segRadio: 10, nombre: 'Pestanas' }));
        ojo.add(M.tubo([[-s * 0.046, -0.03, 0.005], [0, -0.039, 0.006], [s * 0.048, -0.031, 0.005]], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));
        poner('Cabeza', ojo);
      }
      // Ceja corta y gruesa, algo arqueada
      const ceja = deFrente(s * 0.1, 0.922);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.032, -0.004, 0.007], [0, 0.003, 0.009], [s * 0.034, 0.0, 0.007]], 0.0105, 0.008, { segLargo: 12, segRadio: 10, nombre: 'Ceja' }));
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
      boca.add(M.tubo([[-0.021, 0.004, 0.002], [0, -0.003, 0.003], [0.021, 0.004, 0.002]], 0.003, 0.003, { segLargo: 12, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- PELO rubio corto: casco redondo, flequillo de lado y mechón de punta ----------------
    const PELO = { y: 1.02, z: -0.012, rx: 0.265, ry: 0.235, rz: 0.255 };
    const REMOLINO = V(0, 0.6, -0.8).normalize();             // remolino en la parte de atrás (como en el sprite)
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
    // Flequillo peinado hacia un lado (cae sobre la frente por el lado izquierdo de la imagen)
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
    // Punto apoyado sobre el casco de pelo (profundidad calculada del elipsoide + separación)
    const enPelo = (x, y, d = 0.012) => {
      const e = 1 - (x / PELO.rx) ** 2 - ((y - PELO.y) / PELO.ry) ** 2;
      return V(x, y, PELO.z + PELO.rz * Math.sqrt(Math.max(0, e)) + d);
    };
    poner('Cabeza', mechon([enPelo(0.13, 1.17, 0.008), enPelo(0.0, 1.11, 0.014), enPelo(-0.12, 1.03, 0.016), enPelo(-0.2, 0.965, 0.01)], 0.2, 0.06, 'Flequillo'));
    poner('Cabeza', mechon([enPelo(0.17, 1.12, 0.006), enPelo(0.09, 1.06, 0.012), enPelo(-0.01, 1.005, 0.012)], 0.12, 0.05, 'FlequilloCorto'));
    poner('Cabeza', mechon([enPelo(-0.21, 1.08, 0.006), enPelo(-0.245, 0.99, 0.008), enPelo(-0.25, 0.915, 0.008)], 0.1, 0.045, 'MechonLateral'));
    // Mechón de punta en la coronilla: plano y curvado hacia arriba y a la derecha
    poner('Cabeza', mechon([V(0.04, 1.225, -0.05), V(0.095, 1.28, -0.065), V(0.15, 1.305, -0.045)], 0.07, 0.03, 'MechonPunta'));

    // ---------------- CUERPO: pecho al aire bajo el abrigo ----------------
    poner('Pecho', M.loft([[0.38, 0.165, 0.118], [0.5, 0.163, 0.12], [0.62, 0.165, 0.12], [0.72, 0.16, 0.11], [0.78, 0.112, 0.085], [0.8, 0.064, 0.06]], { segRadio: 56, subdiv: 5, nombre: 'Torso' }));

    // ---------------- ABRIGO AZUL ABIERTO ----------------
    const ABRIGO = [
      [0.32, 0.235, 0.172], [0.4, 0.222, 0.166], [0.5, 0.203, 0.16], [0.6, 0.192, 0.155],
      [0.7, 0.19, 0.15], [0.75, 0.18, 0.136], [0.78, 0.142, 0.112], [0.8, 0.092, 0.086]
    ];
    // Semiancho de la abertura: ancha en el pecho, estrecha en la tripa y abierta otra vez abajo
    const ABERTURA = [[0.32, 0.07], [0.4, 0.045], [0.5, 0.028], [0.6, 0.03], [0.66, 0.06], [0.72, 0.11], [0.8, 0.09]];
    // Abrigo de una pieza con grosor (bajo, bordes delanteros y borde del cuello cerrados)
    prendaSolida(ABRIGO, ABERTURA, 0.012, { segRadio: 80, subdiv: 6, nombre: 'Abrigo' }).forEach((p) => poner('Pecho', p));
    // Cuello vuelto del abrigo, también sólido, nace de los hombros
    prendaSolida([[0.775, 0.13, 0.108, 0, -0.01], [0.81, 0.122, 0.1, 0, -0.012], [0.835, 0.128, 0.104, 0, -0.012]],
      [[0.77, 0.085], [0.84, 0.1]], 0.01, { segRadio: 64, subdiv: 4, nombre: 'CuelloAbrigo' }).forEach((p) => poner('Pecho', p));
    // Solapas vueltas a los lados de la abertura, pegadas al abrigo con sus paredes
    const molde = loftAbierto(ABRIGO, null, { segRadio: 80, subdiv: 6, nombre: 'MoldeAbrigo' });
    LADOS.forEach((s) => {
      poner('Pecho', parcheSolido(molde, [[s * 0.095, 0.79], [s * 0.165, 0.77], [s * 0.125, 0.655], [s * 0.062, 0.655]], 0.01, 6, 10, 'Solapa'));
    });
    // Abertura trasera del bajo, marcada como costura
    const raja = [0.325, 0.36, 0.4, 0.435].map((y) => sobre(molde, 0, y, -1, 0.002)).filter(Boolean);
    if (raja.length > 1) poner('Pecho', M.tubo(raja, 0.0045, 0.0045, { segLargo: 8, segRadio: 8, nombre: 'AberturaTrasera' }));

    // ---------------- MANGAS Y PUÑOS ----------------
    LADOS.forEach((s) => {
      // Manga de una sola pieza: nace redondeada dentro del hombro del abrigo, pasa por encima del hombro
      // con una curva suave y baja hasta el puño (sin bola en el hombro ni costura entre piezas)
      const radioManga = (t) => (t < 0.12 ? 0.09 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.12) ** 2)) : 0.09 - 0.01 * (t - 0.12) / 0.88);
      poner('Brazo' + L(s), M.tubo([[s * 0.1, 0.715, -0.012], [s * 0.2, 0.705, -0.011], [s * 0.237, 0.645, -0.012], [s * 0.254, 0.585, -0.008], [s * 0.2645, 0.53, -0.002]],
        1, 1, { segLargo: 48, segRadio: 32, ruido: (t) => radioManga(t), nombre: 'Manga' }));
      // Puño: banda cerrada con tapas arriba (contra la manga) y abajo (contra la muñeca)
      const A = V(s * 0.2645, 0.53, -0.002);
      const B = V(s * 0.269, 0.495, 0.0);
      poner('Brazo' + L(s), M.tubo([A, B], 0.091, 0.091, { segLargo: 4, segRadio: 32, nombre: 'PunoManga' }));
      const eje = B.clone().sub(A).normalize();
      [[A, 0.078], [B, 0.044]].forEach(([P, rIn]) => {
        const tS = M.seg(32, 12);
        const tapa = M.pieza(new THREE.RingGeometry(rIn, 0.091, tS, 2), 'TapaPuno', tS, 2);
        tapa.position.copy(P);
        tapa.quaternion.setFromUnitVectors(V(0, 0, 1), eje);
        poner('Brazo' + L(s), tapa);
      });
      // Muñeca: une el puño con la mano
      poner('Mano' + L(s), M.tubo([[s * 0.266, 0.52, -0.001], [s * 0.271, 0.46, 0.006]], 0.045, 0.045, { segLargo: 6, segRadio: 24, nombre: 'Muneca' }));
      poner('Mano' + L(s), bloque(s * 0.272, 0.43, 0.012, 0.052, 0.06, 0.058, 0.65, 'Mano'));
    });

    // ---------------- PANTALÓN Y PIERNAS CORTAS ----------------
    poner('Cadera', M.loft([[0.27, 0.05, 0.05], [0.3, 0.2, 0.128], [0.42, 0.205, 0.135], [0.5, 0.185, 0.13], [0.512, 0.164, 0.121]], { segRadio: 56, subdiv: 4, nombre: 'CaderaPantalon' })); // la cintura se cierra contra el cuerpo
    // Piernas rectas y juntas (separación PIE_X a cada lado), dentro del ancho de la cadera
    LADOS.forEach((s) => {
      poner('Pierna' + L(s), M.loft([[0.15, 0.07, 0.075, s * PIE_X, -0.02], [0.24, 0.075, 0.08, s * PIE_X, -0.02], [0.33, 0.085, 0.09, s * PIE_X, -0.015]],
        { segRadio: 36, subdiv: 5, nombre: 'Pierna' }));
    });

    // ---------------- ZAPATOS DORADOS REDONDOS ----------------
    // Se modelan a lo largo del pie (eje Z) y se giran: [largo, semiancho, semialto, 0, -altura del centro]
    // (un poco más estrechos que antes para que, con las piernas juntas, las suelas no se toquen)
    const ZAPATO = [
      [-0.112, 0, 0, 0, -0.095], [-0.1, 0.063, 0.085, 0, -0.095], [-0.06, 0.086, 0.1, 0, -0.1], [0.0, 0.09, 0.1, 0, -0.1],
      [0.06, 0.094, 0.09, 0, -0.09], [0.12, 0.09, 0.075, 0, -0.077], [0.16, 0.072, 0.062, 0, -0.068], [0.182, 0.032, 0.035, 0, -0.065], [0.19, 0, 0, 0, -0.065]
    ];
    const SUELA = ZAPATO.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.008, rx < 0.01 ? 0 : 0.016, 0, -0.014]); // puntas cerradas
    LADOS.forEach((s) => {
      [[ZAPATO, 'Zapato'], [SUELA, 'SuelaZapato']].forEach(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(s * PIE_X, 0, -0.02);
        poner('Pie' + L(s), m);
      });
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
        ['Brazo' + L(s), 'Pecho', s * 0.185, 0.7, -0.012],          // hombro
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.267, 0.51, -0.001],   // muñeca (dentro del puño)
        ['Pierna' + L(s), 'Cadera', s * PIE_X, 0.3, -0.015],         // cadera
        ['Pie' + L(s), 'Pierna' + L(s), s * PIE_X, 0.13, -0.02]      // tobillo (dentro del zapato)
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

    // ---------------- COLORES (paleta de la hoja de personaje: assets/3d personajes/alvin.jpeg) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor (hemisférica + principal) las caras de
    // frente quedan como en la paleta y las de arriba hacen de brillo sin quemarse.
    const COLOR = {
      piel: 0x8a624c, pielSombra: 0x6a4538, pelo: 0xcda852, peloClaro: 0xd8b45e, ceja: 0xb8884c,
      ojo: 0xf7f4f2, iris: 0x3f87bb, pupila: 0x16202f, brillo: 0xffffff, pestanas: 0x2a1816, labio: 0x5c372e,
      abrigo: 0x4b529b, abrigoCostura: 0x3a3d7c, forro: 0x452746, pantalon: 0x58555c,
      oro: 0xa8773c, oroOscuro: 0x5e4029, morado: 0x63426f
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', Muneca: 'piel', Mano: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', MechonLateral: 'pelo', Flequillo: 'peloClaro', FlequilloCorto: 'peloClaro', MechonPunta: 'peloClaro',
      Abrigo: 'abrigo', CuelloAbrigo: 'abrigo', Solapa: 'abrigo', Manga: 'abrigo', PunoManga: 'abrigo',
      AberturaTrasera: 'abrigoCostura', TapaPuno: 'forro',
      CaderaPantalon: 'pantalon', Pierna: 'pantalon', Zapato: 'oro', SuelaZapato: 'oroOscuro'
    };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; el oro brilla un poco
    function material(clave, porVertice) {
      const id = clave + (porVertice ? '+v' : '');
      if (!materiales[id]) {
        const m = clave === 'oro' || clave === 'oroOscuro'
          ? new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, specular: 0x3a2c18, shininess: 30 })
          : clayMaterial.clone();
        m.color.setHex(porVertice ? 0xffffff : COLOR[clave]);
        m.vertexColors = !!porVertice;
        materiales[id] = m;
      }
      return materiales[id];
    }
    // Color por vértice: fn(i, atributo de posición) → THREE.Color
    function pintarVertices(malla, fn) {
      const p = malla.geometry.attributes.position;
      const col = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) fn(i, p).toArray(col, i * 3);
      malla.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    const cAbrigo = new THREE.Color(COLOR.abrigo);
    const cForro = new THREE.Color(COLOR.forro);
    const cOro = new THREE.Color(COLOR.oro);
    const cMorado = new THREE.Color(COLOR.morado);
    const tmp = new THREE.Color();
    g.traverse((o) => {
      if (!o.isMesh) return;
      const clave = PINTURA[o.name.replace(/(BordeIzquierdo|BordeDerecho|Base|Pared\d+)$/, '')];
      if (!clave) return;
      if (o.userData.capas) {
        // Abrigo y cuello: azul por fuera, forro morado oscuro por dentro (como en la hoja)
        const { cols, exteriores } = o.userData.capas;
        pintarVertices(o, (i) => {
          const fila = Math.floor(i / (cols + 1));
          return fila >= exteriores && fila < 2 * exteriores ? cForro : cAbrigo;
        });
        o.material = material(clave, true);
      } else if (o.name === 'Zapato') {
        // Bota dorada con el tobillo morado alrededor de la pierna (alto = −z y largo = y, antes de girarla)
        pintarVertices(o, (i, p) => {
          const t = suave(0.158, 0.172, -p.getZ(i)) * (1 - suave(0.045, 0.075, p.getY(i)));
          return tmp.copy(cOro).lerp(cMorado, t);
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
