/**
 * Amelia — personaje guerrera chibi hecho a partir de su hoja de diseño oficial:
 * assets/personajes 3d/Amelia.jpeg (vistas frente, perfil, espalda y detalles de armadura).
 *
 * Estilo chibi que encaja en escala y proporciones con Alvin (altura ~1,30 m):
 *   - Cabeza grande y expresiva (~40 % de la altura), ojos grandes anime dorados/ámbar
 *   - Pelo rubio/dorado en capas puntiagudas con flequillo abierto al centro y mechones laterales
 *   - Armadura / túnica azul marino con ribetes dorados, cuello alto y hombreras en capas
 *   - Cinturón doble cruzado con hebilla dorada
 *   - Faldón de combate abierto por delante y con corte de flecha dorada en la espalda
 *   - Guanteletes azul marino con ribetes dorados y guantes oscuros
 *   - Shorts oscuros, muslos visibles y rodilleras de combate con reborde dorado
 *   - Botas altas con tobilleras azul marino, bandas doradas y suela reforzada
 *
 * Esqueleto (THREE.Bone, 13 huesos compatible con Alvin):
 *   HuesoRaiz → HuesoCadera → HuesoPecho → HuesoCuello → HuesoCabeza,
 *   HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones en grupo.animations: 'Reposo', 'Caminar' y 'Celebrar' (para THREE.AnimationMixer).
 */
registrarMalla({
  id: 'amelia',
  categoria: 'personajes',
  nombre: 'Amelia (guerrera chibi)',
  icono: '⚔️',
  origen: 'assets/personajes 3d/Amelia.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado del personaje: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.115;                              // separación de piernas y botas desde el centro

    // Cada pieza se cuelga del hueso correspondiente
    const PARTES = {};
    const poner = (h, obj) => { if (obj) (PARTES[h] = PARTES[h] || []).push(obj); };

    // ---------------- UTILIDADES GEOMÉTRICAS ----------------
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

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

    function bloque(cx, cy, cz, hx, hy, hz, p, nombre) {
      const sW = M.seg(28, 8);
      const sH = M.seg(20, 6);
      const geo = new THREE.SphereGeometry(1, sW, sH);
      const a = geo.attributes.position;
      const f = (v) => Math.sign(v) * Math.pow(Math.abs(v), p);
      for (let i = 0; i < a.count; i++) {
        a.setXYZ(i, cx + f(a.getX(i)) * hx, cy + f(a.getY(i)) * hy, cz + f(a.getZ(i)) * hz);
      }
      return M.pieza(geo, nombre, sW, sH);
    }

    const rayo = new THREE.Raycaster();
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

    // ---------------- 1. CABEZA Y ROSTRO DE GUERRERA ----------------
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
          x *= 1 - 0.18 * s;                                   // mentón ligeramente más estilizado
          z *= 1 - 0.1 * s;
        }
        x *= 1 + 0.04 * Math.exp(-(((y + 0.4) / 0.25) ** 2));  // mofletes sutiles
        if (z > 0.55) z = 0.55 + (z - 0.55) * 0.65;             // cara plana de frente estilo anime
        if (y < -0.82) y = -0.82 + (y + 0.82) * 0.5;
        a.setXYZ(i, x * CRANEO.rx, CRANEO.y + y * CRANEO.ry, z * CRANEO.rz);
      }
      const malla = M.pieza(geo, 'Cabeza', sW, sH);
      const N = geo.attributes.normal;
      const P = geo.attributes.position;
      const centro = V(0, 0.8, -0.3);
      const n = V(0, 0, 0);
      const d = V(0, 0, 0);
      for (let i = 0; i < N.count; i++) {
        n.fromBufferAttribute(N, i);
        const w = suave(0.15, 0.55, n.z) * (1 - suave(0.82, 0.95, -n.y));
        if (w <= 0) continue;
        d.fromBufferAttribute(P, i).sub(centro).normalize();
        n.lerp(d, w).normalize();
        N.setXYZ(i, n.x, n.y, n.z);
      }
      return malla;
    })();
    poner('Cabeza', cabeza);
    poner('Cuello', M.tubo([[0, 0.72, -0.01], [0, 0.8, -0.005], [0, 0.86, 0]], 0.060, 0.056, { segLargo: 6, segRadio: 28, nombre: 'Cuello' }));

    const deFrente = (x, y) => marco(cabeza, V(x, y, 3), V(0, 0, -1));

    // Ojos anime de Amelia: iris ámbar/dorado, mirada decidida y pestañas afiladas
    LADOS.forEach((s) => {
      const ojo = deFrente(s * 0.104, 0.876);
      if (ojo) {
        const blanco = almendra(0.057, 0.038, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);

        // Iris dorado/ámbar característico de Amelia
        ojo.add(bloque(-s * 0.006, -0.002, 0.0045, 0.029, 0.036, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.006, -0.003, 0.0105, 0.013, 0.019, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.015, 0.013, 0.0135, 0.0085, 0.0085, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(s * 0.004, -0.018, 0.012, 0.0048, 0.0048, 0.0035, 1, 'BrilloOjoPequeno'));

        // Pestañas superiores estilizadas y afiladas hacia el exterior
        ojo.add(M.tubo([
          [-s * 0.062, -0.002, 0.007],
          [-s * 0.038, 0.031, 0.009],
          [0, 0.043, 0.009],
          [s * 0.038, 0.038, 0.009],
          [s * 0.066, 0.018, 0.008],
          [s * 0.082, 0.032, 0.006]
        ], 0.0085, 0.0035, { segLargo: 24, segRadio: 10, nombre: 'Pestanas' }));

        ojo.add(M.tubo([
          [-s * 0.046, -0.028, 0.005],
          [0, -0.037, 0.006],
          [s * 0.048, -0.029, 0.005]
        ], 0.0025, 0.0025, { segLargo: 12, segRadio: 6, nombre: 'ParpadoInferior' }));

        poner('Cabeza', ojo);
      }

      // Cejas doradas algo inclinadas de guerrera
      const ceja = deFrente(s * 0.1, 0.926);
      if (ceja) {
        ceja.add(M.tubo([
          [-s * 0.034, -0.006, 0.007],
          [0, 0.005, 0.009],
          [s * 0.036, -0.002, 0.007]
        ], 0.0095, 0.007, { segLargo: 12, segRadio: 10, nombre: 'Ceja' }));
        poner('Cabeza', ceja);
      }

      // Oreja con pliegue
      const oreja = marco(cabeza, V(s * 1, 0.875, -0.012), V(-s, 0, 0));
      if (oreja) {
        oreja.add(bloque(0, 0, 0.004, 0.026, 0.042, 0.014, 1, 'Oreja'));
        oreja.add(M.tubo([
          [s * -0.006, 0.028, 0.013],
          [s * 0.012, 0.02, 0.015],
          [s * 0.015, 0, 0.015],
          [s * 0.009, -0.021, 0.014],
          [s * -0.004, -0.028, 0.012]
        ], 0.0042, 0.0035, { segLargo: 14, segRadio: 8, nombre: 'PliegueOreja' }));
        poner('Cabeza', oreja);
      }
    });

    // Nariz y boca
    const nariz = deFrente(0, 0.846);
    if (nariz) {
      nariz.add(bloque(0, 0, 0.002, 0.012, 0.010, 0.008, 1, 'Nariz'));
      poner('Cabeza', nariz);
    }
    const boca = deFrente(0, 0.826);
    if (boca) {
      boca.add(M.tubo([
        [-0.020, 0.002, 0.002],
        [0, -0.004, 0.003],
        [0.020, 0.002, 0.002]
      ], 0.003, 0.003, { segLargo: 12, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- 2. CABELLO RUBIO EN CAPAS PUNTIAGUDAS (HOJA DE DISEÑO AMELIA) ----------------
    const PELO = { y: 1.02, z: -0.012, rx: 0.265, ry: 0.235, rz: 0.255 };
    const NACIMIENTO = [
      [0, 0.950], [0.4, 0.942], [0.8, 0.932], [1.2, 0.915],
      [1.57, 0.910], [2.1, 0.875], [2.6, 0.835], [Math.PI, 0.825]
    ];

    function hastaCraneo(o, u) {
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

    // Casco base del pelo
    poner('Cabeza', (() => {
      const C = M.seg(96, 24);
      const NR = M.seg(36, 12);
      const O = V(0, PELO.y, PELO.z);
      const ext = [];
      const int = [];
      for (let i = 0; i <= NR; i++) { ext.push([]); int.push([]); }

      for (let c = 0; c <= C; c++) {
        const fi = -Math.PI + (2 * Math.PI * c) / C;
        const cosB = Math.max(-0.99, Math.min(0.99, (M.interp(NACIMIENTO, Math.abs(fi)) - PELO.y) / PELO.ry));
        let thB = Math.acos(cosB);

        // Ondulación y puntas en la parte posterior
        const picoAtras = Math.pow(Math.max(0, -Math.cos(fi)), 1.5) * Math.sin(fi * 7) ** 2 * 0.08;
        thB += picoAtras;

        for (let i = 0; i <= NR; i++) {
          const th = thB * Math.pow(i / NR, 0.9);
          const u = V(Math.sin(th) * Math.sin(fi), Math.cos(th), Math.sin(th) * Math.cos(fi));
          const pe = V(u.x * PELO.rx, PELO.y + u.y * PELO.ry, PELO.z + u.z * PELO.rz);
          const dir = pe.clone().sub(O).normalize();
          const pi = O.clone().addScaledVector(dir, hastaCraneo(O, dir) + 0.006);
          ext[i].push(pe);
          int[i].push(pi);
        }
      }

      const filas = [...ext, ...int.slice().reverse()];
      const pos = [];
      filas.forEach((fila) => fila.forEach((p) => pos.push(p.x, p.y, p.z)));
      return rejilla(pos, C, filas.length - 1, 'PeloBase');
    })());

    function mechonCurvo(puntos, ancho, grosor, nombre) {
      const curva = M.curva(puntos);
      const L = M.seg(20, 4);
      const C = M.seg(16, 6);
      const P = V(0, 0, 0);
      const T = V(0, 0, 0);
      const pos = [];
      for (let i = 0; i <= L; i++) {
        const t = i / L;
        curva.getPointAt(t, P);
        curva.getTangentAt(t, T);
        const N = P.clone().sub(V(0, 1.0, 0)).normalize();
        N.addScaledVector(T, -N.dot(T)).normalize();
        const B = T.clone().cross(N).normalize();
        const f = Math.pow(1 - t, 0.7) * (0.8 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.5)));
        const a = Math.max(0.001, ancho * 0.5 * f);
        const b = Math.max(0.001, grosor * 0.5 * Math.pow(1 - t, 0.8));
        for (let j = 0; j <= C; j++) {
          const th = (j / C) * Math.PI * 2;
          pos.push(
            P.x + N.x * b * Math.cos(th) + B.x * a * Math.sin(th),
            P.y + N.y * b * Math.cos(th) + B.y * a * Math.sin(th),
            P.z + N.z * b * Math.cos(th) + B.z * a * Math.sin(th)
          );
        }
      }
      return rejilla(pos, C, L, nombre);
    }

    const enPelo = (x, y, d = 0.012) => {
      const e = 1 - (x / PELO.rx) ** 2 - ((y - PELO.y) / PELO.ry) ** 2;
      return V(x, y, PELO.z + PELO.rz * Math.sqrt(Math.max(0, e)) + d);
    };

    // Flequillo abierto al centro característico de Amelia (mechones en V invertida)
    poner('Cabeza', mechonCurvo([enPelo(0.01, 1.15, 0.01), enPelo(-0.06, 1.08, 0.018), enPelo(-0.11, 0.98, 0.016), enPelo(-0.15, 0.92, 0.012)], 0.14, 0.05, 'FlequilloCentroD'));
    poner('Cabeza', mechonCurvo([enPelo(-0.01, 1.15, 0.01), enPelo(0.06, 1.08, 0.018), enPelo(0.11, 0.98, 0.016), enPelo(0.15, 0.92, 0.012)], 0.14, 0.05, 'FlequilloCentroI'));
    poner('Cabeza', mechonCurvo([enPelo(0.0, 1.16, 0.012), enPelo(0.01, 1.07, 0.02), enPelo(0.0, 0.99, 0.014)], 0.08, 0.04, 'MechonFrenteMedio'));

    // Mechones laterales largos que enmarcan la cara hasta el cuello
    poner('Cabeza', mechonCurvo([enPelo(-0.18, 1.09, 0.01), enPelo(-0.24, 1.01, 0.015), enPelo(-0.25, 0.91, 0.014), enPelo(-0.23, 0.82, 0.01)], 0.13, 0.05, 'MechonLateralD'));
    poner('Cabeza', mechonCurvo([enPelo(0.18, 1.09, 0.01), enPelo(0.24, 1.01, 0.015), enPelo(0.25, 0.91, 0.014), enPelo(0.23, 0.82, 0.01)], 0.13, 0.05, 'MechonLateralI'));

    // Mechones puntiagudos superiores y laterales (spikes de Amelia)
    poner('Cabeza', mechonCurvo([V(0.02, 1.23, -0.04), V(0.08, 1.29, -0.05), V(0.14, 1.31, -0.03)], 0.08, 0.035, 'CoronaSpikeArriba'));
    poner('Cabeza', mechonCurvo([V(-0.02, 1.23, -0.04), V(-0.07, 1.28, -0.05), V(-0.12, 1.30, -0.03)], 0.08, 0.035, 'CoronaSpikeArriba2'));
    poner('Cabeza', mechonCurvo([V(0.19, 1.12, -0.08), V(0.27, 1.10, -0.10), V(0.31, 1.05, -0.11)], 0.09, 0.04, 'SpikeLateralI'));
    poner('Cabeza', mechonCurvo([V(-0.19, 1.12, -0.08), V(-0.27, 1.10, -0.10), V(-0.31, 1.05, -0.11)], 0.09, 0.04, 'SpikeLateralD'));
    poner('Cabeza', mechonCurvo([V(0.14, 0.95, -0.22), V(0.18, 0.88, -0.26), V(0.21, 0.82, -0.28)], 0.09, 0.04, 'SpikeNucaI'));
    poner('Cabeza', mechonCurvo([V(-0.14, 0.95, -0.22), V(-0.18, 0.88, -0.26), V(-0.21, 0.82, -0.28)], 0.09, 0.04, 'SpikeNucaD'));

    // ---------------- 3. ARMADURA DE PECHO / CORSETE AZUL CON RIBETES DORADOS ----------------
    // Torso base ajustado de guerrera
    poner('Pecho', M.loft([
      [0.40, 0.160, 0.115],
      [0.50, 0.158, 0.118],
      [0.60, 0.164, 0.122],
      [0.70, 0.174, 0.124],
      [0.74, 0.178, 0.116],
      [0.78, 0.122, 0.092],
      [0.80, 0.068, 0.064]
    ], { segRadio: 56, subdiv: 5, nombre: 'Torso' }));

    // Peto de armadura azul marino cerrado
    poner('Pecho', M.loft([
      [0.44, 0.166, 0.124],
      [0.54, 0.164, 0.126],
      [0.64, 0.172, 0.130],
      [0.70, 0.178, 0.126],
      [0.74, 0.176, 0.118],
      [0.78, 0.130, 0.098]
    ], { segRadio: 64, subdiv: 5, nombre: 'PetoArmadura' }));

    // Cuello alto rígido de la armadura con reborde dorado
    poner('Pecho', M.loft([
      [0.77, 0.092, 0.082],
      [0.81, 0.088, 0.078],
      [0.84, 0.094, 0.082]
    ], { segRadio: 48, subdiv: 4, nombre: 'CuelloAltoArmadura' }));

    // Ribete dorado superior en el cuello alto
    poner('Pecho', M.tubo([
      [-0.088, 0.84, 0.03], [0, 0.84, 0.082], [0.088, 0.84, 0.03],
      [0.075, 0.84, -0.06], [0, 0.84, -0.082], [-0.075, 0.84, -0.06], [-0.088, 0.84, 0.03]
    ], 0.006, 0.006, { segLargo: 24, segRadio: 8, nombre: 'RibeteCuelloOro' }));

    // Ribete dorado decorativo en el contorno del peto
    poner('Pecho', M.tubo([
      [-0.145, 0.73, 0.04], [-0.09, 0.74, 0.09], [0, 0.72, 0.126], [0.09, 0.74, 0.09], [0.145, 0.73, 0.04]
    ], 0.006, 0.006, { segLargo: 18, segRadio: 8, nombre: 'RibetePetoOro' }));

    // ---------------- 4. CINTURONES Y DETALLES DE CINTURA ----------------
    // Cinturón horizontal principal con hebilla
    poner('Cadera', M.tubo([
      [-0.165, 0.48, 0.02], [-0.11, 0.48, 0.11], [0, 0.48, 0.132], [0.11, 0.48, 0.11], [0.165, 0.48, 0.02],
      [0.12, 0.48, -0.11], [0, 0.48, -0.128], [-0.12, 0.48, -0.11], [-0.165, 0.48, 0.02]
    ], 0.013, 0.013, { segLargo: 24, segRadio: 10, nombre: 'CinturonCintura' }));

    // Hebilla dorada rectangular en el centro del cinturón
    poner('Cadera', bloque(0, 0.48, 0.142, 0.024, 0.022, 0.006, 0.3, 'HebillaOro'));

    // Segundo cinturón diagonal cruzado característico de Amelia
    poner('Cadera', M.tubo([
      [-0.17, 0.47, 0.02], [-0.09, 0.45, 0.11], [0.02, 0.43, 0.136], [0.12, 0.41, 0.11], [0.17, 0.40, 0.02],
      [0.13, 0.42, -0.11], [0, 0.44, -0.126], [-0.12, 0.46, -0.11], [-0.17, 0.47, 0.02]
    ], 0.009, 0.009, { segLargo: 24, segRadio: 8, nombre: 'CinturonDiagonal' }));

    // ---------------- 5. FALDÓN DE COMBATE ABIERTO DELANTE CON RIBETES DORADOS ----------------
    // Faldón de combate estilo guerrera con abertura en V frontal
    const FALD_SECC = [
      [0.26, 0.230, 0.175],
      [0.34, 0.210, 0.160],
      [0.42, 0.185, 0.142],
      [0.48, 0.170, 0.130]
    ];
    const FALD_ABERT = [
      [0.26, 0.095],
      [0.34, 0.070],
      [0.42, 0.045],
      [0.48, 0.020]
    ];
    poner('Cadera', loftAbierto(FALD_SECC, FALD_ABERT, { segRadio: 64, subdiv: 5, nombre: 'FaldonCombate' }));

    // Ribetes dorados en los bordes de la abertura delantera del faldón
    LADOS.forEach((s) => {
      poner('Cadera', M.tubo([
        [s * 0.020, 0.48, 0.135],
        [s * 0.045, 0.42, 0.145],
        [s * 0.070, 0.34, 0.165],
        [s * 0.095, 0.26, 0.180]
      ], 0.0055, 0.0055, { segLargo: 12, segRadio: 8, nombre: 'RibeteFaldonOroDel' }));

      // Ribete dorado a lo largo del bajo del faldón
      poner('Cadera', M.tubo([
        [s * 0.095, 0.26, 0.180],
        [s * 0.180, 0.26, 0.110],
        [s * 0.225, 0.26, 0.0],
        [s * 0.160, 0.26, -0.120],
        [s * 0.025, 0.26, -0.170]
      ], 0.0055, 0.0055, { segLargo: 16, segRadio: 8, nombre: 'RibeteFaldonOroBajo' }));
    });

    // Detalle de flecha dorada en la abertura de la espalda
    poner('Cadera', M.tubo([
      [0, 0.38, -0.155], [0, 0.26, -0.172]
    ], 0.006, 0.006, { segLargo: 6, segRadio: 8, nombre: 'FlechaOroEspalda' }));

    // ---------------- 6. BRAZOS, HOMBRERAS Y GUANTELETES (CERRADOS Y JUNTOS AL CUERPO) ----------------
    LADOS.forEach((s) => {
      // Cúpula superior de la hombrera: asienta directamente sobre el hombro cubriendo y cerrando la junta
      const sW = M.seg(20, 8);
      const sH = M.seg(14, 6);
      const hGeo = new THREE.SphereGeometry(0.068, sW, sH, 0, Math.PI * 2, 0, Math.PI * 0.58);
      hGeo.scale(1.15, 0.85, 1.15);
      hGeo.rotateZ(-s * 0.22);
      hGeo.translate(s * 0.170, 0.710, -0.010);
      poner('Brazo' + L(s), M.pieza(hGeo, 'Hombrera', sW, sH));

      // Ribete dorado perimetral en la base de la concha superior
      const bordeGeo = new THREE.TorusGeometry(0.068 * 1.15, 0.0065, 8, 24);
      bordeGeo.rotateX(Math.PI / 2);
      bordeGeo.rotateZ(-s * 0.22);
      bordeGeo.translate(s * 0.170, 0.702, -0.010);
      poner('Brazo' + L(s), M.pieza(bordeGeo, 'RibeteHombreraOro', 8, 24));

      // Segunda placa inferior que abraza el bíceps
      const hBajaGeo = new THREE.CylinderGeometry(0.062, 0.055, 0.038, 20, 2, true, 0, Math.PI * 1.4);
      hBajaGeo.rotateY(s > 0 ? -Math.PI * 0.2 : Math.PI * 0.8);
      hBajaGeo.rotateZ(-s * 0.22);
      hBajaGeo.translate(s * 0.172, 0.672, -0.010);
      poner('Brazo' + L(s), M.pieza(hBajaGeo, 'HombreraBaja', 20, 2));

      // Ribete dorado en la placa inferior
      const bordeBajoGeo = new THREE.TorusGeometry(0.056, 0.0055, 6, 20, Math.PI * 1.4);
      bordeBajoGeo.rotateX(Math.PI / 2);
      bordeBajoGeo.rotateY(s > 0 ? -Math.PI * 0.2 : Math.PI * 0.8);
      bordeBajoGeo.rotateZ(-s * 0.22);
      bordeBajoGeo.translate(s * 0.172, 0.653, -0.010);
      poner('Brazo' + L(s), M.pieza(bordeBajoGeo, 'RibeteHombreraBajaOro', 6, 20));

      // Brazo (piel morena visible en el bíceps, nace dentro del hombro y torso con punta redondeada para cerrar totalmente)
      const radioBrazo = (t) => (t < 0.18 ? 0.050 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.18) ** 2)) : 0.050 - 0.006 * (t - 0.18) / 0.82);
      poner('Brazo' + L(s), M.tubo([
        [s * 0.130, 0.710, -0.010],
        [s * 0.168, 0.690, -0.010],
        [s * 0.178, 0.610, -0.008],
        [s * 0.184, 0.535, -0.004]
      ], 1, 1, { segLargo: 16, segRadio: 24, ruido: (t) => radioBrazo(t), nombre: 'BrazoPiel' }));

      // Guantelete de combate azul marino en el antebrazo (ajustado junto al cuerpo)
      poner('Brazo' + L(s), M.tubo([
        [s * 0.184, 0.540, -0.004],
        [s * 0.188, 0.470, 0.002]
      ], 0.058, 0.052, { segLargo: 10, segRadio: 28, nombre: 'Guantelete' }));

      // Ribetes dorados en el codo y la muñeca del guantelete
      poner('Brazo' + L(s), M.tubo([
        [s * 0.182, 0.542, 0.024], [s * 0.220, 0.540, -0.004], [s * 0.182, 0.542, -0.030]
      ], 0.0055, 0.0055, { segLargo: 8, segRadio: 8, nombre: 'RibeteGuanteleteCodoOro' }));
      poner('Brazo' + L(s), M.tubo([
        [s * 0.186, 0.472, 0.024], [s * 0.222, 0.470, 0.002], [s * 0.186, 0.472, -0.024]
      ], 0.0055, 0.0055, { segLargo: 8, segRadio: 8, nombre: 'RibeteGuanteleteMunecaOro' }));

      // Manos con guantes oscuros de combate juntas junto al faldón
      poner('Mano' + L(s), M.tubo([
        [s * 0.188, 0.470, 0.002],
        [s * 0.190, 0.430, 0.005]
      ], 0.040, 0.040, { segLargo: 6, segRadio: 24, nombre: 'MunecaGuante' }));
      poner('Mano' + L(s), bloque(s * 0.192, 0.400, 0.008, 0.044, 0.048, 0.044, 0.65, 'ManoGuante'));
    });

    // ---------------- 7. PANTALÓN CORTO, PIERNAS Y RODILLERAS ----------------
    // Shorts oscuros bajo el faldón
    poner('Cadera', M.loft([
      [0.26, 0.170, 0.115], [0.32, 0.175, 0.120], [0.38, 0.170, 0.118], [0.44, 0.165, 0.112]
    ], { segRadio: 48, subdiv: 4, nombre: 'ShortsCombate' }));

    LADOS.forEach((s) => {
      // Muslo (piel morena visible entre los shorts y las rodilleras)
      poner('Pierna' + L(s), M.loft([
        [0.17, 0.068, 0.072, s * PIE_X, -0.015],
        [0.24, 0.072, 0.076, s * PIE_X, -0.015],
        [0.31, 0.078, 0.082, s * PIE_X, -0.012]
      ], { segRadio: 36, subdiv: 5, nombre: 'PiernaMuslo' }));

      // Rodilleras blindadas con ribete dorado
      const rodillera = bloque(s * PIE_X, 0.175, 0.055, 0.048, 0.038, 0.024, 0.6, 'Rodillera');
      poner('Pierna' + L(s), rodillera);

      const bordeRodillera = M.tubo([
        [s * PIE_X - 0.045, 0.175, 0.035],
        [s * PIE_X, 0.200, 0.075],
        [s * PIE_X + 0.045, 0.175, 0.035]
      ], 0.0055, 0.0055, { segLargo: 10, segRadio: 8, nombre: 'RibeteRodilleraOro' });
      poner('Pierna' + L(s), bordeRodillera);
    });

    // ---------------- 8. BOTAS DE COMBATE CON TOBILLERAS AZULES Y ORO ----------------
    const BOTA = [
      [-0.115, 0, 0, 0, -0.095],
      [-0.100, 0.060, 0.082, 0, -0.095],
      [-0.060, 0.082, 0.096, 0, -0.100],
      [0.0,    0.086, 0.096, 0, -0.100],
      [0.060,  0.090, 0.086, 0, -0.090],
      [0.120,  0.086, 0.072, 0, -0.077],
      [0.160,  0.068, 0.058, 0, -0.068],
      [0.182,  0.030, 0.032, 0, -0.065],
      [0.190,  0, 0, 0, -0.065]
    ];
    const SUELA_BOTA = BOTA.map(([l, rx]) => [l * 1.03, rx < 0.01 ? 0 : rx + 0.008, rx < 0.01 ? 0 : 0.018, 0, -0.014]);

    LADOS.forEach((s) => {
      // Pierna inferior / caña de la bota
      poner('Pierna' + L(s), M.loft([
        [0.08, 0.064, 0.068, s * PIE_X, -0.018],
        [0.14, 0.066, 0.070, s * PIE_X, -0.018]
      ], { segRadio: 32, subdiv: 3, nombre: 'CanaBota' }));

      // Cuello dorado superior de la bota
      poner('Pierna' + L(s), M.tubo([
        [s * PIE_X - 0.058, 0.145, -0.018], [s * PIE_X, 0.145, 0.045], [s * PIE_X + 0.058, 0.145, -0.018],
        [s * PIE_X, 0.145, -0.075], [s * PIE_X - 0.058, 0.145, -0.018]
      ], 0.006, 0.006, { segLargo: 16, segRadio: 8, nombre: 'BordeBotaOro' }));

      // Pie y suela
      [[BOTA, 'BotaPie'], [SUELA_BOTA, 'SuelaBota']].forEach(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(s * PIE_X, 0, -0.02);
        poner('Pie' + L(s), m);
      });

      // Tobillera azul envolvente
      const tobillera = M.tubo([
        [s * PIE_X - 0.062, 0.048, -0.02], [s * PIE_X, 0.048, 0.048], [s * PIE_X + 0.062, 0.048, -0.02]
      ], 0.012, 0.012, { segLargo: 12, segRadio: 8, nombre: 'TobilleraAzul' });
      poner('Pie' + L(s), tobillera);
    });

    // ---------------- 9. ESQUELETO (COMPATIBLE CON ALVIN) ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['Cadera', 'Raiz', 0, 0.31, -0.015],
      ['Pecho', 'Cadera', 0, 0.42, -0.012],
      ['Cuello', 'Pecho', 0, 0.78, -0.008],
      ['Cabeza', 'Cuello', 0, 0.85, -0.004],
      ...LADOS.flatMap((s) => [
        ['Brazo' + L(s), 'Pecho', s * 0.168, 0.700, -0.010],
        ['Mano' + L(s), 'Brazo' + L(s), s * 0.188, 0.470, 0.002],
        ['Pierna' + L(s), 'Cadera', s * PIE_X, 0.30, -0.015],
        ['Pie' + L(s), 'Pierna' + L(s), s * PIE_X, 0.13, -0.020]
      ])
    ];

    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = 'Hueso' + nombre;
      b.userData.reposo = [x, y, z];
      const p = padre ? hueso[padre] : null;
      b.position.set(
        x - (p ? p.userData.reposo[0] : 0),
        y - (p ? p.userData.reposo[1] : 0),
        z - (p ? p.userData.reposo[2] : 0)
      );
      (p || g).add(b);
      hueso[nombre] = b;
    });

    g.updateMatrixWorld(true);
    Object.keys(PARTES).forEach((nombre) => {
      if (hueso[nombre]) {
        PARTES[nombre].forEach((pieza) => hueso[nombre].attach(pieza));
      }
    });

    // ---------------- 10. MATERIALES Y PALETA DE COLORES (AMELIA) ----------------
    const COLOR = {
      piel: 0x8a624c,
      pielSombra: 0x6a4538,
      pelo: 0xcda852,
      peloClaro: 0xd8b45e,
      peloBrillo: 0xe8c76a,
      ceja: 0xb8884c,
      ojo: 0xf7f4f2,
      iris: 0xd9822b,
      pupila: 0x241710,
      brillo: 0xffffff,
      pestanas: 0x221513,
      labio: 0x5c372e,
      azulArmadura: 0x2b3859,
      azulOscuro: 0x1f2840,
      oro: 0xd4a843,
      oroOscuro: 0x8f6e28,
      cueroNegro: 0x23262e,
      shorts: 0x262a33,
      botas: 0x222630,
      suela: 0x181a20
    };

    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', BrazoPiel: 'piel', PiernaMuslo: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      PeloBase: 'pelo', FlequilloCentroD: 'peloClaro', FlequilloCentroI: 'peloClaro', MechonFrenteMedio: 'peloClaro',
      MechonLateralD: 'pelo', MechonLateralI: 'pelo', CoronaSpikeArriba: 'peloBrillo', CoronaSpikeArriba2: 'peloBrillo',
      SpikeLateralI: 'pelo', SpikeLateralD: 'pelo', SpikeNucaI: 'pelo', SpikeNucaD: 'pelo',
      Torso: 'azulOscuro', PetoArmadura: 'azulArmadura', CuelloAltoArmadura: 'azulArmadura', Hombrera: 'azulArmadura', HombreraBaja: 'azulArmadura',
      Guantelete: 'azulArmadura', FaldonCombate: 'azulArmadura', Rodillera: 'azulArmadura', TobilleraAzul: 'azulArmadura',
      RibeteCuelloOro: 'oro', RibetePetoOro: 'oro', RibeteHombreraOro: 'oro', RibeteHombreraBajaOro: 'oro', RibeteGuanteleteCodoOro: 'oro', RibeteGuanteleteMunecaOro: 'oro',
      HebillaOro: 'oro', RibeteFaldonOroDel: 'oro', RibeteFaldonOroBajo: 'oro', FlechaOroEspalda: 'oro',
      RibeteRodilleraOro: 'oro', BordeBotaOro: 'oro',
      CinturonCintura: 'cueroNegro', CinturonDiagonal: 'cueroNegro', MunecaGuante: 'cueroNegro', ManoGuante: 'cueroNegro',
      ShortsCombate: 'shorts', CanaBota: 'botas', BotaPie: 'botas', SuelaBota: 'suela'
    };

    const materiales = {};
    function material(clave) {
      if (!materiales[clave]) {
        const esOro = clave === 'oro' || clave === 'oroOscuro' || clave === 'oroBrillo';
        const m = esOro
          ? new THREE.MeshPhongMaterial({
              color: COLOR[clave],
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1,
              specular: 0x5a4820,
              shininess: 38
            })
          : clayMaterial.clone();

        if (!esOro) {
          m.color.setHex(COLOR[clave] || 0xe2e6ec);
        }
        materiales[clave] = m;
      }
      return materiales[clave];
    }

    g.traverse((o) => {
      if (!o.isMesh) return;
      const clave = PINTURA[o.name];
      if (clave) {
        o.material = material(clave);
      }
      applyRenderStyleToMesh(o);
    });

    // ---------------- 11. ANIMACIONES DE GUERRERA ----------------
    const grados = Math.PI / 180;
    const q = new THREE.Quaternion();
    const eu = new THREE.Euler();

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

    function sube(nombre, dur, fn, n = 24) {
      const [x, y, z] = hueso[nombre].position.toArray();
      const tiempos = [];
      const valores = [];
      for (let i = 0; i <= n; i++) {
        tiempos.push((i / n) * dur);
        valores.push(x, y + fn(i / n), z);
      }
      return new THREE.VectorKeyframeTrack(`Hueso${nombre}.position`, tiempos, valores);
    }

    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Reposo: postura decidida con respiración y leve cabeceo
    const dR = 2.4;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('Pecho', dR, (t) => [-1.4 * sen(t), 0, 0]),
      giro('Cabeza', dR, (t) => [1.8 * sen(t), 0, 1.2 * sen(t)]),
      ...LADOS.map((s) => giro('Brazo' + L(s), dR, (t) => [2, 0, s * (2 + 1.5 * (1 - cos(t)) / 2)]))
    ]);

    // Caminar: marcha firme y marcial
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
        giro('Brazo' + L(s), dC, (t) => [s * -0.9 * PASO * sen(t), 0, s * 2.5]),
        giro('Mano' + L(s), dC, (t) => [s * -8 * sen(t), 0, 0])
      ])
    ]);

    // Celebrar: pose de victoria de guerrera
    const dF = 1.6;
    const alzar = [[0, 0], [0.18, 92], [0.35, 92], [0.55, 128], [0.75, 128], [1, 0]];
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

