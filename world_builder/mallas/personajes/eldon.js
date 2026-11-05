/**
 * Eldon — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/eldon.jpeg
 * (vistas de frente, perfil y espalda, caras, pelo, camiseta, pantalón, placa, guantes y botas).
 *
 * Mismo estilo y escala que los demás personajes (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rubio despeinado: casco cerrado + flequillo espeso + mechones en punta alrededor (arriba en la
 *   coronilla, cayendo por los lados y en punta en la nuca) + mechones sobre las orejas
 *   → piel clara, ojos gris pardo y gesto serio
 *   → camiseta blanca de manga corta, cerrada, con cuello redondo y pliegues suaves
 *   → cadena de bolitas con una placa militar
 *   → guantes negros sin dedos con muñequera y hueco sobre los nudillos
 *   → cinturón negro con hebilla plateada y la punta colgando
 *   → pantalón cargo verde oscuro: bragueta, bolsillos de ranura detrás, bolsillos laterales con tapa,
 *     tira al muslo con hebilla y correas colgando con anilla
 *   → botas militares marrón oscuro con cordones por la caña y el empeine, puntera y suela gruesa.
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'eldon',
  categoria: 'personajes',
  nombre: 'Eldon (chibi)',
  icono: '🪖',
  origen: 'assets/personajes 3d/eldon.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.115;                              // separación de piernas y botas desde el centro
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

    // ---------------- PELO RUBIO DESPEINADO: casco, flequillo espeso, mechones en punta alrededor y mechones sobre las orejas ----------------
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
    const azar = M.azar(41);
    const ARRIBA = V(0, 1, 0);
    // [ángulo desde arriba, lista de ángulos alrededor, largo, cuánto sube (+) o baja (−) la punta]
    const ANILLOS_PUAS = [
      [0.2, [0.4, 1.6, 2.8, -2.0, -0.8], 0.1, 0.9],                      // remolino de la coronilla hacia arriba
      [0.55, [0.0, 0.6, 1.2, 1.8, 2.4, 3.0, -2.7, -2.1, -1.5, -0.9, -0.35], 0.095, 0.3],
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
    // Mechones que caen sobre las orejas hasta la mejilla
    LADOS.forEach((s) => {
      const pts = [[0.975, 0.03], [0.91, 0.045], [0.845, 0.05]].map(([y, z]) => {
        cabeza.updateMatrixWorld(true);
        rayo.set(V(s * 3, y, z), V(-s, 0, 0));
        const h = rayo.intersectObject(cabeza, false)[0];
        return h ? h.point.clone().add(V(s * 0.016, 0, 0)) : null;
      }).filter(Boolean);
      if (pts.length === 3) poner('Cabeza', mechon(pts, 0.07, 0.03, 'Patilla'));
    });


    // ---------------- CAMISETA BLANCA DE MANGA CORTA (cerrada, cuello redondo) ----------------
    const CAMISETA = [
      [0.452, 0.2, 0.151], [0.52, 0.195, 0.148], [0.6, 0.193, 0.148], [0.68, 0.197, 0.151],
      [0.72, 0.19, 0.145], [0.755, 0.172, 0.128], [0.78, 0.136, 0.106], [0.797, 0.088, 0.08]
    ];
    prendaSolida(CAMISETA, null, 0.01, { segRadio: 84, subdiv: 6, nombre: 'Camiseta' }).forEach((p) => poner('Pecho', p));
    poner('Pecho', M.aro(0, 0.795, -0.003, 0.084, 0.077, 0.0075, 'CuelloCamiseta'));          // cuello redondo de canalé
    const molde = loftAbierto(CAMISETA, null, { segRadio: 84, subdiv: 6, nombre: 'MoldeCamiseta' });
    const enMolde = (lista, lado = 1, d = 0.002) => lista.map(([x, y]) => sobre(molde, x, y, lado, d)).filter(Boolean);
    // pliegues suaves de la tela (a los lados y bajo el pecho)
    LADOS.forEach((s) => {
      poner('Pecho', costura(enMolde([[s * 0.12, 0.6], [s * 0.145, 0.56], [s * 0.16, 0.52]]), 'Pliegue', 0.0024));
      poner('Pecho', costura(enMolde([[s * 0.05, 0.53], [s * 0.08, 0.5], [s * 0.1, 0.475]]), 'Pliegue', 0.0022));
      poner('Pecho', costura(enMolde([[s * 0.04, 0.68], [s * 0.1, 0.62], [s * 0.13, 0.58]], -1), 'Pliegue', 0.0024));
    });

    // ---------------- PLACA MILITAR: cadena de bolitas por encima de la camiseta y una placa ----------------
    const delante = (x, y) => sobre(molde, x, y, 1, 0.006);
    const cadena = [delante(0, 0.605), delante(-0.026, 0.64), delante(-0.048, 0.69), delante(-0.064, 0.74), V(-0.078, 0.795, 0.0), V(-0.062, 0.806, -0.05),
      V(0, 0.808, -0.077), V(0.062, 0.806, -0.05), V(0.078, 0.795, 0.0), delante(0.064, 0.74), delante(0.048, 0.69), delante(0.026, 0.64), delante(0, 0.605)].filter(Boolean);
    poner('Pecho', M.tubo(cadena, 0.0034, 0.0034, { segLargo: 540, segRadio: 6, ruido: (t) => 0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 110)), nombre: 'Cadena' }));
    const pPlaca = sobre(molde, 0, 0.575, 1, 0.006);
    if (pPlaca) {
      const placa = new THREE.Group();
      placa.position.copy(pPlaca);
      placa.rotation.z = 0.05;
      placa.add(bloque(0, 0, 0, 0.018, 0.028, 0.0028, 0.28, 'Placa'));
      placa.add(M.pieza(new THREE.TorusGeometry(0.004, 0.0012, 6, 12), 'Cadena', 12, 6).translateY(0.026));
      poner('Pecho', placa);
    }

    // ---------------- BRAZOS: manga corta, antebrazo al aire y guante negro sin dedos ----------------
    LADOS.forEach((s) => {
      const base = (t) => (t < 0.14 ? 0.053 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.053 - 0.011 * (t - 0.14) / 0.86);
      const radioBrazo = (t) => base(t) * (1 + 0.06 * Math.exp(-(((t - 0.36) / 0.12) ** 2)) + 0.06 * Math.exp(-(((t - 0.7) / 0.1) ** 2)));
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.185, 0.712, -0.01], [s * 0.222, 0.655, -0.008], [s * 0.24, 0.585, -0.004], [s * 0.254, 0.5, 0.002], [s * 0.258, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 52, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      const funda = (t0, t1, extra, nombre, tapa) => {
        const pts = [0, 0.5, 1].map((k) => curva.getPointAt(t0 + (t1 - t0) * k));
        poner('Brazo' + L(s), M.tubo(pts, 1, 1, { segLargo: 16, segRadio: 32, ruido: (t) => radioBrazo(t0 + (t1 - t0) * t) + extra, nombre }));
        [t0, t1].forEach((tt) => {
          const tS = M.seg(32, 12);
          const anillo = M.pieza(new THREE.RingGeometry(radioBrazo(tt) * 0.9, radioBrazo(tt) + extra, tS, 2), tapa, tS, 2);
          anillo.position.copy(curva.getPointAt(tt));
          anillo.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
          poner('Brazo' + L(s), anillo);
        });
      };
      funda(0.06, 0.38, 0.013, 'Manga', 'TapaManga');                       // manga corta hasta medio brazo
      const tS = M.seg(32, 12);
      const dobladillo = M.pieza(new THREE.TorusGeometry(radioBrazo(0.37) + 0.013, 0.0035, 6, tS), 'Manga', tS, 6);
      dobladillo.position.copy(curva.getPointAt(0.37));
      dobladillo.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(0.37));
      poner('Brazo' + L(s), dobladillo);
      funda(0.87, 0.985, 0.008, 'Munequera', 'TapaMunequera');             // muñequera del guante
      // puño: guante negro sin dedos, dedos y pulgar al aire y hueco redondeado sobre los nudillos
      poner('Mano' + L(s), bloque(s * 0.262, 0.43, 0.012, 0.05, 0.054, 0.054, 0.6, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.266, 0.385, 0.02, 0.041, 0.024, 0.045, 0.7, 'Dedos'));
      poner('Mano' + L(s), bloque(s * 0.24, 0.41, 0.058, 0.017, 0.026, 0.016, 0.8, 'Dedos'));
      poner('Mano' + L(s), bloque(s * 0.268, 0.42, 0.061, 0.021, 0.013, 0.005, 0.5, 'Dedos'));
    });

    // ---------------- PANTALÓN CARGO VERDE Y CINTURÓN NEGRO ----------------
    const cadera = M.loft([[0.27, 0.05, 0.05], [0.3, 0.2, 0.135], [0.4, 0.203, 0.14], [0.45, 0.19, 0.138], [0.47, 0.182, 0.132], [0.478, 0.158, 0.116]],
      { segRadio: 60, subdiv: 4, nombre: 'CaderaPantalon' });
    poner('Cadera', cadera);
    const enCadera = (lista, lado = 1) => lista.map(([x, y]) => sobre(cadera, x, y, lado, 0.0015)).filter(Boolean);
    poner('Cadera', costura(enCadera([[0.002, 0.428], [0.002, 0.38], [0.012, 0.352], [0.03, 0.362], [0.032, 0.428]]), 'CosturaPantalon'));   // bragueta
    LADOS.forEach((s) => {
      poner('Cadera', costura(enCadera([[s * 0.11, 0.428], [s * 0.14, 0.4], [s * 0.168, 0.372]]), 'CosturaPantalon'));                     // bolsillos delanteros
      poner('Cadera', costura(enCadera([[s * 0.05, 0.4], [s * 0.09, 0.4], [s * 0.13, 0.398]], -1), 'BolsilloTrasero', 0.003));              // bolsillos traseros de ranura
      poner('Cadera', costura(enCadera([[s * 0.05, 0.392], [s * 0.09, 0.392], [s * 0.13, 0.39]], -1), 'CosturaPantalon'));
    });
    prendaSolida([[0.428, 0.198, 0.146], [0.466, 0.194, 0.143]], null, 0.012, { segRadio: 72, subdiv: 2, nombre: 'Cinturon' }).forEach((p) => poner('Cadera', p));
    [0.1, -0.1, 0.18, -0.18].forEach((x) => [1, -1].forEach((lado) => {
      const z = lado * (0.146 * Math.sqrt(Math.max(0, 1 - (x / 0.198) ** 2)) + 0.003);
      const t = new THREE.Group();
      t.position.set(x, 0.447, z);
      t.rotation.y = Math.atan2(x / 0.198 ** 2, z / 0.146 ** 2);
      t.add(bloque(0, 0, 0, 0.007, 0.024, 0.004, 0.5, 'Trabilla'));
      poner('Cadera', t);
    }));
    poner('Cadera', bloque(-0.004, 0.447, 0.151, 0.03, 0.023, 0.006, 0.25, 'Hebilla'));
    poner('Cadera', bloque(-0.001, 0.447, 0.155, 0.02, 0.014, 0.004, 0.25, 'HuecoHebilla'));
    poner('Cadera', M.tubo([[-0.02, 0.447, 0.16], [0.012, 0.447, 0.16]], 0.0025, 0.0025, { segLargo: 4, segRadio: 6, nombre: 'Hebilla' }));
    poner('Cadera', tira([V(0.024, 0.449, 0.156), V(0.056, 0.444, 0.157), V(0.07, 0.415, 0.151), V(0.075, 0.36, 0.147), V(0.078, 0.305, 0.142)], 0.034, 0.006, 'PuntaCinturon'));
    poner('Cadera', bloque(0.078, 0.302, 0.143, 0.018, 0.012, 0.005, 0.3, 'PuntaMetal'));

    // Piernas rectas algo anchas, recogidas sobre las botas; bolsillo lateral con tapa, tira al muslo con hebilla
    // y correas que cuelgan con anilla
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.19, 0.085, 0.09, x, -0.021], [0.204, 0.092, 0.097, x, -0.021], [0.224, 0.088, 0.093, x, -0.02], [0.26, 0.092, 0.096, x, -0.018],
        [0.3, 0.093, 0.098, x, -0.016], [0.335, 0.097, 0.103, x * 0.97, -0.015]], { segRadio: 44, subdiv: 4, nombre: 'Pierna' }));
      const xb = s * (PIE_X + 0.096);
      poner('Pierna' + L(s), bloque(xb, 0.245, -0.02, 0.011, 0.045, 0.046, 0.35, 'BolsilloCargo'));
      poner('Pierna' + L(s), bloque(xb + s * 0.004, 0.294, -0.02, 0.012, 0.012, 0.05, 0.4, 'TapaCargo'));
      poner('Pierna' + L(s), tira([V(xb + s * 0.013, 0.288, 0.016), V(xb + s * 0.015, 0.22, 0.018), V(xb + s * 0.014, 0.15, 0.016)], 0.015, 0.004, 'TiraCargo'));
      const anilla = M.pieza(new THREE.TorusGeometry(0.01, 0.0022, 6, 16), 'Anilla', 16, 6);
      anilla.position.set(xb + s * 0.017, 0.236, 0.017);
      anilla.rotation.y = Math.PI / 2;
      poner('Pierna' + L(s), anilla);
      poner('Pierna' + L(s), bloque(xb + s * 0.016, 0.148, 0.016, 0.004, 0.006, 0.009, 0.4, 'PuntaMetal'));
      // tira negra alrededor del muslo (pasa por encima del bolsillo) con hebilla plateada
      poner('Pierna' + L(s), M.aro(x + s * 0.004, 0.27, -0.018, 0.112, 0.103, 0.0065, 'TiraMuslo'));
      poner('Pierna' + L(s), bloque(x + s * 0.07, 0.27, 0.066, 0.012, 0.01, 0.006, 0.3, 'Hebilla'));
    });

    // ---------------- BOTAS MILITARES: caña con cordones, puntera y suela gruesa ----------------
    // El pie se modela a lo largo del eje Z y se gira: [largo, semiancho, semialto, 0, -altura del centro]
    const BOTA = [
      [-0.112, 0, 0, 0, -0.095], [-0.1, 0.063, 0.085, 0, -0.095], [-0.06, 0.084, 0.098, 0, -0.1], [0.0, 0.088, 0.098, 0, -0.1],
      [0.06, 0.092, 0.088, 0, -0.09], [0.12, 0.09, 0.074, 0, -0.077], [0.16, 0.074, 0.06, 0, -0.068], [0.184, 0.033, 0.034, 0, -0.065], [0.192, 0, 0, 0, -0.065]
    ];
    const SUELA = BOTA.map(([l, rx]) => [l * 1.035, rx < 0.01 ? 0 : rx + 0.01, rx < 0.01 ? 0 : 0.022, 0, -0.019]);
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      const piezas = [[BOTA, 'Bota'], [SUELA, 'SuelaBota']].map(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 48, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(x, 0.004, -0.02);
        poner('Pie' + L(s), m);
        return m;
      });
      poner('Pie' + L(s), M.loft([[0.09, 0.08, 0.088, x, -0.024], [0.15, 0.079, 0.086, x, -0.024], [0.205, 0.083, 0.089, x, -0.023]], { segRadio: 40, subdiv: 4, nombre: 'CanaBota' }));
      // cordones cruzados: por la caña (de frente) y por el empeine (pegados con rayos desde arriba)
      const zCana = -0.024 + 0.089;
      const cana = [0.184].map((y) => [V(x - 0.021, y, zCana), V(x + 0.021, y, zCana)]);
      const bota = piezas[0];
      bota.updateMatrixWorld(true);
      const arribaDe = (px, z) => {
        rayo.set(V(px, 3, z), V(0, -1, 0));
        const h = rayo.intersectObject(bota, false)[0];
        return h ? h.point.clone().add(V(0, 0.005, 0)) : null;
      };
      const pie = [0.07, 0.09, 0.11].map((z) => [arribaDe(x - 0.026, z), arribaDe(x + 0.026, z)]);
      const filas = [...cana.reverse(), ...pie].filter(([a, b]) => a && b);
      for (let k = 0; k < filas.length - 1; k++) {
        [[filas[k][0], filas[k + 1][1]], [filas[k][1], filas[k + 1][0]]].forEach(([a, b]) => {
          poner('Pie' + L(s), M.tubo([a, b], 0.0038, 0.0038, { segLargo: 4, segRadio: 6, nombre: 'Cordon' }));
        });
      }
      filas.flat().forEach((p) => poner('Pie' + L(s), bloque(p.x, p.y, p.z - 0.002, 0.005, 0.005, 0.004, 1, 'Ojal')));
      const nudo = filas[0][0].clone().lerp(filas[0][1], 0.5);
      poner('Pie' + L(s), M.tubo([nudo, nudo.clone().add(V(s * 0.022, 0.004, 0.008)), nudo.clone().add(V(s * 0.03, -0.03, 0.014))], 0.0036, 0.003, { segLargo: 12, segRadio: 6, nombre: 'Cordon' }));
      poner('Pie' + L(s), M.tubo([nudo, nudo.clone().add(V(-s * 0.018, 0.003, 0.01)), nudo.clone().add(V(-s * 0.022, -0.026, 0.016))], 0.0036, 0.003, { segLargo: 12, segRadio: 6, nombre: 'Cordon' }));
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
        ['Brazo' + L(s), 'Pecho', s * 0.185, 0.7, -0.01],           // hombro
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

    // ---------------- COLORES (paleta de la hoja: rubio, blanco, verde oscuro, negro y plata) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xdcae92, pielSombra: 0xb88a70, labio: 0xa0645a,
      pelo: 0xd8b662, peloClaro: 0xe8c66e, ceja: 0xae8e48,
      ojo: 0xf6f3ee, iris: 0x6e6656, pupila: 0x1e1a16, brillo: 0xffffff, pestanas: 0x2a2016,
      camiseta: 0xe2e4e6, camisetaSombra: 0xbfc3c8, pliegue: 0xc9cdd2,
      pantalon: 0x2e4434, pantalonOscuro: 0x22332a, costuraPantalon: 0x1c2a22,
      negro: 0x27282d, gris: 0x55585e,
      bota: 0x3e3530, botaPuntera: 0x332b27, suela: 0x221d1a, cordon: 0x2a2420,
      plata: 0xc4c7cc
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', BrazoPiel: 'piel', Dedos: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Pua: 'pelo', Flequillo: 'pelo', FlequilloClaro: 'peloClaro', Patilla: 'pelo',
      Camiseta: 'camiseta', CuelloCamiseta: 'camisetaSombra', Pliegue: 'pliegue', Manga: 'camiseta', TapaManga: 'camisetaSombra',
      Cadena: 'plata', Placa: 'plata',
      Munequera: 'negro', TapaMunequera: 'negro', Guante: 'negro',
      CaderaPantalon: 'pantalon', Pierna: 'pantalon', CosturaPantalon: 'costuraPantalon', BolsilloTrasero: 'pantalonOscuro',
      BolsilloCargo: 'pantalon', TapaCargo: 'pantalonOscuro', TiraCargo: 'negro', Anilla: 'plata', PuntaMetal: 'plata', TiraMuslo: 'negro',
      Cinturon: 'negro', Trabilla: 'pantalon', Hebilla: 'plata', HuecoHebilla: 'negro', PuntaCinturon: 'negro',
      Bota: 'bota', SuelaBota: 'suela', CanaBota: 'bota', Cordon: 'cordon', Ojal: 'plata'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Camiseta: ['camiseta', 'camisetaSombra'], Cinturon: ['negro', 'negro'] };
    const METAL = { plata: [0x9a9ca0, 60] };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; la plata brilla
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
    const cBota = new THREE.Color(COLOR.bota);
    const cPuntera = new THREE.Color(COLOR.botaPuntera);
    const tmp = new THREE.Color();
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
      } else if (o.name === 'Bota') {
        // puntera reforzada algo más oscura (largo = y antes de girar la bota)
        pintarVertices(o, (i, p) => tmp.copy(cBota).lerp(cPuntera, suave(0.11, 0.125, p.getY(i))));
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
