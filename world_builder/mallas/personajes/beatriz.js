/**
 * Beatriz — personaje chibi hecho a partir de su hoja de diseño: assets/personajes 3d/beatriz.jpeg
 * (vistas de frente, perfil y espalda, detalles del cuello, el brazal y la bota, caras y paleta).
 *
 * Mismo estilo y escala que Alvin, Amelia y Ander (altura ~1,30 m): cabeza grande (~40 %), ojos grandes por
 * capas, cuerpo corto y piernas cortas rectas y juntas.
 *   pelo rojo muy largo: casco cerrado + flequillo en mechones + melena cerrada hasta la cadera con puntas
 *   + mechones largos delante de los hombros + dos trencitas de cuentas con broches dorados
 *   → piel morena y ojos rojos, mirada decidida
 *   → top rojo corto (tripa al aire) y chaqueta granate abierta de hombros descubiertos: forro morado,
 *     ribetes dorados, cuello alto, mangas cortas abullonadas y abertura trasera con adorno dorado
 *   → capa gris oscura rasgada colgando de la cintura (abierta delante)
 *   → brazales azules con anillos dorados y guantes morados sin dedos
 *   → pantalón negro y botas altas negras con bandas doradas, rodilleras plateadas en punta, placa en el
 *     tobillo y tacón.
 * Prendas, capa y melena son sólidas (capa de fuera + de dentro unidas: nada queda suelto ni hueco).
 *
 * Esqueleto (THREE.Bone, 13 huesos, el mismo de Alvin, Amelia y Ander): HuesoRaiz → HuesoCadera →
 * HuesoPecho → HuesoCuello → HuesoCabeza, HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * La melena y los mechones largos se doblan con la cabeza (arriba) y el pecho (abajo) (M.pielConHuesos).
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'beatriz',
  categoria: 'personajes',
  nombre: 'Beatriz (chibi)',
  icono: '🗡️',
  origen: 'assets/personajes 3d/beatriz.jpeg',

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
        ceja.add(M.tubo([[-s * 0.032, -0.009, 0.007], [0, 0.0, 0.009], [s * 0.036, 0.005, 0.007]], 0.0075, 0.005, { segLargo: 12, segRadio: 10, nombre: 'Ceja' })); // fina y decidida
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

    // ---------------- PELO rojo muy largo: casco, flequillo, melena hasta la cadera, mechones y trencitas ----------------
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
    // Flequillo en mechones finos y en punta, abierto al centro (como en la hoja); no tapa los ojos
    [[-0.03, -0.06, -0.075, 0.905, 0.09], [0.035, 0.06, 0.08, 0.91, 0.09], [0.0, 0.004, 0.01, 0.935, 0.07],
      [-0.12, -0.16, -0.195, 0.885, 0.1], [0.125, 0.165, 0.2, 0.885, 0.1], [-0.2, -0.235, -0.25, 0.86, 0.085], [0.205, 0.24, 0.255, 0.86, 0.085]]
      .forEach(([x0, x1, x2, yFin, ancho], k) => {
        poner('Cabeza', mechon([enPelo(x0 * 0.6, 1.16, 0.008), enPelo(x0, 1.07, 0.016), enPelo(x1, 0.97, 0.016), enPelo(x2, yFin, 0.008)], ancho, 0.036, k < 3 ? 'FlequilloCentro' : 'Flequillo'));
      });

    // Melena larga hasta la cadera, cerrada (capa de fuera con mechones + capa de dentro + bordes) y con
    // las puntas abajo. Perfil por altura: [y, semiancho, semifondo, centro z, medio ángulo libre delante]
    const PERFIL_MELENA = [[0.42, 0.24, 0.2, -0.03, 1.85], [0.56, 0.215, 0.18, -0.025, 1.85], [0.68, 0.205, 0.175, -0.02, 1.85],
      [0.78, 0.21, 0.19, -0.02, 1.75], [0.86, 0.228, 0.22, -0.02, 1.5], [0.93, 0.255, 0.245, -0.014, 1.3], [0.985, 0.245, 0.235, -0.012, 1.2]];
    const perfil = (y, j) => M.interp(PERFIL_MELENA.map((f) => [f[0], f[j]]), y);
    const melena = (() => {
      const C = M.seg(90, 20);
      const R = M.seg(70, 14);
      const N_PUNTAS = 9;
      const GROSOR = 0.022;
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const fase = (u * N_PUNTAS) % 1;
          const pico = 1 - Math.abs(fase - 0.5) * 2;                    // 0 entre mechones, 1 en la punta
          const yFin = 0.445 - 0.075 * Math.pow(pico, 1.4) - 0.02 * Math.sin(u * 17);
          const t = r / R;
          const y = 0.985 + (yFin - 0.985) * t;
          const medio = perfil(y, 4);
          const th = medio + u * (2 * Math.PI - 2 * medio);
          const rx = perfil(y, 1);
          const rz = perfil(y, 2);
          const cz = perfil(y, 3);
          const mechones = 1 + 0.028 * Math.pow(Math.cos(Math.PI * fase), 2) * suave(0.93, 0.8, y);   // relieve de mechones
          const estrecha = 1 - 0.35 * suave(0.75, 1, t) * (1 - pico);   // las puntas se separan abajo
          fe.push([rx * mechones * Math.sin(th), y, cz + rz * mechones * Math.cos(th) * estrecha + (1 - estrecha) * 0.03]);
          fi.push([(rx - GROSOR) * Math.sin(th), y, cz + (rz - GROSOR) * Math.cos(th) * estrecha + (1 - estrecha) * 0.03]);
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
    // Mechones largos delante de los hombros (detrás de las trencitas)
    LADOS.forEach((s) => {
      pieles.push([mechonLargo([V(s * 0.235, 0.985, 0.0), V(s * 0.256, 0.87, 0.025), V(s * 0.238, 0.75, 0.075), V(s * 0.205, 0.63, 0.128), V(s * 0.185, 0.545, 0.142)], 0.1, 0.034, 'MechonDelantero'), pesoPelo]);
      pieles.push([mechonLargo([V(s * 0.245, 0.97, -0.04), V(s * 0.268, 0.85, -0.02), V(s * 0.255, 0.73, 0.02), V(s * 0.232, 0.6, 0.07), V(s * 0.22, 0.52, 0.085)], 0.085, 0.03, 'MechonDelantero'), pesoPelo]);
      // Trencita fina de cuentas delante de la oreja, con broche dorado arriba y atadura abajo
      const trenza = M.curva([V(s * 0.222, 0.935, 0.088), V(s * 0.23, 0.86, 0.102), V(s * 0.218, 0.76, 0.126), V(s * 0.2, 0.665, 0.147)]);
      const N_CUENTAS = 11;
      for (let k = 0; k < N_CUENTAS; k++) {
        const p = trenza.getPointAt((k + 0.5) / N_CUENTAS);
        const lado = k % 2 ? 1 : -1;                                     // las cuentas alternan a cada lado
        const cuenta = bloque(0, 0, 0, 0.0145, 0.017, 0.013, 1, 'Trenza');   // se gira sobre sí misma
        cuenta.position.set(p.x + lado * 0.006, p.y, p.z);
        cuenta.rotation.z = lado * 0.35;
        poner('Cabeza', cuenta);
      }
      const arriba = trenza.getPointAt(0);
      poner('Cabeza', bloque(arriba.x, arriba.y - 0.01, arriba.z + 0.006, 0.016, 0.02, 0.012, 0.7, 'BrocheTrenza'));
      poner('Cabeza', bloque(arriba.x, arriba.y - 0.01, arriba.z + 0.018, 0.007, 0.008, 0.005, 1, 'JoyaBroche'));
      const abajo = trenza.getPointAt(1);
      poner('Cabeza', bloque(abajo.x, abajo.y - 0.004, abajo.z, 0.011, 0.008, 0.011, 1, 'AtaTrenza'));
      poner('Cabeza', mechon([abajo.clone().add(V(0, -0.006, 0)), abajo.clone().add(V(0, -0.03, 0.006)), abajo.clone().add(V(-s * 0.004, -0.055, 0.008))], 0.03, 0.014, 'Trenza'));
    });
    // Broche dorado con joya en la sien derecha (como en la hoja)
    const broche = marco(cabeza, V(-1, 0.975, 0.085), V(1, 0, 0));
    if (broche) {
      broche.position.addScaledVector(V(-1, 0, 0), 0.028);
      broche.add(bloque(0, 0, 0.005, 0.02, 0.026, 0.008, 0.6, 'Broche'));
      broche.add(bloque(0, 0, 0.012, 0.008, 0.01, 0.005, 1, 'JoyaBroche'));
      poner('Cabeza', broche);
    }

    // ---------------- CUERPO: tripa al aire y hombros descubiertos ----------------
    poner('Pecho', M.loft([[0.46, 0.15, 0.11], [0.53, 0.142, 0.104], [0.6, 0.148, 0.108], [0.68, 0.158, 0.112], [0.735, 0.158, 0.108],
      [0.77, 0.13, 0.092], [0.795, 0.085, 0.07], [0.81, 0.06, 0.058]], { segRadio: 64, subdiv: 6, nombre: 'Torso' }));

    // ---------------- TOP ROJO CORTO (sólido, con el pecho marcado) ----------------
    prendaSolida([[0.6, 0.155, 0.114], [0.64, 0.164, 0.128, 0, 0.006], [0.68, 0.168, 0.132, 0, 0.008], [0.72, 0.166, 0.122, 0, 0.004], [0.745, 0.158, 0.11]],
      null, 0.01, { segRadio: 72, subdiv: 5, nombre: 'Top' }).forEach((p) => poner('Pecho', p));

    // ---------------- CHAQUETA GRANATE ABIERTA (sin hombros), forro morado y ribetes dorados ----------------
    const CHAQUETA = [[0.36, 0.215, 0.165], [0.42, 0.2, 0.155], [0.5, 0.182, 0.142], [0.56, 0.174, 0.136], [0.62, 0.18, 0.143], [0.68, 0.184, 0.148], [0.735, 0.176, 0.136]];
    const ABERT_CH = [[0.36, 0.11], [0.45, 0.095], [0.55, 0.085], [0.65, 0.095], [0.735, 0.105]];
    const chaqueta = prendaSolida(CHAQUETA, ABERT_CH, 0.011, { segRadio: 88, subdiv: 6, nombre: 'Chaqueta' });
    chaqueta.forEach((p) => poner('Pecho', p));
    // Ribete dorado del bajo y del borde de arriba (siguen la capa de fuera)
    const ribete = (fila, nombre, sube = 0) => {
      const pts = fila.filter((_, k) => k % 3 === 0).map(([x, y, z]) => V(x * 1.025, y + sube, z * 1.025));
      return M.tubo(pts, 0.0065, 0.0065, { segLargo: 120, segRadio: 8, nombre });
    };
    const filasCh = chaqueta[0].userData.filasExt;
    poner('Pecho', ribete(filasCh[filasCh.length - 1], 'RibeteChaqueta', 0.004));
    poner('Pecho', ribete(filasCh[0], 'RibeteChaqueta', -0.003));
    // Abertura trasera del bajo con adorno dorado en forma de flecha (como en la hoja)
    const atras = (y, d) => V(0, y, -(M.interp(CHAQUETA.map((f) => [f[0], f[2]]), y) + d));
    poner('Pecho', M.tubo([atras(0.362, 0.002), atras(0.4, 0.002), atras(0.44, 0.002)], 0.005, 0.005, { segLargo: 10, segRadio: 8, nombre: 'RajaEspalda' }));
    const adorno = atras(0.455, 0.006);
    poner('Pecho', bloque(adorno.x, adorno.y, adorno.z, 0.014, 0.024, 0.006, 0.55, 'AdornoEspalda'));
    poner('Pecho', bloque(adorno.x, adorno.y + 0.03, adorno.z + 0.001, 0.006, 0.012, 0.004, 0.6, 'AdornoEspalda'));
    // Cuello alto (mandarín) morado con ribete dorado arriba y abertura pequeña delante
    const cuelloAlto = prendaSolida([[0.765, 0.098, 0.086, 0, -0.004], [0.795, 0.095, 0.085, 0, -0.006], [0.822, 0.09, 0.08, 0, -0.008]],
      [[0.76, 0.018], [0.825, 0.03]], 0.009, { segRadio: 60, subdiv: 4, nombre: 'CuelloAlto' });
    cuelloAlto.forEach((p) => poner('Pecho', p));
    poner('Pecho', ribete(cuelloAlto[0].userData.filasExt[0], 'RibeteCuello', -0.002));
    poner('Pecho', bloque(0, 0.782, 0.082, 0.011, 0.014, 0.005, 0.6, 'AdornoCuello'));

    // ---------------- BRAZOS: hombro al aire, manga corta abullonada, brazal azul y guante ----------------
    LADOS.forEach((s) => {
      const radioBrazo = (t) => (t < 0.14 ? 0.05 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.14) ** 2)) : 0.05 - 0.009 * (t - 0.14) / 0.86);
      const camino = [[s * 0.1, 0.72, -0.01], [s * 0.18, 0.712, -0.01], [s * 0.217, 0.655, -0.008], [s * 0.236, 0.585, -0.004], [s * 0.25, 0.5, 0.002], [s * 0.254, 0.465, 0.006]];
      poner('Brazo' + L(s), M.tubo(camino, 1, 1, { segLargo: 48, segRadio: 28, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));
      const curva = M.curva(camino);
      // pieza tubular con tapas en los dos extremos (el brazo pasa por dentro)
      const funda = (t0, t1, r, abombar, nombre, tapa) => {
        const pts = [0, 0.5, 1].map((k) => curva.getPointAt(t0 + (t1 - t0) * k));
        poner('Brazo' + L(s), M.tubo(pts, r, r, { segLargo: 16, segRadio: 32, ruido: (t) => 1 + abombar * Math.sin(Math.PI * t), nombre }));
        [t0, t1].forEach((tt) => {
          const P = curva.getPointAt(tt);
          const eje = curva.getTangentAt(tt);
          const tS = M.seg(32, 12);
          const anillo = M.pieza(new THREE.RingGeometry(radioBrazo(tt) * 0.9, r, tS, 2), tapa, tS, 2);
          anillo.position.copy(P);
          anillo.quaternion.setFromUnitVectors(V(0, 0, 1), eje);
          poner('Brazo' + L(s), anillo);
        });
        return pts;
      };
      // manga corta abullonada (no cubre el hombro) con ribete dorado abajo
      funda(0.3, 0.5, 0.064, 0.14, 'Manga', 'TapaManga');
      const aro = (tt, r, nombre) => {
        const tS = M.seg(36, 12);
        const geo = new THREE.TorusGeometry(r, 0.0075, 8, tS);
        const m = M.pieza(geo, nombre, tS, 8);
        m.position.copy(curva.getPointAt(tt));
        m.quaternion.setFromUnitVectors(V(0, 0, 1), curva.getTangentAt(tt));
        poner('Brazo' + L(s), m);
      };
      aro(0.5, 0.062, 'RibeteManga');
      // brazal azul del codo a la muñeca, con anillos dorados y un adorno en rombo por fuera
      funda(0.62, 0.92, 0.056, 0.05, 'Brazal', 'TapaBrazal');
      aro(0.63, 0.057, 'AnilloBrazal');
      aro(0.91, 0.057, 'AnilloBrazal');
      const medio = curva.getPointAt(0.77);
      const adornoB = bloque(medio.x + s * 0.058, medio.y, medio.z, 0.006, 0.024, 0.014, 0.55, 'AdornoBrazal');
      poner('Brazo' + L(s), adornoB);
      // guante morado sin dedos y las puntas de los dedos con piel
      poner('Mano' + L(s), bloque(s * 0.258, 0.43, 0.012, 0.05, 0.056, 0.054, 0.65, 'Guante'));
      poner('Mano' + L(s), bloque(s * 0.262, 0.384, 0.018, 0.041, 0.022, 0.044, 0.7, 'Dedos'));
    });

    // ---------------- CINTURÓN, CAPA RASGADA Y PANTALÓN ----------------
    poner('Cadera', M.loft([[0.27, 0.05, 0.05], [0.3, 0.185, 0.125], [0.42, 0.19, 0.13], [0.5, 0.168, 0.12], [0.52, 0.15, 0.11]], { segRadio: 56, subdiv: 4, nombre: 'CaderaPantalon' }));
    poner('Cadera', M.aro(0, 0.5, 0, 0.17, 0.124, 0.011, 'Cinturon'));
    // Capa gris oscura que cuelga de la cintura por detrás y a los lados, con el bajo rasgado en jirones
    const capa = (() => {
      const C = M.seg(84, 20);
      const R = M.seg(34, 10);
      const A0 = 0.78;                                                   // abierta delante
      const ext = [];
      const int = [];
      for (let r = 0; r <= R; r++) {
        const fe = [];
        const fi = [];
        for (let c = 0; c <= C; c++) {
          const u = c / C;
          const th = A0 + u * (2 * Math.PI - 2 * A0);
          const jiron = Math.pow(Math.abs(Math.sin(u * Math.PI * 7.5)), 0.6) * (0.6 + 0.4 * Math.sin(u * 23));
          const yFin = 0.075 + 0.1 * jiron;
          const t = r / R;
          const y = 0.5 + (yFin - 0.5) * t;
          const k = Math.pow(t, 1.2);
          const pliegue = 1 + 0.07 * Math.sin(u * Math.PI * 16) * k;        // pliegues verticales
          const rx = (0.176 + 0.12 * k) * pliegue;
          const rz = (0.128 + 0.11 * k) * pliegue;
          const cz = -0.02 - 0.04 * k;
          fe.push([rx * Math.sin(th), y, cz + rz * Math.cos(th)]);
          fi.push([(rx - 0.008) * Math.sin(th), y, cz + (rz - 0.008) * Math.cos(th)]);
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
    capa.forEach((p) => poner('Cadera', p));

    // ---------------- PIERNAS Y BOTAS ALTAS NEGRAS ----------------
    LADOS.forEach((s) => {
      const x = s * PIE_X;
      poner('Pierna' + L(s), M.loft([[0.26, 0.07, 0.075, x, -0.02], [0.33, 0.083, 0.088, x * 0.95, -0.015]], { segRadio: 36, subdiv: 4, nombre: 'PiernaPantalon' }));
      // caña de la bota hasta casi la cadera, con bandas doradas y tira dorada delante
      poner('Pierna' + L(s), M.loft([[0.07, 0.07, 0.076, x, -0.02], [0.15, 0.072, 0.078, x, -0.02], [0.22, 0.076, 0.081, x, -0.018], [0.285, 0.081, 0.087, x, -0.016], [0.298, 0.083, 0.089, x, -0.016]],
        { segRadio: 40, subdiv: 5, nombre: 'CanaBota' }));
      poner('Pierna' + L(s), M.aro(x, 0.292, -0.016, 0.084, 0.09, 0.007, 'BandaBota'));
      poner('Pierna' + L(s), M.aro(x, 0.19, -0.02, 0.075, 0.081, 0.006, 'BandaBota'));
      poner('Pierna' + L(s), M.tubo([[x, 0.285, 0.068], [x, 0.24, 0.064], [x, 0.18, 0.06], [x, 0.11, 0.058]], 0.006, 0.006, { segLargo: 16, segRadio: 8, nombre: 'TiraBota' }));
      // rodillera plateada en punta
      poner('Pierna' + L(s), bloque(x, 0.232, 0.07, 0.036, 0.04, 0.016, 0.6, 'Rodillera'));
      poner('Pierna' + L(s), M.tubo([[x, 0.262, 0.072], [x, 0.285, 0.069], [x, 0.3, 0.064]], 0.016, 0.0, { segLargo: 8, segRadio: 12, nombre: 'PuntaRodillera' }));
      poner('Pierna' + L(s), M.tubo([[x, 0.203, 0.072], [x, 0.188, 0.07]], 0.015, 0.0, { segLargo: 6, segRadio: 12, nombre: 'PuntaRodillera' }));
    });
    // Pie de la bota (redondo, algo inclinado sobre su tacón) y placa plateada en el tobillo
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
      poner('Pie' + L(s), bloque(s * (PIE_X + 0.076), 0.115, -0.03, 0.01, 0.03, 0.045, 0.6, 'PlacaTobillo'));
      poner('Pie' + L(s), bloque(s * PIE_X, 0.13, 0.062, 0.04, 0.026, 0.012, 0.6, 'PlacaTobillo'));
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

    // ---------------- COLORES (paleta de la hoja: rojo, morado, azul, piel, dorado y marrón oscuro) ----------------
    // Tonos base algo más oscuros que la hoja: con la luz del editor quedan como en la paleta.
    const COLOR = {
      piel: 0x925a40, pielSombra: 0x6e4030, labio: 0x5e2f28,
      pelo: 0xa81c26, peloClaro: 0xb8242c, peloSombra: 0x6e1019, ceja: 0x7a141c,
      ojo: 0xf7f2ee, iris: 0xc43a2a, pupila: 0x2a0a0a, brillo: 0xffffff, pestanas: 0x220c0c,
      top: 0x9e1c22, chaqueta: 0x741a36, forro: 0x3e1532, cuello: 0x4c1a3e,
      brazal: 0x34497c, guante: 0x3c1c38, cinturon: 0x2e2220,
      capa: 0x413539, capaForro: 0x2a2226, pantalon: 0x1f2029, bota: 0x241d1f, suela: 0x161214,
      oro: 0xb48a3c, plata: 0x767a84, joya: 0xb01a22
    };
    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', Torso: 'piel', BrazoPiel: 'piel', Oreja: 'piel', Nariz: 'piel', Dedos: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', PestanaInferior: 'pestanas', Ceja: 'ceja',
      Pelo: 'pelo', Melena: 'pelo', MelenaBorde: 'peloSombra', MechonDelantero: 'peloClaro', Trenza: 'pelo', Flequillo: 'peloClaro', FlequilloCentro: 'peloClaro',
      BrocheTrenza: 'oro', AtaTrenza: 'oro', Broche: 'oro', JoyaBroche: 'joya',
      Top: 'top', Chaqueta: 'chaqueta', ChaquetaBordeIzquierdo: 'oro', ChaquetaBordeDerecho: 'oro', RibeteChaqueta: 'oro', AdornoEspalda: 'oro', RajaEspalda: 'forro',
      CuelloAlto: 'cuello', CuelloAltoBordeIzquierdo: 'oro', CuelloAltoBordeDerecho: 'oro', RibeteCuello: 'oro', AdornoCuello: 'oro',
      Manga: 'chaqueta', TapaManga: 'forro', RibeteManga: 'oro',
      Brazal: 'brazal', TapaBrazal: 'brazal', AnilloBrazal: 'oro', AdornoBrazal: 'oro', Guante: 'guante',
      Cinturon: 'cinturon', Capa: 'capa', CapaBorde: 'capaForro', CaderaPantalon: 'pantalon', PiernaPantalon: 'pantalon',
      CanaBota: 'bota', BotaPie: 'bota', SuelaBota: 'suela', Tacon: 'suela', BandaBota: 'oro', TiraBota: 'oro',
      Rodillera: 'plata', PuntaRodillera: 'plata', PlacaTobillo: 'plata'
    };
    // prendas con forro: [color de fuera, color de dentro]
    const CAPAS = { Top: ['top', 'top'], Chaqueta: ['chaqueta', 'forro'], CuelloAlto: ['cuello', 'forro'], Capa: ['capa', 'capaForro'], Melena: ['pelo', 'peloSombra'] };
    const materiales = {};
    // Misma arcilla del estudio (doble cara, polygonOffset para el wireframe) pero con color; oro y plata brillan
    function material(clave, porVertice) {
      const id = clave + (porVertice ? '+v' : '');
      if (!materiales[id]) {
        const metal = clave === 'oro' || clave === 'plata';
        const m = metal
          ? new THREE.MeshPhongMaterial({ side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
            specular: clave === 'plata' ? 0x3c3e44 : 0x5a4422, shininess: clave === 'plata' ? 40 : 34 })
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
