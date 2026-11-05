/**
 * Blanche — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/blanche.jpeg
 * (vistas de frente, perfil y espalda, adornos del pelo, falda, hombrera con capa, bota, guante y caras).
 *
 * Mismo estilo y escala que Alvin, Amelia, Ander y Beatriz (altura ~1,30 m): cabeza grande (~40 %), ojos
 * grandes por capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rosa malva muy largo y salvaje: casco cerrado + flequillo en punta + puntas en la coronilla
 *   + melena cerrada con mucho volumen hasta debajo de la cadera + mechones delante y a los lados
 *   + dos adornos dorados en forma de cuerno creciente con gema morada
 *   → piel clara y ojos rosados
 *   → vestido azul sin mangas: cuello alto morado, joya rosa con filigrana dorada en el pecho, corsé morado
 *     con cordones, fajín con medallón y cintas, falda corta y tabardo largo en punta con ribete y adorno
 *   → guantes largos morados con brazal y anillos dorados; hombrera dorada y morada solo en el hombro izquierdo
 *   → capa larga oscura desde los hombros, forro magenta y bajo en jirones
 *   → botas altas moradas con bandas, adorno y puntera dorados y tacón.
 * Prendas, capa y melena son sólidas (capa de fuera + de dentro unidas: nada queda suelto ni hueco).
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de los demás personajes): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * La melena y los mechones largos se doblan con la cabeza (arriba) y el pecho (abajo) (M.pielConHuesos).
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'blanche',
  categoria: 'personajes',
  nombre: 'Blanche (chibi)',
  icono: '🔮',
  origen: 'assets/personajes 3d/blanche.jpeg',

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
    const rayo = new THREE.Raycaster();
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
      // Ceja corta y gruesa, algo arqueada
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

    // ---------------- PELO rosa muy largo y salvaje: casco, flequillo, melena, mechones y adornos de cuerno ----------------
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
    // Puntas sueltas en la coronilla (pelo despeinado, como en la hoja)
    [[0.0, 1.245, -0.03, 0.04, 1.33, -0.07, 0.09, 1.35, -0.05], [-0.06, 1.23, -0.06, -0.11, 1.3, -0.1, -0.16, 1.31, -0.08],
      [0.07, 1.22, -0.1, 0.13, 1.28, -0.16, 0.18, 1.27, -0.17], [-0.03, 1.2, -0.15, -0.06, 1.25, -0.24, -0.08, 1.22, -0.29]]
      .forEach(([a, b, c, d, e, f, h, i, j]) => poner('Cabeza', mechon([V(a, b, c), V(d, e, f), V(h, i, j)], 0.07, 0.03, 'MechonPunta')));

    // Melena larga y con mucho volumen hasta debajo de la cadera, cerrada (capa de fuera con mechones + capa
    // de dentro + bordes), con puntas salvajes abajo; cae por encima de la capa.
    // Perfil por altura: [y, semiancho, semifondo, centro z, medio ángulo libre delante]
    const PERFIL_MELENA = [[0.3, 0.335, 0.335, -0.02, 1.9], [0.42, 0.315, 0.318, -0.02, 1.9], [0.56, 0.295, 0.305, -0.02, 1.9], [0.68, 0.272, 0.285, -0.02, 1.9],
      [0.78, 0.252, 0.262, -0.02, 1.7], [0.86, 0.245, 0.242, -0.02, 1.48], [0.93, 0.258, 0.248, -0.014, 1.3], [0.985, 0.245, 0.235, -0.012, 1.2]];
    const perfil = (y, j) => M.interp(PERFIL_MELENA.map((f) => [f[0], f[j]]), y);
    const melena = (() => {
      const C = M.seg(110, 20);
      const R = M.seg(80, 14);
      const N_PUNTAS = 12;
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
          const yFin = 0.34 - 0.1 * Math.pow(pico, 1.2) - 0.035 * Math.sin(u * 23) - 0.02 * Math.sin(u * 7);
          const t = r / R;
          const y = 0.985 + (yFin - 0.985) * t;
          const medio = perfil(y, 4);
          const th = medio + u * (2 * Math.PI - 2 * medio);
          const rx = perfil(y, 1);
          const rz = perfil(y, 2);
          const cz = perfil(y, 3);
          const mechones = 1 + 0.04 * Math.pow(Math.cos(Math.PI * fase), 2) * suave(0.93, 0.8, y);   // relieve de mechones
          const abre = 1 + 0.08 * suave(0.6, 1, t) * pico;               // las puntas se abren hacia fuera
          const estrecha = 1 - 0.3 * suave(0.75, 1, t) * (1 - pico);
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
      // Mechones salvajes que se abren a los lados (dan el volumen de la hoja)
      pieles.push([mechonLargo([V(s * 0.25, 0.96, -0.08), V(s * 0.31, 0.86, -0.1), V(s * 0.35, 0.74, -0.1), V(s * 0.37, 0.63, -0.08)], 0.09, 0.03, 'MechonSalvaje'), pesoPelo]);
      pieles.push([mechonLargo([V(s * 0.22, 1.05, -0.12), V(s * 0.3, 1.0, -0.16), V(s * 0.36, 0.9, -0.17), V(s * 0.39, 0.8, -0.15)], 0.08, 0.028, 'MechonSalvaje'), pesoPelo]);
      // Adorno dorado en forma de cuerno creciente, con gema morada en la base
      poner('Cabeza', M.tubo([V(s * 0.19, 1.12, 0.012), V(s * 0.24, 1.18, 0.0), V(s * 0.262, 1.25, -0.03), V(s * 0.24, 1.31, -0.06), V(s * 0.2, 1.335, -0.065)],
        0.03, 0.002, { segLargo: 30, segRadio: 16, ruido: (t) => 1 + 0.35 * Math.sin(Math.PI * t), nombre: 'AdornoCuerno' }));
      poner('Cabeza', bloque(s * 0.222, 1.15, 0.028, 0.018, 0.024, 0.012, 1, 'GemaCuerno'));
      poner('Cabeza', bloque(s * 0.222, 1.15, 0.02, 0.026, 0.032, 0.012, 0.6, 'MarcoGema'));
    });

    // ---------------- CUERPO: brazos y hombros al aire (vestido sin mangas) ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));

    // ---------------- VESTIDO AZUL: corpiño sin mangas (sólido), joya rosa y filigrana dorada ----------------
    prendaSolida([[0.54, 0.162, 0.12], [0.6, 0.16, 0.12], [0.64, 0.168, 0.132, 0, 0.006], [0.68, 0.172, 0.136, 0, 0.008], [0.72, 0.17, 0.126, 0, 0.004],
      [0.755, 0.162, 0.113], [0.775, 0.14, 0.1]], null, 0.01, { segRadio: 76, subdiv: 5, nombre: 'Corpino' }).forEach((p) => poner('Pecho', p));
    poner('Pecho', bloque(0, 0.715, 0.135, 0.022, 0.026, 0.008, 0.6, 'MarcoJoya'));
    poner('Pecho', bloque(0, 0.715, 0.141, 0.013, 0.017, 0.007, 0.8, 'JoyaPecho'));
    LADOS.forEach((s) => {
      poner('Pecho', M.tubo([[s * 0.02, 0.695, 0.138], [s * 0.05, 0.672, 0.142], [s * 0.066, 0.64, 0.14], [s * 0.05, 0.605, 0.13], [s * 0.028, 0.6, 0.128]],
        0.0045, 0.0035, { segLargo: 30, segRadio: 8, nombre: 'Filigrana' }));
      poner('Pecho', M.tubo([[s * 0.03, 0.74, 0.122], [s * 0.065, 0.735, 0.12], [s * 0.1, 0.72, 0.108]], 0.004, 0.003, { segLargo: 14, segRadio: 8, nombre: 'Filigrana' }));
    });
    // Cuello alto morado con ribete dorado arriba
    const ribete = (fila, nombre, sube = 0) => {
      const pts = fila.filter((_, k) => k % 3 === 0).map(([x, y, z]) => V(x * 1.025, y + sube, z * 1.025));
      return M.tubo(pts, 0.0065, 0.0065, { segLargo: 120, segRadio: 8, nombre });
    };
    const cuelloAlto = prendaSolida([[0.765, 0.098, 0.086, 0, -0.004], [0.795, 0.095, 0.085, 0, -0.006], [0.822, 0.09, 0.08, 0, -0.008]],
      null, 0.009, { segRadio: 60, subdiv: 4, nombre: 'CuelloAlto' });
    cuelloAlto.forEach((p) => poner('Pecho', p));
    poner('Pecho', ribete(cuelloAlto[0].userData.filasExt[0], 'RibeteCuello', -0.002));
    // Corsé morado con cordones delante
    prendaSolida([[0.46, 0.166, 0.126], [0.51, 0.158, 0.119], [0.575, 0.17, 0.128]], null, 0.01, { segRadio: 72, subdiv: 4, nombre: 'Corse' }).forEach((p) => poner('Pecho', p));
    const cordon = [];
    for (let k = 0; k <= 8; k++) cordon.push(V((k % 2 ? 1 : -1) * 0.024, 0.475 + k * 0.011, 0.131 + 0.004 * Math.sin(k * 0.4)));
    poner('Pecho', M.tubo(cordon, 0.0035, 0.0035, { segLargo: 60, segRadio: 6, nombre: 'Cordon' }));
    // Fajín morado con medallón dorado y dos cintas que cuelgan al lado
    poner('Cadera', M.aro(0, 0.474, -0.002, 0.176, 0.134, 0.012, 'Fajin'));
    poner('Cadera', bloque(0, 0.474, 0.142, 0.024, 0.024, 0.009, 1, 'Medallon'));
    poner('Cadera', bloque(0, 0.474, 0.15, 0.011, 0.011, 0.005, 1, 'GemaMedallon'));
    poner('Cadera', mechonLargo([V(0.13, 0.468, 0.118), V(0.145, 0.42, 0.13), V(0.152, 0.36, 0.14), V(0.15, 0.3, 0.145)], 0.035, 0.008, 'CintaFajin'));
    poner('Cadera', mechonLargo([V(0.105, 0.468, 0.13), V(0.112, 0.43, 0.145), V(0.12, 0.39, 0.152)], 0.03, 0.008, 'CintaFajin'));

    // ---------------- FALDA CORTA AZUL ABIERTA DELANTE Y TABARDO LARGO EN PUNTA ----------------
    const falda = prendaSolida([[0.355, 0.218, 0.172], [0.41, 0.196, 0.154], [0.47, 0.174, 0.132]], [[0.355, 0.075], [0.47, 0.05]], 0.01, { segRadio: 80, subdiv: 5, nombre: 'Falda' });
    falda.forEach((p) => poner('Cadera', p));
    poner('Cadera', ribete(falda[0].userData.filasExt[falda[0].userData.filasExt.length - 1], 'RibeteFalda', 0.004));
    const TABARDO = [[0.15, 0, 0, 0, 0.168], [0.17, 0.035, 0.008, 0, 0.167], [0.2, 0.062, 0.009, 0, 0.164], [0.3, 0.085, 0.009, 0, 0.158], [0.4, 0.095, 0.009, 0, 0.152], [0.475, 0.1, 0.009, 0, 0.146]];
    poner('Cadera', M.loft(TABARDO, { segRadio: 48, subdiv: 6, nombre: 'Tabardo' }));
    const czTab = (y) => M.interp(TABARDO.map((f) => [f[0], f[4]]), y) + 0.009;
    const borde = [[-0.1, 0.47], [-0.095, 0.4], [-0.085, 0.3], [-0.062, 0.2], [0, 0.152], [0.062, 0.2], [0.085, 0.3], [0.095, 0.4], [0.1, 0.47]]
      .map(([x, y]) => V(x * 0.94, y, czTab(y)));
    poner('Cadera', M.tubo(borde, 0.006, 0.006, { segLargo: 80, segRadio: 8, nombre: 'RibeteTabardo' }));
    // adorno dorado en forma de lira sobre el tabardo
    poner('Cadera', M.tubo([V(0, 0.33, czTab(0.33)), V(0, 0.27, czTab(0.27)), V(0, 0.21, czTab(0.21))], 0.005, 0.003, { segLargo: 16, segRadio: 8, nombre: 'AdornoTabardo' }));
    LADOS.forEach((s) => {
      poner('Cadera', M.tubo([V(0, 0.3, czTab(0.3)), V(s * 0.03, 0.31, czTab(0.31)), V(s * 0.042, 0.28, czTab(0.28)), V(s * 0.03, 0.25, czTab(0.25)), V(s * 0.012, 0.235, czTab(0.235))],
        0.0045, 0.003, { segLargo: 24, segRadio: 8, nombre: 'AdornoTabardo' }));
    });
    poner('Cadera', bloque(0, 0.345, czTab(0.345) + 0.002, 0.014, 0.018, 0.006, 0.6, 'AdornoTabardo'));

    // ---------------- BRAZOS: hombro al aire, guante largo morado, brazal dorado y hombrera izquierda ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      const funda = (t0, t1, r, abombar, nombre, tapa) => {
        const pts = [0, 0.5, 1].map((k) => curva.getPointAt(t0 + (t1 - t0) * k));
        poner('Brazo' + L(s), M.tubo(pts, r, r * 0.92, { segLargo: 16, segRadio: 32, ruido: (t) => 1 + abombar * Math.sin(Math.PI * t), nombre }));
        [t0, t1].forEach((tt) => {
          const P = curva.getPointAt(tt);
          const eje = curva.getTangentAt(tt);
          const tS = M.seg(32, 12);
          const anillo = M.pieza(new THREE.RingGeometry(radioBrazo(tt) * 0.9, r * (tt === t0 ? 1 : 0.92), tS, 2), tapa, tS, 2);
          anillo.position.copy(P);
          anillo.quaternion.setFromUnitVectors(V(0, 0, 1), eje);
          poner('Brazo' + L(s), anillo);
        });
      };
      const aro = (tt, r, nombre) => {
        const tS = M.seg(36, 12);
        const m = M.pieza(new THREE.TorusGeometry(r, 0.0075, 8, tS), nombre, tS, 8);
        m.position.copy(curva.getPointAt(tt));
        m.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), m);
      };
      // guante largo morado (de encima del codo a la mano) y brazal con anillos y placa dorados
      funda(0.36, 0.97, 0.052, 0.03, 'GuanteLargo', 'TapaGuante');
      aro(0.37, 0.054, 'AnilloGuante');
      funda(0.6, 0.9, 0.058, 0.04, 'Brazal', 'TapaBrazal');
      aro(0.61, 0.059, 'AnilloBrazal');
      aro(0.89, 0.055, 'AnilloBrazal');
      const medio = curva.getPointAt(0.75);
      poner('Brazo' + L(s), bloque(medio.x + s * 0.058, medio.y, medio.z + 0.004, 0.006, 0.03, 0.02, 0.55, 'AdornoBrazal'));
      // mano con guante morado entero
      poner('Mano' + L(s), bloque(s * 0.258, 0.43, 0.012, 0.05, 0.056, 0.054, 0.65, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.384, 0.018, 0.041, 0.024, 0.044, 0.7, 'Guante'));
      // hombrera en capas solo en el hombro izquierdo (como en la hoja)
      if (s > 0) {
        [[0.205, 0.718, -0.008, 0.088, 0.072, 0.094, -0.32, 'Hombrera'], [0.244, 0.664, -0.008, 0.07, 0.05, 0.082, -0.72, 'HombreraBaja']]
          .forEach(([x, y, z, hx, hy, hz, giro, nombre]) => {
            const sW = M.seg(36, 12);
            const sH = M.seg(14, 6);
            const geo = new THREE.SphereGeometry(1, sW, sH, 0, Math.PI * 2, 0, Math.PI / 2);
            geo.scale(hx, hy, hz);
            const casco = M.pieza(geo, nombre, sW, sH);
            casco.position.set(x, y, z);
            casco.rotation.z = giro;
            poner('BrazoI', casco);
            const tS = M.seg(40, 12);
            const borde = M.pieza(new THREE.TorusGeometry(1, 0.008 / hx, 8, tS), 'RibeteHombrera', tS, 8);
            borde.rotation.x = Math.PI / 2;
            borde.scale.set(hx, hz, hx);
            const piv = new THREE.Group();
            piv.position.set(x, y, z);
            piv.rotation.z = giro;
            piv.add(borde);
            poner('BrazoI', piv);
          });
        poner('BrazoI', M.tubo([V(0.19, 0.786, -0.01), V(0.205, 0.81, -0.01), V(0.23, 0.815, -0.012), V(0.25, 0.8, -0.012)], 0.012, 0.002, { segLargo: 16, segRadio: 10, nombre: 'AdornoHombrera' }));
      }
    });

    // ---------------- CAPA LARGA OSCURA DESDE LOS HOMBROS (forro magenta, bajo en jirones) ----------------
    const RX_CAPA = [[0.07, 0.37], [0.4, 0.335], [0.6, 0.31], [0.72, 0.285], [0.775, 0.17]];
    const RZ_CAPA = [[0.07, 0.3], [0.4, 0.27], [0.6, 0.245], [0.72, 0.2], [0.775, 0.13]];
    const capa = (() => {
      const C = M.seg(96, 20);
      const R = M.seg(56, 12);
      const A0 = 1.0;                                                    // abierta delante, cae de los hombros
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const th = A0 + u * (2 * Math.PI - 2 * A0);
          const jiron = Math.pow(Math.abs(Math.sin(u * Math.PI * 8.5)), 0.6) * (0.6 + 0.4 * Math.sin(u * 27));
          const yFin = 0.07 + 0.15 * jiron;
          const t = r / R;
          const y = 0.775 + (yFin - 0.775) * Math.pow(t, 0.85);
          const pliegue = 1 + 0.06 * Math.sin(u * Math.PI * 18) * suave(0.65, 0.2, y);   // pliegues verticales abajo
          const rx = M.interp(RX_CAPA, y) * pliegue;
          const rz = M.interp(RZ_CAPA, y) * pliegue;
          const cz = -0.035;
          fe.push([rx * Math.sin(th), y, cz + rz * Math.cos(th)]);
          fi.push([(rx - 0.009) * Math.sin(th), y, cz + (rz - 0.009) * Math.cos(th)]);
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
      return [m, ...bordes];
    })();
    capa.forEach((p) => poner('Pecho', p));

    // ---------------- SHORTS Y BOTAS ALTAS MORADAS ----------------
    poner('Cadera', M.loft([[0.27, 0.05, 0.05], [0.3, 0.185, 0.125], [0.42, 0.19, 0.13], [0.5, 0.168, 0.12], [0.52, 0.15, 0.11]], { segRadio: 56, subdiv: 4, nombre: 'CaderaPantalon' }));
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.26, 0.07, 0.075, x, -0.02], [0.33, 0.083, 0.088, x * 0.95, -0.015]], { segRadio: 36, subdiv: 4, nombre: 'PiernaPantalon' }));
      poner('Pierna' + L(s), M.loft([[0.07, 0.07, 0.076, x, -0.02], [0.15, 0.072, 0.078, x, -0.02], [0.22, 0.076, 0.081, x, -0.018], [0.285, 0.081, 0.087, x, -0.016], [0.298, 0.083, 0.089, x, -0.016]],
        { segRadio: 40, subdiv: 5, nombre: 'CanaBota' }));
      poner('Pierna' + L(s), M.aro(x, 0.292, -0.016, 0.084, 0.09, 0.007, 'BandaBota'));
      poner('Pierna' + L(s), M.aro(x, 0.278, -0.016, 0.083, 0.089, 0.004, 'BandaBota'));
      poner('Pierna' + L(s), M.aro(x, 0.12, -0.02, 0.072, 0.078, 0.005, 'BandaBota'));
      // adorno dorado en rombo sobre la rodilla
      poner('Pierna' + L(s), bloque(x, 0.232, 0.07, 0.026, 0.034, 0.01, 0.55, 'AdornoBota'));
      poner('Pierna' + L(s), bloque(x, 0.232, 0.077, 0.011, 0.015, 0.006, 0.9, 'GemaBota'));
    });
    // Pie de la bota (redondo, inclinado sobre su tacón) con puntera y tacón dorados
    const BOTA = [
      [-0.105, 0, 0, 0, -0.09], [-0.095, 0.058, 0.075, 0, -0.09], [-0.06, 0.077, 0.088, 0, -0.092], [0.0, 0.082, 0.088, 0, -0.09],
      [0.06, 0.084, 0.078, 0, -0.08], [0.12, 0.078, 0.064, 0, -0.068], [0.16, 0.06, 0.05, 0, -0.058], [0.182, 0.027, 0.028, 0, -0.054], [0.19, 0, 0, 0, -0.054]
    ];
    const SUELA = BOTA.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.007, rx < 0.01 ? 0 : 0.014, 0, -0.012]);
    const INCLINA = 0.14;                                                 // talón arriba sobre el tacón
    LADOS.forEach((s) => {
      [[BOTA, 'BotaPie'], [SUELA, 'SuelaBota']].forEach(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2 + INCLINA;
        m.position.set(s * PIE_X, 0.025, -0.02);
        poner('Pie' + L(s), m);
      });
      poner('Pie' + L(s), bloque(s * PIE_X, 0.022, -0.115, 0.03, 0.024, 0.03, 0.75, 'Tacon'));
      poner('Pie' + L(s), bloque(s * PIE_X, 0.05, 0.13, 0.062, 0.042, 0.05, 0.85, 'PunteraBota'));
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
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.252, 0.49, 0.002],    // muñeca (dentro del guante)
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
    // melena y mechones largos: se doblan suave entre la cabeza y el pecho
    pieles.forEach(([malla, pesos]) => { g.add(malla); M.pielConHuesos(malla, g, pesos); });

    // ---------------- COLORES (paleta de la hoja: rosa, azul, dorado, morado y morado oscuro) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0xcfa892, pielSombra: 0xa87e6a, labio: 0x9a5a5e,
      pelo: 0xb8608e, peloClaro: 0xc66d9b, peloSombra: 0x84426a, ceja: 0x9a4a76,
      ojo: 0xf7f2f2, iris: 0xb43a62, pupila: 0x2a0a1a, brillo: 0xffffff, pestanas: 0x2a1020,
      vestido: 0x3d4ea0, forroVestido: 0x2c3570, morado: 0x4a2c5a, moradoOscuro: 0x2c1c34, cordon: 0x1e1622,
      capa: 0x2a1f2e, capaForro: 0x5a2448, shorts: 0x3a2448, suela: 0x1e1620,
      oro: 0xb48a3c, joya: 0xd0508a, gema: 0x5a2a7a
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Melena: 'pelo', MelenaBorde: 'peloSombra', MechonDelantero: 'peloClaro', MechonSalvaje: 'pelo', MechonPunta: 'peloClaro',
      Flequillo: 'peloClaro', FlequilloCentro: 'peloClaro', AdornoCuerno: 'oro', MarcoGema: 'oro', GemaCuerno: 'gema',
      Corpino: 'vestido', MarcoJoya: 'oro', JoyaPecho: 'joya', Filigrana: 'oro',
      CuelloAlto: 'morado', CuelloAltoBordeIzquierdo: 'oro', CuelloAltoBordeDerecho: 'oro', RibeteCuello: 'oro',
      Corse: 'morado', Cordon: 'cordon', Fajin: 'morado', Medallon: 'oro', GemaMedallon: 'gema', CintaFajin: 'morado',
      Falda: 'vestido', FaldaBordeIzquierdo: 'oro', FaldaBordeDerecho: 'oro', RibeteFalda: 'oro', Tabardo: 'vestido', RibeteTabardo: 'oro', AdornoTabardo: 'oro',
      GuanteLargo: 'morado', TapaGuante: 'moradoOscuro', AnilloGuante: 'oro', Brazal: 'morado', TapaBrazal: 'moradoOscuro', AnilloBrazal: 'oro', AdornoBrazal: 'oro', Guante: 'morado',
      Hombrera: 'morado', HombreraBaja: 'morado', RibeteHombrera: 'oro', AdornoHombrera: 'oro',
      Capa: 'capa', CapaBorde: 'capaForro', CaderaPantalon: 'shorts', PiernaPantalon: 'shorts',
      CanaBota: 'morado', BotaPie: 'morado', SuelaBota: 'suela', Tacon: 'oro', PunteraBota: 'oro', BandaBota: 'oro', AdornoBota: 'oro', GemaBota: 'gema'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Corpino: ['vestido', 'forroVestido'], CuelloAlto: ['morado', 'moradoOscuro'], Corse: ['morado', 'moradoOscuro'], Falda: ['vestido', 'forroVestido'],
      Capa: ['capa', 'capaForro'], Melena: ['pelo', 'peloSombra'] };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; oro y plata brillan
    function material(clave, porVertice) {
      const id = clave + (porVertice ? '+v' : '');
      if (!materiales[id]) {
        const metal = clave === 'oro';
        const m = metal
          ? new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
            specular: 0x5a4422, shininess: 34 })
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
      const clave = PINTURA[o.name];
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
