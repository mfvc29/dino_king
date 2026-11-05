/**
 * Roderick — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/roderick.jpeg
 * (vistas de frente, perfil y espalda, caras, chaleco, pantalón, barba y botas).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas; más ancho de pecho y brazos que los demás.
 *   pelo naranja de punta hacia arriba como llamas: casco cerrado + púas largas alrededor + mechones de la
 *   frente peinados hacia arriba + patillas
 *   → barba naranja poblada (mejillas y barbilla en punta, sólida) y bigote espeso
 *   → piel clara, ojos azules, cejas gruesas fruncidas, gesto duro y cicatriz en la mejilla
 *   → pecho musculoso con vello y brazos musculosos al aire con cicatrices; puños cerrados
 *   → chaleco gris oscuro raído: abotonado abajo y abierto en V, bolsillos de ribete marrón, agujeros con la
 *     piel asomando, sisas y bajo deshilachados
 *   → vaqueros azules con costuras claras y rotos en las rodillas (hilos y bordes deshilachados)
 *   → botas de trabajo marrón muy oscuro con el vaquero metido, puntera redonda y suela gruesa.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'roderick',
  categoria: 'personajes',
  nombre: 'Roderick (chibi)',
  icono: '🪓',
  origen: 'assets/personajes 3d/roderick.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.115;                              // separación de piernas y zapatillas desde el centro
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
          x *= 1 - 0.18 * s;                                   // mandíbula algo más marcada
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
      // Ojo algo más rasgado (mirada segura): almendra, iris, pupila, brillos, línea de pestañas gruesa
      const ojo = deFrente(s * 0.105, 0.87);
      if (ojo) {
        const blanco = almendra(0.056, 0.034, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);
        ojo.add(bloque(-s * 0.008, -0.003, 0.0045, 0.024, 0.028, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.008, -0.004, 0.0105, 0.01, 0.013, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.016, 0.01, 0.0135, 0.0075, 0.0075, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(s * 0.002, -0.017, 0.012, 0.0042, 0.0042, 0.0035, 1, 'BrilloOjoPequeno'));
        ojo.add(M.tubo([[-s * 0.058, -0.006, 0.007], [-s * 0.036, 0.022, 0.009], [0, 0.034, 0.009], [s * 0.036, 0.031, 0.009], [s * 0.062, 0.012, 0.007], [s * 0.074, 0.016, 0.005]],
          0.0095, 0.0045, { segLargo: 24, segRadio: 10, nombre: 'Pestanas' }));
        ojo.add(M.tubo([[-s * 0.044, -0.026, 0.005], [0, -0.034, 0.006], [s * 0.046, -0.027, 0.005]], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));
        poner('Cabeza', ojo);
      }
      // Ceja muy gruesa y fruncida hacia el centro (gesto duro)
      const ceja = deFrente(s * 0.104, 0.918);
      if (ceja) {
        ceja.add(M.tubo([[-s * 0.04, -0.018, 0.008], [-s * 0.006, -0.003, 0.011], [s * 0.04, 0.008, 0.008]], 0.014, 0.009, { segLargo: 12, segRadio: 10, nombre: 'Ceja' }));
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
    // Nariz recta y boca seria bajo el bigote
    const nariz = deFrente(0, 0.846);
    if (nariz) {
      nariz.add(bloque(0, 0.002, 0.002, 0.011, 0.013, 0.009, 1, 'Nariz'));
      poner('Cabeza', nariz);
    }
    const boca = deFrente(0, 0.824);
    if (boca) {
      boca.add(M.tubo([[-0.018, -0.003, 0.002], [0, 0.0005, 0.003], [0.018, -0.003, 0.002]], 0.0034, 0.0032, { segLargo: 14, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- PELO NARANJA DE PUNTA COMO LLAMAS: casco, púas largas, frente peinada hacia arriba y patillas ----------------
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
    const NACIMIENTO = [[0, 1.005], [0.5, 0.995], [1.1, 0.955], [1.57, 0.93], [2.2, 0.875], [2.7, 0.835], [Math.PI, 0.825]];   // frente despejada
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
    const azar = M.azar(29);
    const ARRIBA = V(0, 1, 0);
    // Pelo de punta hacia arriba como llamas: púas largas y anchas
    // [ángulo desde arriba, lista de ángulos alrededor, largo, cuánto sube (+) o baja (−) la punta]
    const ANILLOS_PUAS = [
      [0.12, [0.0, 2.1, -2.1], 0.2, 3.0],
      [0.45, [0.0, 0.7, 1.4, 2.1, 2.8, -2.8, -2.1, -1.4, -0.7], 0.2, 1.5],
      [0.85, [0.35, 1.0, 1.6, 2.2, 2.8, -2.8, -2.2, -1.6, -1.0, -0.35], 0.17, 0.8],
      [1.25, [1.2, 1.7, 2.2, 2.7, -2.7, -2.2, -1.7, -1.2], 0.14, 0.35],
      [1.65, [2.2, 2.7, 3.14, -2.7, -2.2], 0.11, -0.3]
    ];
    ANILLOS_PUAS.forEach(([th, fis, largo, sube]) => {
      fis.forEach((fi) => {
        const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
        const raiz = V(u.x * PELO.rx * 0.84, PELO.y + u.y * PELO.ry * 0.84, PELO.z + u.z * PELO.rz * 0.84);
        const dir = u.clone().addScaledVector(ARRIBA, sube).normalize();
        const l = largo * (0.85 + 0.3 * azar());
        poner('Cabeza', pua(raiz, dir, l, 0.13 + 0.04 * azar(), 0.05, (azar() - 0.5) * 0.7, fi, azar() > 0.6 ? 'PuaClara' : 'Pua'));
      });
    });
    // Punto apoyado sobre el casco de pelo (profundidad calculada del elipsoide + separación)
    const enPelo = (x, y, d = 0.012) => {
      const e = 1 - (x / PELO.rx) ** 2 - ((y - PELO.y) / PELO.ry) ** 2;
      return V(x, y, PELO.z + PELO.rz * Math.sqrt(Math.max(0, e)) + d);
    };
    // Mechones de la frente peinados hacia arriba (la frente queda despejada)
    [-0.15, -0.09, -0.03, 0.03, 0.09, 0.15].forEach((x, k) => {
      const dir = V(x * 1.4, 1, 0.12 + 0.1 * (k % 2)).normalize();
      poner('Cabeza', pua(enPelo(x, 1.025, -0.016), dir, 0.15 + 0.03 * azar(), 0.11, 0.045, (azar() - 0.5) * 0.5, Math.atan2(x, 0.25), k % 2 ? 'Pua' : 'PuaClara'));
    });
    // Patillas que bajan hasta la barba
    LADOS.forEach((s) => {
      const pts = [[0.95, 0.06], [0.91, 0.07], [0.87, 0.072]].map(([y, z]) => {
        cabeza.updateMatrixWorld(true);
        rayo.set(V(s * 3, y, z), V(-s, 0, 0));
        const h = rayo.intersectObject(cabeza, false)[0];
        return h ? h.point.clone().add(V(s * 0.012, 0, 0)) : null;
      }).filter(Boolean);
      if (pts.length === 3) poner('Cabeza', mechon(pts, 0.06, 0.026, 'Patilla'));
    });

    // ---------------- BARBA NARANJA POBLADA: mejillas, barbilla en punta y bigote ----------------
    // distancia horizontal del eje de la cabeza a la cara en el ángulo fi (0 = delante) y la altura y
    const radioCara = (fi, y) => {
      cabeza.updateMatrixWorld(true);
      rayo.set(V(Math.sin(fi) * 3, y, Math.cos(fi) * 3), V(-Math.sin(fi), 0, -Math.cos(fi)));
      const h = rayo.intersectObject(cabeza, false)[0];
      return h ? Math.hypot(h.point.x, h.point.z) : 0.085;
    };
    // la barba cubre el labio de arriba, las mejillas y la mandíbula y cae recta por delante de la barbilla
    const FI_MAX = 1.38;
    const Y_CAIDA = 0.86;                                                           // por debajo, la barba cae recta
    const yArriba = (fi) => M.interp([[0, 0.836], [0.35, 0.846], [0.7, 0.872], [1.05, 0.895], [FI_MAX, 0.918]], Math.abs(fi));
    const yAbajo = (fi) => M.interp([[0, 0.735], [0.4, 0.748], [0.8, 0.78], [1.15, 0.825], [FI_MAX, 0.858]], Math.abs(fi));
    const grosorBarba = (fi, t) => (0.014 + 0.026 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.12)) + 0.03 * t * Math.exp(-fi * fi / 0.25))
      * (0.4 + 0.6 * Math.min(1, (FI_MAX - Math.abs(fi)) / 0.25)) * (1 + 0.12 * Math.cos(fi * 14) * t);
    const fueraBarba = (fi, y, t) => radioCara(fi, Math.max(y, Y_CAIDA)) + grosorBarba(fi, t);
    const tDe = (fi, y) => Math.max(0, Math.min(1, (yArriba(fi) - y) / (yArriba(fi) - yAbajo(fi))));
    poner('Cabeza', (() => {
      const C = M.seg(72, 16);
      const R = M.seg(26, 8);
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const t = r / R;
        const fe = [];
        const fn = [];
        for (let c = 0; c <= C; c++) {
          const fi = -FI_MAX + (2 * FI_MAX * c) / C;
          const y = yArriba(fi) + (yAbajo(fi) - yArriba(fi)) * t - 0.014 * t * t * (0.5 + 0.5 * Math.cos(fi * 11));   // puntas abajo
          const ro = fueraBarba(fi, y, t);
          const ri = y >= 0.83 ? radioCara(fi, y) - 0.004 : radioCara(fi, 0.83) - 0.004 - (radioCara(fi, 0.83) - 0.07) * Math.min(1, (0.83 - y) / 0.06);
          fe.push([Math.sin(fi) * ro, y, Math.cos(fi) * ro]);
          fn.push([Math.sin(fi) * ri, y, Math.cos(fi) * ri]);
        }
        ext.push(fe);
        int.push(fn);
      }
      const grupo = new THREE.Group();
      const vuelta = [...ext, ...int.slice().reverse(), ext[0]];
      const pos = [];
      vuelta.forEach((fila) => fila.forEach((p) => pos.push(...p)));
      grupo.add(rejilla(pos, C, vuelta.length - 1, 'Barba'));
      [0, C].forEach((c) => {
        const b = [];
        for (let r = 0; r <= R; r++) b.push(...ext[r][c], ...int[r][c]);
        grupo.add(rejilla(b, 1, R, 'Barba'));
      });
      return grupo;
    })());
    // bigote espeso y boca, apoyados sobre la barba
    const enBarba = (x, y, d) => {
      const fi = x / 0.16;
      const r = fueraBarba(fi, y, tDe(fi, y)) + d;
      return V(Math.sin(fi) * r, y, Math.cos(fi) * r);
    };
    poner('Cabeza', M.tubo([[-0.066, 0.806], [-0.05, 0.824], [-0.025, 0.834], [0, 0.836], [0.025, 0.834], [0.05, 0.824], [0.066, 0.806]].map(([x, y]) => enBarba(x, y, 0.004)),
      0.012, 0.012, { segLargo: 40, segRadio: 12, ruido: (t) => 0.65 + 0.5 * Math.sin(Math.PI * t), nombre: 'Bigote' }));
    poner('Cabeza', M.tubo([[-0.02, 0.808], [0, 0.811], [0.02, 0.808]].map(([x, y]) => enBarba(x, y, 0.002)), 0.0035, 0.0035, { segLargo: 12, segRadio: 8, nombre: 'BocaBarba' }));
    const enCara = (x, y, d) => sobre(cabeza, x, y, 1, d);
    // cicatriz sobre la mejilla derecha y el puente de la nariz
    poner('Cabeza', M.tubo([enCara(-0.04, 0.875, 0.003), enCara(-0.07, 0.86, 0.003), enCara(-0.1, 0.848, 0.003)].filter(Boolean), 0.0028, 0.0022, { segLargo: 12, segRadio: 6, nombre: 'Cicatriz' }));

    // ---------------- CUERPO: pecho ancho y musculoso (asoma en la V del chaleco) ----------------
    const torso = M.loft([[0.44, 0.17, 0.12], [0.5, 0.168, 0.118], [0.57, 0.175, 0.122], [0.64, 0.188, 0.128], [0.72, 0.184, 0.12],
      [0.78, 0.125, 0.092], [0.8, 0.068, 0.062]], { segRadio: 64, subdiv: 6, nombre: 'Torso' });
    poner('Pecho', torso);
    const enTorso = (lista) => lista.map(([x, y]) => sobre(torso, x, y, 1, 0.0008)).filter(Boolean);
    poner('Pecho', costura(enTorso([[0, 0.638], [0, 0.6], [0, 0.56], [0, 0.52]]), 'Musculo', 0.0026));          // línea del abdomen
    LADOS.forEach((s) => {
      poner('Pecho', costura(enTorso([[s * 0.01, 0.652], [s * 0.045, 0.638], [s * 0.085, 0.64], [s * 0.118, 0.66]]), 'Musculo', 0.003));   // pectoral
      poner('Pecho', costura(enTorso([[s * 0.006, 0.6], [s * 0.028, 0.603], [s * 0.05, 0.597]]), 'Musculo', 0.0024));             // abdominales
      poner('Pecho', costura(enTorso([[s * 0.006, 0.56], [s * 0.028, 0.563], [s * 0.048, 0.557]]), 'Musculo', 0.0024));
      poner('Pecho', costura(enTorso([[s * 0.072, 0.53], [s * 0.058, 0.5], [s * 0.042, 0.47]]), 'Musculo', 0.0024));              // oblicuos
      poner('Pecho', costura(enTorso([[s * 0.022, 0.775], [s * 0.055, 0.768], [s * 0.095, 0.77]]), 'Musculo', 0.0026));           // clavícula
    });
    const ombligo = sobre(torso, 0, 0.5, 1, -0.001);
    if (ombligo) poner('Pecho', bloque(ombligo.x, ombligo.y, ombligo.z, 0.007, 0.009, 0.004, 1, 'Ombligo'));

    // vello del pecho en la abertura del chaleco
    [[0, 0.72], [-0.03, 0.735], [0.03, 0.735], [-0.015, 0.7], [0.018, 0.69], [0, 0.66], [-0.05, 0.75], [0.05, 0.75], [-0.008, 0.635]].forEach(([x, y], k) => {
      const pts = enTorso([[x, y], [x + (k % 2 ? 0.006 : -0.006), y - 0.014]]);
      poner('Pecho', costura(pts, 'Vello', 0.0018));
    });

    // ---------------- CHALECO GRIS OSCURO RAÍDO, ABOTONADO Y ABIERTO EN V ----------------
    const CHALECO = [
      [0.44, 0.222, 0.165], [0.5, 0.214, 0.16], [0.58, 0.21, 0.158], [0.66, 0.214, 0.16],
      [0.72, 0.208, 0.152], [0.755, 0.19, 0.136], [0.78, 0.152, 0.114], [0.8, 0.1, 0.088]
    ];
    // Semiancho de la abertura: cerrado con botones abajo y en V hacia el cuello
    const ABERTURA = [[0.44, 0.0], [0.6, 0.0], [0.64, 0.022], [0.7, 0.06], [0.76, 0.088], [0.8, 0.092]];
    prendaSolida(CHALECO, ABERTURA, 0.011, { segRadio: 84, subdiv: 6, nombre: 'Chaleco' }).forEach((p) => poner('Pecho', p));
    const molde = loftAbierto(CHALECO, null, { segRadio: 84, subdiv: 6, nombre: 'MoldeChaleco' });
    const borde = (y) => M.interp(ABERTURA, y);
    const enChaleco = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    const botonEn = (x, y, lado, nombre = 'Boton') => {
      const m = marco(molde, V(x, y, lado * 3), V(0, 0, -lado));
      if (!m) return;
      m.add(bloque(0, 0, 0.003, 0.0085, 0.0085, 0.0045, 0.8, nombre));
      poner('Pecho', m);
    };
    [0.47, 0.515, 0.56, 0.605].forEach((y) => botonEn(0, y, 1));
    poner('Pecho', costura(enChaleco([[0.016, 0.445], [0.016, 0.52], [0.016, 0.6], [0.03, 0.64], [0.07, 0.7], [0.098, 0.76]])));
    poner('Pecho', costura(enChaleco([[-0.016, 0.6], [-0.03, 0.64], [-0.07, 0.7], [-0.098, 0.76]])));
    LADOS.forEach((s) => {
      // bolsillos de ribete con vivo marrón
      poner('Pecho', tira(enChaleco([[s * 0.08, 0.53], [s * 0.115, 0.528], [s * 0.152, 0.532]], 1, 0.003), 0.014, 0.005, 'Bolsillo'));
      // costuras de los paneles y del canesú de la espalda
      poner('Pecho', costura(enChaleco([[s * 0.13, 0.7], [s * 0.128, 0.6], [s * 0.13, 0.45]])));
      poner('Pecho', costura(enChaleco([[0, 0.712], [s * 0.06, 0.714], [s * 0.12, 0.718], [s * 0.17, 0.722]], -1)));
    });
    // rotos: agujeros con la piel asomando (delante y detrás)
    [[0.115, 0.6, 1], [-0.075, 0.565, 1], [0.04, 0.495, 1], [-0.12, 0.66, -1], [0.1, 0.56, -1], [0.05, 0.69, -1]].forEach(([x, y, lado], k) => {
      const a = 0.014 + 0.006 * (k % 3);
      const esquinas = [[x - a, y + 0.008], [x + a * 0.8, y + a], [x + a, y - 0.006], [x - a * 0.6, y - a]];
      if (lado > 0) poner('Pecho', parcheSolido(molde, esquinas, 0.0015, 3, 3, 'RotoPiel'));
      else {
        // parcheSolido mira de frente: en la espalda el parche se pega con rayos desde atrás
        const pts = esquinas.map(([px, py]) => sobre(molde, px, py, -1, 0.0025)).filter(Boolean);
        if (pts.length === 4) poner('Pecho', rejilla([...pts[0].toArray(), ...pts[1].toArray(), ...pts[3].toArray(), ...pts[2].toArray()], 1, 1, 'RotoPiel'));
      }
    });
    // bajo deshilachado: jirones en punta alrededor del borde
    for (let k = 0; k < 44; k++) {
      const a = (2 * Math.PI * k) / 44 + 0.06 * azar();
      if (Math.abs(Math.sin(a / 2)) < 0.04) continue;                       // no sobre la tapeta
      const raiz = V(Math.sin(a) * 0.218, 0.447, Math.cos(a) * 0.162);
      const punta = V(Math.sin(a) * 0.222, 0.447 - 0.012 - 0.018 * azar(), Math.cos(a) * 0.166);
      poner('Pecho', M.tubo([raiz, punta], 0.011, 0.001, { segLargo: 3, segRadio: 6, ruido: (t, b) => 1 - 0.75 * Math.abs(Math.cos(b - a)), nombre: 'Jiron' }));
    }

    // ---------------- BRAZOS: piel musculosa con cicatrices, sisa deshilachada y puños al aire ----------------
    LADOS.forEach((s) => {
      const base = (t) => (t < 0.14 ? 0.06 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.06 - 0.012 * (t - 0.14) / 0.86);
      const radioBrazo = (t) => base(t) * (1 + 0.16 * Math.exp(-(((t - 0.36) / 0.12) ** 2)) + 0.1 * Math.exp(-(((t - 0.7) / 0.1) ** 2)));   // bíceps y antebrazo
      const camino = [[s * 0.1, 0.725, -0.01], [s * 0.195, 0.716, -0.01], [s * 0.235, 0.655, -0.008], [s * 0.255, 0.585, -0.004], [s * 0.268, 0.5, 0.002], [s * 0.272, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 52, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      // hombro del chaleco con la sisa deshilachada
      const pts = [0, 0.5, 1].map((k) => curva.getPointAt(0.07 + 0.13 * k));
      poner('Brazo' + L(s), M.tubo(pts, 1, 1, { segLargo: 16, segRadio: 32, ruido: (t) => radioBrazo(0.07 + 0.13 * t) + 0.009, nombre: 'SisaChaleco' }));
      const P = curva.getPointAt(0.2);
      const eje = curva.getTangentAt(0.2);
      const e1 = V(0, 0, 1).cross(eje).normalize();
      const e2 = eje.clone().cross(e1).normalize();
      const r = radioBrazo(0.2) + 0.009;
      for (let k = 0; k < 22; k++) {
        const a = (2 * Math.PI * k) / 22 + 0.1 * azar();
        const radial = e1.clone().multiplyScalar(Math.cos(a)).addScaledVector(e2, Math.sin(a));
        const raiz = P.clone().addScaledVector(radial, r * 0.97).addScaledVector(eje, -0.004);
        const punta = raiz.clone().addScaledVector(eje, 0.01 + 0.016 * azar()).addScaledVector(radial, 0.002).add(V(0, -0.004, 0));
        poner('Brazo' + L(s), M.tubo([raiz, punta], 0.004, 0.0008, { segLargo: 3, segRadio: 5, nombre: 'Jiron' }));
      }
      // cicatrices en el brazo y el antebrazo (por fuera y por delante)
      const enBrazo = (tt, a, d = 0.0012) => {
        const Q = curva.getPointAt(tt);
        const ej = curva.getTangentAt(tt);
        const f1 = V(0, 0, 1).cross(ej).normalize();
        const f2 = ej.clone().cross(f1).normalize();
        return Q.addScaledVector(f1.multiplyScalar(Math.cos(a)).addScaledVector(f2, Math.sin(a)), radioBrazo(tt) + d);
      };
      [[0.3, 0.38, s > 0 ? 0.3 : 2.8, 0.5], [0.55, 0.62, s > 0 ? 0.6 : 2.5, 0.6], [0.66, 0.74, s > 0 ? 0.1 : 3.0, -0.5], [0.42, 0.47, s > 0 ? -0.5 : 3.6, 0.4]]
        .forEach(([t0, t1, a, giro]) => {
          poner('Brazo' + L(s), M.tubo([enBrazo(t0, a), enBrazo((t0 + t1) / 2, a + giro / 2), enBrazo(t1, a + giro)], 0.0028, 0.0022, { segLargo: 10, segRadio: 6, nombre: 'Cicatriz' }));
        });
      // puño cerrado al aire con los nudillos marcados
      poner('Mano' + L(s), bloque(s * 0.276, 0.43, 0.012, 0.054, 0.058, 0.058, 0.6, 'Mano'));
      poner('Mano' + L(s), bloque(s * 0.28, 0.383, 0.02, 0.045, 0.026, 0.049, 0.7, 'Mano'));
      poner('Mano' + L(s), bloque(s * 0.252, 0.41, 0.062, 0.018, 0.028, 0.017, 0.8, 'Mano'));
      [-0.03, -0.01, 0.01, 0.03].forEach((dz) => poner('Mano' + L(s), M.tubo([[s * 0.3, 0.395, 0.02 + dz], [s * 0.305, 0.38, 0.02 + dz]], 0.002, 0.002, { segLargo: 3, segRadio: 5, nombre: 'PliegueMano' })));
    });

    // ---------------- VAQUEROS AZULES ROTOS EN LAS RODILLAS ----------------
    const cadera = M.loft([[0.27, 0.05, 0.05], [0.3, 0.2, 0.135], [0.4, 0.203, 0.14], [0.45, 0.19, 0.138], [0.47, 0.182, 0.132], [0.478, 0.158, 0.116]],
      { segRadio: 60, subdiv: 4, nombre: 'CaderaPantalon' });
    poner('Cadera', cadera);
    const enCadera = (lista, lado = 1) => lista.map(([x, y]) => sobre(cadera, x, y, lado, 0.0015)).filter(Boolean);
    poner('Cadera', costura(enCadera([[0.002, 0.43], [0.002, 0.38], [0.012, 0.352], [0.03, 0.362], [0.032, 0.43]]), 'CosturaPantalon'));   // bragueta
    LADOS.forEach((s) => {
      poner('Cadera', costura(enCadera([[s * 0.11, 0.43], [s * 0.14, 0.4], [s * 0.168, 0.372]]), 'CosturaPantalon'));                     // bolsillos delanteros
      poner('Cadera', costura(enCadera([[s * 0.045, 0.42], [s * 0.08, 0.422], [s * 0.125, 0.418], [s * 0.122, 0.37], [s * 0.085, 0.355], [s * 0.048, 0.372], [s * 0.045, 0.42]], -1), 'CosturaPantalon'));
      const x = s * PIE_X;
      const PIERNA = [[0.18, 0.083, 0.087, x, -0.02], [0.22, 0.086, 0.09, x, -0.02], [0.26, 0.09, 0.094, x, -0.018], [0.3, 0.094, 0.099, x, -0.016], [0.335, 0.098, 0.104, x * 0.97, -0.015]];
      poner('Pierna' + L(s), M.loft(PIERNA, { segRadio: 44, subdiv: 4, nombre: 'Pierna' }));
      const rxP = (y) => M.interp(PIERNA.map((f) => [f[0], f[1]]), y);
      const rzP = (y) => M.interp(PIERNA.map((f) => [f[0], f[2]]), y);
      const enPierna = (a, y, d = 0.0015) => V(x + Math.sin(a) * (rxP(y) + d), y, -0.02 + Math.cos(a) * (rzP(y) + d));
      // costura lateral
      poner('Pierna' + L(s), costura([0.2, 0.26, 0.33].map((y) => enPierna(s * Math.PI / 2, y)), 'CosturaPantalon'));
      // roto de la rodilla: piel que asoma, hilos claros cruzados y borde deshilachado
      const yR = 0.238;
      const centro = enPierna(s * 0.08, yR, -0.004);
      poner('Pierna' + L(s), bloque(centro.x, centro.y, centro.z, 0.034, 0.02, 0.008, 0.85, 'RotoPiel'));
      [-0.008, 0.002].forEach((dy) => poner('Pierna' + L(s), M.tubo([enPierna(s * 0.08 - 0.32, yR + dy, 0.002), enPierna(s * 0.08, yR + dy - 0.002, 0.004), enPierna(s * 0.08 + 0.32, yR + dy, 0.002)],
        0.0018, 0.0018, { segLargo: 8, segRadio: 5, nombre: 'Hilos' })));
      for (let k = 0; k < 7; k++) {
        const a = s * 0.08 + (k / 6 - 0.5) * 0.7;
        const raiz = enPierna(a, yR - 0.018, 0.001);
        poner('Pierna' + L(s), M.tubo([raiz, raiz.clone().add(V(0, -0.008 - 0.006 * azar(), 0.004))], 0.0045, 0.0008, { segLargo: 3, segRadio: 5, nombre: 'Hilos' }));
      }
      // botas de trabajo: caña con el vaquero metido dentro y borde superior
      poner('Pierna' + L(s), M.loft([[0.08, 0.09, 0.096, x, -0.022], [0.15, 0.092, 0.097, x, -0.021], [0.205, 0.095, 0.1, x, -0.02]], { segRadio: 40, subdiv: 4, nombre: 'CanaBota' }));
      poner('Pierna' + L(s), M.aro(x, 0.205, -0.02, 0.095, 0.1, 0.006, 'BotaClara'));
      poner('Pierna' + L(s), costura([0.09, 0.15, 0.2].map((y) => V(x - s * 0.094, y, -0.021)), 'BotaClara', 0.0025));
    });
    // pie de la bota: puntera redonda, suela gruesa y tacón
    const ZAPATO = [
      [-0.112, 0, 0, 0, -0.095], [-0.1, 0.066, 0.085, 0, -0.095], [-0.06, 0.09, 0.1, 0, -0.1], [0.0, 0.094, 0.1, 0, -0.1],
      [0.06, 0.098, 0.09, 0, -0.09], [0.12, 0.096, 0.075, 0, -0.077], [0.16, 0.08, 0.064, 0, -0.068], [0.186, 0.04, 0.04, 0, -0.066], [0.195, 0, 0, 0, -0.066]
    ];
    const SUELA = ZAPATO.map(([l, rx]) => [l * 1.035, rx < 0.01 ? 0 : rx + 0.01, rx < 0.01 ? 0 : 0.022, 0, -0.02]);
    LADOS.forEach((s) => {
      [[ZAPATO, 'BotaPie'], [SUELA, 'SuelaBota']].forEach(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 48, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(s * PIE_X, 0, -0.02);
        poner('Pie' + L(s), m);
      });
      poner('Pie' + L(s), bloque(s * PIE_X, 0.018, -0.1, 0.06, 0.022, 0.04, 0.5, 'SuelaBota'));
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
        ['Brazo' + L(s), 'Pecho', s * 0.19, 0.7, -0.01],            // hombro
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.27, 0.49, 0.002],     // muñeca
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

    // ---------------- COLORES (paleta de la hoja: naranja, piel, azul claro, gris oscuro, vaquero, rojo óxido y gris pardo) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xdaa588, pielSombra: 0xae7a62, musculo: 0xbc876a, labio: 0x5a2a22, cicatriz: 0xc27c6a,
      pelo: 0xb84c1c, peloClaro: 0xc65826, peloOscuro: 0x9a3a16, ceja: 0xa4401a,
      ojo: 0xf4f2f0, iris: 0x5a94c4, pupila: 0x0f1a26, brillo: 0xffffff, pestanas: 0x2a1610,
      chaleco: 0x2c3036, chalecoForro: 0x202328, jiron: 0x34383f, costura: 0x40454d, boton: 0x18191c, bolsillo: 0x5a3a2a,
      pantalon: 0x46648a, costuraPantalon: 0x6c86a8, hilos: 0xb8c4d0,
      bota: 0x2e2624, botaClara: 0x3e3430, suela: 0x1a1614
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Mano: 'piel', Oreja: 'piel', Nariz: 'piel', RotoPiel: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', PliegueMano: 'pielSombra', Ombligo: 'pielSombra', Musculo: 'musculo', Boca: 'labio', Cicatriz: 'cicatriz',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Pua: 'pelo', PuaClara: 'peloClaro', Patilla: 'peloOscuro', Barba: 'pelo', Bigote: 'peloOscuro', BocaBarba: 'labio', Vello: 'peloOscuro',
      Chaleco: 'chaleco', SisaChaleco: 'chaleco', Jiron: 'jiron', Costura: 'costura', Boton: 'boton', Bolsillo: 'bolsillo',
      CaderaPantalon: 'pantalon', Pierna: 'pantalon', CosturaPantalon: 'costuraPantalon', Hilos: 'hilos',
      CanaBota: 'bota', BotaClara: 'botaClara', BotaPie: 'bota', SuelaBota: 'suela'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Chaleco: ['chaleco', 'chalecoForro'] };
    const METAL = { boton: [0x3a3a40, 30] };
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
      const nombre = o.name.replace(/(BordeIzquierdo|BordeDerecho|Base|Pared\d+)$/, '');
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
