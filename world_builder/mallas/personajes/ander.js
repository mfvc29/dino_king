/**
 * Ander — personaje chico demonio chibi hecho a partir de su hoja de diseño oficial:
 * assets/personajes 3d/ander.jpeg (vistas frente, perfil, espalda, expresiones y detalles).
 *
 * Estilo chibi en escala con Alvin y Amelia (altura ~1,30 m):
 *   - Cabeza grande y expresiva (~40 % de la altura), ojos ámbar con mirada confiada
 *   - Pelo blanco/plateado desgreñado y puntiagudo en capas anime
 *   - Dos cuernos de demonio curvados hacia arriba y atrás en la coronilla/sienes
 *   - Polo rojo de manga corta con cuello blanco doblado y tapeta en V
 *   - Brazos con guantes tácticos negros sin dedos (fingerless) y muñequeras con correa
 *   - Alas de demonio / murciélago oscuras que nacen de los omóplatos en la espalda
 *   - Pantalón cargo gris oscuro holgado con cinturón, hebilla y bolsillos laterales con solapa
 *   - Botas de combate tácticas negras con suela gruesa y cordones
 *
 * Esqueleto (THREE.Bone, 13 huesos estándar):
 *   HuesoRaiz → HuesoCadera → HuesoPecho → HuesoCuello → HuesoCabeza,
 *   HuesoBrazoI/D → HuesoManoI/D y HuesoPiernaI/D → HuesoPieI/D.
 * Animaciones: 'Reposo', 'Caminar' y 'Celebrar'.
 */
registrarMalla({
  id: 'ander',
  categoria: 'personajes',
  nombre: 'Ander (chico demonio chibi)',
  icono: '😈',
  origen: 'assets/personajes 3d/ander.jpeg',

  construir(M) {
    const g = new THREE.Group();
    const LADOS = [-1, 1];
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const L = (s) => (s > 0 ? 'I' : 'D');           // lado: izquierdo (+X) / derecho (−X)
    const PIE_X = 0.118;                             // separación de piernas y botas desde el centro

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

    function bloque(cx, cy, cz, hx, hy, hz, p, nombre) {
      const sW = M.seg(24, 8);
      const sH = M.seg(18, 6);
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
      const sW = M.seg(26, 10);
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

    // ---------------- 1. CABEZA Y ROSTRO DE ANDER ----------------
    const CRANEO = { x: 0, y: 1.0, z: 0, rx: 0.236, ry: 0.210, rz: 0.218 };
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
          x *= 1 - 0.20 * s;                                   // mandíbula masculina estilizada
          z *= 1 - 0.12 * s;
        }
        x *= 1 + 0.035 * Math.exp(-(((y + 0.38) / 0.25) ** 2)); // pómulos chibi
        if (z > 0.54) z = 0.54 + (z - 0.54) * 0.65;             // frente plana anime
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

    // Cuello
    poner('Cuello', M.tubo([[0, 0.73, -0.01], [0, 0.81, -0.005], [0, 0.86, 0]], 0.062, 0.058, { segLargo: 6, segRadio: 28, nombre: 'Cuello' }));

    // Colgante con cordón negro fino en el cuello
    poner('Cuello', M.tubo([
      [-0.046, 0.815, 0.042], [0, 0.772, 0.064], [0.046, 0.815, 0.042]
    ], 0.0035, 0.0035, { segLargo: 8, segRadio: 8, nombre: 'CordonCuello' }));
    poner('Cuello', bloque(0, 0.768, 0.068, 0.0065, 0.009, 0.004, 0.4, 'Colgante'));

    const deFrente = (x, y) => marco(cabeza, V(x, y, 3), V(0, 0, -1));

    // Ojos anime de Ander: ámbar / avellana, mirada pícara y cejas decididas
    LADOS.forEach((s) => {
      const ojo = deFrente(s * 0.103, 0.878);
      if (ojo) {
        const blanco = almendra(0.056, 0.038, 0.012, 'Ojo');
        blanco.position.z = -0.005;
        ojo.add(blanco);

        // Iris ámbar / marrón cálido
        ojo.add(bloque(-s * 0.005, -0.002, 0.0045, 0.028, 0.035, 0.009, 1, 'Iris'));
        ojo.add(bloque(-s * 0.005, -0.003, 0.0105, 0.013, 0.018, 0.006, 1, 'Pupila'));
        ojo.add(bloque(-s * 0.014, 0.013, 0.0135, 0.008, 0.008, 0.0055, 1, 'BrilloOjo'));
        ojo.add(bloque(s * 0.004, -0.017, 0.012, 0.0045, 0.0045, 0.0035, 1, 'BrilloOjoPequeno'));

        // Pestañas anime superiores
        ojo.add(M.tubo([
          [-s * 0.052, -0.004, 0.006],
          [-s * 0.028, 0.037, 0.007],
          [s * 0.024, 0.039, 0.007],
          [s * 0.056, 0.018, 0.007],
          [s * 0.068, 0.028, 0.007]
        ], 0.0045, 0.003, { segLargo: 12, segRadio: 8, nombre: 'Pestanas' }));

        // Ceja blanca/plateada ligeramente inclinada (expresión confiada)
        ojo.add(M.tubo([
          [-s * 0.046, 0.056, 0.006],
          [s * 0.005, 0.066, 0.007],
          [s * 0.060, 0.050, 0.007]
        ], 0.0055, 0.0035, { segLargo: 8, segRadio: 8, nombre: 'Ceja' }));

        poner('Cabeza', ojo);
      }

      // Orejas
      const oreja = marco(cabeza, V(s * 0.32, 0.90, -0.02), V(-s, 0, 0));
      if (oreja) {
        oreja.add(bloque(0, 0, 0, 0.022, 0.038, 0.044, 0.45, 'Oreja'));
        oreja.add(bloque(s * 0.004, -0.002, 0.005, 0.012, 0.024, 0.028, 0.6, 'PliegueOreja'));
        poner('Cabeza', oreja);
      }
    });

    // Nariz y boca confiada / sonrisa de Ander
    const nariz = deFrente(0, 0.865);
    if (nariz) {
      nariz.add(bloque(0, 0, 0.004, 0.008, 0.009, 0.012, 0.35, 'Nariz'));
      poner('Cabeza', nariz);
    }
    const boca = deFrente(0, 0.824);
    if (boca) {
      boca.add(M.tubo([
        [-0.018, 0.004, 0.002],
        [0.002, -0.003, 0.003],
        [0.022, 0.006, 0.003]
      ], 0.0032, 0.0032, { segLargo: 10, segRadio: 8, nombre: 'Boca' }));
      poner('Cabeza', boca);
    }

    // ---------------- 2. CUERNOS DE DEMONIO CURVADOS (CARACTERÍSTICA PRINCIPAL) ----------------
    LADOS.forEach((s) => {
      // Cuerno curvado hacia arriba, hacia afuera y barriendo hacia atrás
      const curvaCuerno = [
        [s * 0.118, 1.12, 0.082],   // base en la sien/coronilla
        [s * 0.134, 1.17, 0.076],   // sube abriéndose
        [s * 0.150, 1.23, 0.048],   // curva hacia atrás
        [s * 0.162, 1.29, 0.012],   // curva superior
        [s * 0.168, 1.33, -0.024]   // punta afilada demoníaca
      ];
      // Tubo con textura de anillos/crestas demoníacas
      const ruidoCuerno = (t) => 1.0 + 0.07 * Math.sin(t * Math.PI * 12);
      poner('Cabeza', M.tubo(curvaCuerno, 0.028, 0.004, {
        segLargo: 20, segRadio: 16, ruido: (t) => ruidoCuerno(t), nombre: 'CuernoDemonio'
      }));

      // Anillo decorativo en la base del cuerno
      poner('Cabeza', M.tubo([
        [s * 0.100, 1.125, 0.092], [s * 0.126, 1.122, 0.096], [s * 0.138, 1.120, 0.072],
        [s * 0.122, 1.123, 0.068], [s * 0.100, 1.125, 0.092]
      ], 0.005, 0.005, { segLargo: 12, segRadio: 8, nombre: 'BaseCuerno' }));
    });

    // ---------------- 3. CABELLO BLANCO / PLATEADO EN CAPAS PUNTIAGUDAS (SPARKS ANIME) ----------------
    const PELO = { y: 1.02, z: -0.012, rx: 0.266, ry: 0.238, rz: 0.256 };
    const NACIMIENTO = [
      [0, 0.952], [0.4, 0.942], [0.8, 0.932], [1.2, 0.916],
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

    // Casco base del pelo blanco
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

        // Ondulación y picos traseros
        const picoAtras = Math.pow(Math.max(0, -Math.cos(fi)), 1.5) * Math.sin(fi * 8) ** 2 * 0.085;
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
      const L = M.seg(18, 4);
      const C = M.seg(14, 6);
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

    // Flequillo puntiagudo y despeinado al frente (fiel a la hoja de diseño)
    poner('Cabeza', mechonCurvo([enPelo(0.0, 1.15, 0.01), enPelo(-0.04, 1.07, 0.018), enPelo(-0.07, 0.98, 0.016), enPelo(-0.08, 0.92, 0.012)], 0.12, 0.05, 'FlequilloCentroD'));
    poner('Cabeza', mechonCurvo([enPelo(0.02, 1.15, 0.01), enPelo(0.05, 1.07, 0.018), enPelo(0.07, 0.99, 0.016), enPelo(0.09, 0.93, 0.012)], 0.12, 0.05, 'FlequilloCentroI'));
    poner('Cabeza', mechonCurvo([enPelo(-0.08, 1.14, 0.01), enPelo(-0.13, 1.06, 0.016), enPelo(-0.16, 0.97, 0.014)], 0.11, 0.045, 'MechonFrenteD'));
    poner('Cabeza', mechonCurvo([enPelo(0.08, 1.14, 0.01), enPelo(0.13, 1.06, 0.016), enPelo(0.16, 0.97, 0.014)], 0.11, 0.045, 'MechonFrenteI'));

    // Mechones laterales y patillas frente a las orejas
    poner('Cabeza', mechonCurvo([enPelo(-0.19, 1.09, 0.01), enPelo(-0.25, 1.00, 0.015), enPelo(-0.26, 0.91, 0.014), enPelo(-0.24, 0.83, 0.01)], 0.13, 0.05, 'MechonLateralD'));
    poner('Cabeza', mechonCurvo([enPelo(0.19, 1.09, 0.01), enPelo(0.25, 1.00, 0.015), enPelo(0.26, 0.91, 0.014), enPelo(0.24, 0.83, 0.01)], 0.13, 0.05, 'MechonLateralI'));

    // Puntas rebeldes en la coronilla (spikes de pelo blanco alrededor de los cuernos)
    poner('Cabeza', mechonCurvo([V(0.04, 1.23, -0.03), V(0.09, 1.28, -0.05), V(0.14, 1.30, -0.04)], 0.08, 0.035, 'SpikeCorona1'));
    poner('Cabeza', mechonCurvo([V(-0.04, 1.23, -0.03), V(-0.09, 1.28, -0.05), V(-0.13, 1.29, -0.04)], 0.08, 0.035, 'SpikeCorona2'));
    poner('Cabeza', mechonCurvo([V(0.0, 1.24, -0.05), V(0.01, 1.30, -0.07), V(0.02, 1.33, -0.06)], 0.075, 0.035, 'SpikeCoronaCentro'));
    poner('Cabeza', mechonCurvo([V(0.20, 1.13, -0.08), V(0.28, 1.11, -0.10), V(0.32, 1.06, -0.11)], 0.09, 0.04, 'SpikeLateralI'));
    poner('Cabeza', mechonCurvo([V(-0.20, 1.13, -0.08), V(-0.28, 1.11, -0.10), V(-0.32, 1.06, -0.11)], 0.09, 0.04, 'SpikeLateralD'));
    poner('Cabeza', mechonCurvo([V(0.15, 0.95, -0.22), V(0.19, 0.88, -0.26), V(0.22, 0.82, -0.28)], 0.09, 0.04, 'SpikeNucaI'));
    poner('Cabeza', mechonCurvo([V(-0.15, 0.95, -0.22), V(-0.18, 0.88, -0.26), V(-0.22, 0.82, -0.28)], 0.09, 0.04, 'SpikeNucaD'));

    // ---------------- 4. POLO ROJO CON CUELLO BLANCO EN V ----------------
    // Torso con polo rojo ajustado casual
    poner('Pecho', M.loft([
      [0.44, 0.170, 0.118],
      [0.54, 0.166, 0.122],
      [0.64, 0.174, 0.126],
      [0.72, 0.176, 0.124],
      [0.76, 0.144, 0.106],
      [0.79, 0.096, 0.082]
    ], { segRadio: 56, subdiv: 5, nombre: 'PoloRojo' }));

    // Cuello doblado blanco de polo con solapas triangulares y abertura en V
    poner('Pecho', M.tubo([
      [-0.078, 0.778, 0.045],
      [-0.045, 0.765, 0.102],
      [-0.016, 0.725, 0.126],
      [0.0,    0.718, 0.128],
      [0.016,  0.725, 0.126],
      [0.045,  0.765, 0.102],
      [0.078,  0.778, 0.045]
    ], 0.009, 0.009, { segLargo: 18, segRadio: 10, nombre: 'CuelloPoloBlanco' }));

    // Solapas de cuello de polo blanco
    LADOS.forEach((s) => {
      poner('Pecho', M.tubo([
        [s * 0.014, 0.725, 0.128],
        [s * 0.042, 0.755, 0.122],
        [s * 0.065, 0.768, 0.092]
      ], 0.011, 0.006, { segLargo: 8, segRadio: 8, nombre: 'SolapaPoloBlanco' }));
    });

    // Pequeño botón blanco en la tapeta
    poner('Pecho', bloque(0, 0.708, 0.130, 0.004, 0.004, 0.003, 0.3, 'BotonPoloBlanco'));

    // Dobladillo inferior del polo sobre el pantalón
    poner('Pecho', M.tubo([
      [-0.172, 0.448, 0.02], [-0.115, 0.448, 0.115], [0, 0.448, 0.126], [0.115, 0.448, 0.115], [0.172, 0.448, 0.02],
      [0.122, 0.448, -0.115], [0, 0.448, -0.125], [-0.122, 0.448, -0.115], [-0.172, 0.448, 0.02]
    ], 0.008, 0.008, { segLargo: 24, segRadio: 8, nombre: 'BajoPoloRojo' }));

    // ---------------- 5. ALAS DE DEMONIO / MURCIÉLAGO (ATTACHED TO PECHO) ----------------
    // Alas oscuras estilo murciélago que nacen de los omóplatos
    LADOS.forEach((s) => {
      // 1. Estructura ósea principal del ala:
      // Nace en la espalda cerca del omóplato, sube hasta la articulación/codo superior con garra y baja
      const raizAla = [s * 0.075, 0.710, -0.115];
      const codoAla = [s * 0.280, 0.875, -0.165];
      const alaMedia = [s * 0.360, 0.720, -0.185];
      const puntaAla = [s * 0.420, 0.480, -0.205];

      // Hueso principal superior
      poner('Pecho', M.tubo([
        raizAla,
        [s * 0.170, 0.780, -0.140],
        codoAla
      ], 0.016, 0.012, { segLargo: 12, segRadio: 10, nombre: 'HuesoAlaSuperior' }));

      // Garra / espolón superior en el codo del ala
      poner('Pecho', M.tubo([
        codoAla,
        [s * 0.295, 0.925, -0.160]
      ], 0.011, 0.002, { segLargo: 6, segRadio: 8, nombre: 'GarraAla' }));

      // Brazo exterior del ala que baja
      poner('Pecho', M.tubo([
        codoAla,
        alaMedia,
        puntaAla
      ], 0.012, 0.007, { segLargo: 14, segRadio: 8, nombre: 'HuesoAlaExterior' }));

      // Dedos/nervaduras óseas secundarias del ala
      const costilla1 = [
        codoAla,
        [s * 0.290, 0.650, -0.180],
        [s * 0.320, 0.420, -0.190]
      ];
      const costilla2 = [
        [s * 0.170, 0.780, -0.140],
        [s * 0.200, 0.580, -0.165],
        [s * 0.220, 0.380, -0.175]
      ];
      poner('Pecho', M.tubo(costilla1, 0.009, 0.004, { segLargo: 10, segRadio: 6, nombre: 'NervaduraAla1' }));
      poner('Pecho', M.tubo(costilla2, 0.009, 0.004, { segLargo: 10, segRadio: 6, nombre: 'NervaduraAla2' }));

      // Membrana del ala de murciélago: lona membranosa con cortes festoneados
      // Se genera como una malla delgada entre las costillas del ala
      const colsAla = 12;
      const rowsAla = 16;
      const posMembrana = [];
      for (let r = 0; r <= rowsAla; r++) {
        const v = r / rowsAla;
        for (let c = 0; c <= colsAla; c++) {
          const u = c / colsAla;
          // Interpolación bilineal entre el hueso superior y el borde festoneado inferior
          const pTopX = raizAla[0] + (codoAla[0] - raizAla[0]) * Math.min(1, u * 1.4);
          const pTopY = raizAla[1] + (codoAla[1] - raizAla[1]) * Math.min(1, u * 1.4);
          const pTopZ = raizAla[2] + (codoAla[2] - raizAla[2]) * Math.min(1, u * 1.4);

          const pBotX = s * (0.09 + u * 0.33);
          // 3 arcos festoneados cóncavos en el bajo del ala
          const ondaFestoneada = Math.sin(u * Math.PI * 3);
          const pBotY = 0.36 + (1 - u) * 0.24 - Math.max(0, ondaFestoneada) * 0.055;
          const pBotZ = -0.12 - u * 0.085;

          const px = pTopX + (pBotX - pTopX) * v;
          const py = pTopY + (pBotY - pTopY) * v;
          const pz = pTopZ + (pBotZ - pTopZ) * v;
          posMembrana.push(px, py, pz);
        }
      }
      poner('Pecho', rejilla(posMembrana, colsAla, rowsAla, 'MembranaAla'));
    });

    // ---------------- 6. BRAZOS, MANGAS Y GUANTES TÁCTICOS SIN DEDOS ----------------
    LADOS.forEach((s) => {
      // Manga corta del polo rojo que cubre el hombro y la parte alta del bíceps
      const radioManga = (t) => (t < 0.20 ? 0.062 * Math.sqrt(Math.max(0, 1 - (1 - t / 0.20) ** 2)) : 0.062);
      poner('Brazo' + L(s), M.tubo([
        [s * 0.128, 0.710, -0.010],
        [s * 0.168, 0.690, -0.010],
        [s * 0.176, 0.625, -0.008]
      ], 1, 1, { segLargo: 12, segRadio: 24, ruido: (t) => radioManga(t), nombre: 'MangaPolo' }));

      // Remate / dobladillo de la manga corta
      poner('Brazo' + L(s), M.tubo([
        [s * 0.140, 0.622, 0.038], [s * 0.212, 0.622, -0.008], [s * 0.140, 0.622, -0.046]
      ], 0.006, 0.006, { segLargo: 10, segRadio: 8, nombre: 'RibeteManga' }));

      // Brazo (piel clara en el bíceps y antebrazo hasta la muñequera)
      poner('Brazo' + L(s), M.tubo([
        [s * 0.174, 0.630, -0.008],
        [s * 0.182, 0.550, -0.004],
        [s * 0.188, 0.485, 0.002]
      ], 0.048, 0.042, { segLargo: 12, segRadio: 24, nombre: 'BrazoPiel' }));

      // Guante táctico sin dedos (fingerless combat glove):
      // Muñequera táctica negra
      poner('Mano' + L(s), M.tubo([
        [s * 0.188, 0.488, 0.002],
        [s * 0.190, 0.450, 0.005]
      ], 0.048, 0.046, { segLargo: 6, segRadio: 24, nombre: 'MunequeraGuante' }));

      // Correa gris con hebilla en la muñeca
      poner('Mano' + L(s), M.tubo([
        [s * 0.155, 0.468, 0.024], [s * 0.224, 0.468, 0.005], [s * 0.155, 0.468, -0.024]
      ], 0.005, 0.005, { segLargo: 8, segRadio: 8, nombre: 'CorreaGuante' }));
      poner('Mano' + L(s), bloque(s * 0.225, 0.468, 0.005, 0.005, 0.008, 0.008, 0.3, 'HebillaGuante'));

      // Cuerpo del guante negro (cubre palma y dorso de la mano)
      poner('Mano' + L(s), bloque(s * 0.192, 0.422, 0.008, 0.044, 0.038, 0.044, 0.65, 'ManoGuante'));

      // Falanges / puntas de los dedos descubiertos (piel visible)
      poner('Mano' + L(s), bloque(s * 0.192, 0.392, 0.008, 0.038, 0.022, 0.038, 0.7, 'DedosPiel'));
    });

    // ---------------- 7. PANTALÓN CARGO GRIS OSCURO CON BOLSILLOS ----------------
    // Cinturón negro con hebilla metálica rectangular
    poner('Cadera', M.tubo([
      [-0.170, 0.435, 0.02], [-0.115, 0.435, 0.115], [0, 0.435, 0.126], [0.115, 0.435, 0.115], [0.170, 0.435, 0.02],
      [0.120, 0.435, -0.115], [0, 0.435, -0.125], [-0.120, 0.435, -0.115], [-0.170, 0.435, 0.02]
    ], 0.010, 0.010, { segLargo: 24, segRadio: 10, nombre: 'Cinturon' }));
    poner('Cadera', bloque(0, 0.435, 0.134, 0.022, 0.016, 0.006, 0.3, 'HebillaCinturon'));

    // Cadera del pantalón cargo
    poner('Cadera', M.loft([
      [0.28, 0.185, 0.132],
      [0.36, 0.192, 0.138],
      [0.43, 0.172, 0.126]
    ], { segRadio: 56, subdiv: 4, nombre: 'PantalonCargo' }));

    LADOS.forEach((s) => {
      // Piernas holgadas con arrugas de tela cargo
      poner('Pierna' + L(s), M.loft([
        [0.13, 0.078, 0.082, s * PIE_X, -0.018],
        [0.20, 0.084, 0.088, s * PIE_X, -0.016],
        [0.28, 0.082, 0.086, s * PIE_X, -0.014],
        [0.34, 0.086, 0.090, s * PIE_X, -0.012]
      ], { segRadio: 36, subdiv: 5, nombre: 'PantalonCargo' }));

      // Bolsillo cargo tridimensional en el lateral exterior del muslo
      const posX = s * (PIE_X + 0.076);
      const posY = 0.280;
      const posZ = -0.015;
      poner('Pierna' + L(s), bloque(posX, posY, posZ, 0.016, 0.046, 0.044, 0.35, 'BolsilloCargo'));
      // Solapa superior del bolsillo cargo
      poner('Pierna' + L(s), bloque(posX + s * 0.003, posY + 0.040, posZ, 0.018, 0.014, 0.046, 0.3, 'TapaBolsilloCargo'));
      // Tira vertical y hebilla colgante del bolsillo
      poner('Pierna' + L(s), bloque(posX + s * 0.008, posY - 0.010, posZ, 0.004, 0.038, 0.008, 0.2, 'TiraBolsilloCargo'));

      // Dobladillo elástico / puño del pantalón recogido sobre la bota
      poner('Pierna' + L(s), M.tubo([
        [s * PIE_X - 0.066, 0.128, -0.018], [s * PIE_X, 0.128, 0.052], [s * PIE_X + 0.066, 0.128, -0.018],
        [s * PIE_X, 0.128, -0.080], [s * PIE_X - 0.066, 0.128, -0.018]
      ], 0.012, 0.012, { segLargo: 16, segRadio: 8, nombre: 'PunoPantalonCargo' }));
    });

    // ---------------- 8. BOTAS DE COMBATE TÁCTICAS NEGRAS ----------------
    const BOTA = [
      [-0.118, 0, 0, 0, -0.095],
      [-0.104, 0.062, 0.084, 0, -0.095],
      [-0.062, 0.084, 0.098, 0, -0.100],
      [0.0,    0.088, 0.098, 0, -0.100],
      [0.060,  0.092, 0.088, 0, -0.090],
      [0.120,  0.088, 0.074, 0, -0.077],
      [0.160,  0.070, 0.060, 0, -0.068],
      [0.184,  0.032, 0.034, 0, -0.065],
      [0.192,  0, 0, 0, -0.065]
    ];
    const SUELA_BOTA = BOTA.map(([l, rx]) => [l * 1.04, rx < 0.01 ? 0 : rx + 0.009, rx < 0.01 ? 0 : 0.020, 0, -0.014]);

    LADOS.forEach((s) => {
      // Caña alta de la bota táctica
      poner('Pierna' + L(s), M.loft([
        [0.07, 0.068, 0.072, s * PIE_X, -0.018],
        [0.13, 0.070, 0.074, s * PIE_X, -0.018]
      ], { segRadio: 32, subdiv: 3, nombre: 'CanaBota' }));

      // Lengüeta y cordones de combate cruzados al frente
      poner('Pierna' + L(s), M.tubo([
        [s * PIE_X, 0.075, 0.052], [s * PIE_X, 0.135, 0.046]
      ], 0.014, 0.014, { segLargo: 6, segRadio: 8, nombre: 'LenguetaBota' }));

      poner('Pierna' + L(s), M.tubo([
        [s * PIE_X - 0.024, 0.085, 0.054], [s * PIE_X + 0.024, 0.095, 0.054],
        [s * PIE_X - 0.024, 0.108, 0.052], [s * PIE_X + 0.024, 0.118, 0.052]
      ], 0.004, 0.004, { segLargo: 8, segRadio: 6, nombre: 'CordonesBota' }));

      // Pie y suela táctica gruesa
      [[BOTA, 'BotaCombate'], [SUELA_BOTA, 'SuelaBota']].forEach(([tabla, nombre]) => {
        const m = M.loft(tabla, { segRadio: 44, subdiv: 4, nombre });
        m.rotation.x = Math.PI / 2;
        m.position.set(s * PIE_X, 0, -0.02);
        poner('Pie' + L(s), m);
      });
    });

    // ---------------- 9. ESQUELETO (ESTÁNDAR COMPATIBLE) ----------------
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

    // ---------------- 10. MATERIALES Y PALETA DE COLORES (ANDER) ----------------
    const COLOR = {
      piel: 0xf5cca8,
      pielSombra: 0xd9a482,
      peloBlanco: 0xf4f6fa,
      peloClaro: 0xffffff,
      peloSombra: 0xdce0e8,
      cuerno: 0x1e1c24,
      cuernoDetalle: 0x2a2834,
      ceja: 0xd8dce4,
      ojo: 0xf7f5f2,
      iris: 0xc46e27,
      pupila: 0x1e1208,
      brillo: 0xffffff,
      pestanas: 0x1c1a1e,
      labio: 0x683c34,
      rojoPolo: 0xba2422,
      rojoPoloBorde: 0x961c1a,
      blancoCuello: 0xf5eedf,
      grisCargo: 0x2f343b,
      grisCargoOscuro: 0x21252a,
      cueroNegro: 0x1f2228,
      correaGris: 0x484d56,
      hebillaMetal: 0x8a929e,
      alaHueso: 0x221f28,
      alaMembrana: 0x342938,
      botas: 0x1e2024,
      suela: 0x141518
    };

    const PINTURA = {
      Cabeza: 'piel', Cuello: 'piel', BrazoPiel: 'piel', DedosPiel: 'piel', Oreja: 'piel', Nariz: 'piel',
      PliegueOreja: 'pielSombra', ParpadoInferior: 'pielSombra', Boca: 'labio',
      Ojo: 'ojo', Iris: 'iris', Pupila: 'pupila', BrilloOjo: 'brillo', BrilloOjoPequeno: 'brillo', Pestanas: 'pestanas', Ceja: 'ceja',
      PeloBase: 'peloBlanco', FlequilloCentroD: 'peloClaro', FlequilloCentroI: 'peloClaro', MechonFrenteD: 'peloClaro', MechonFrenteI: 'peloClaro',
      MechonLateralD: 'peloBlanco', MechonLateralI: 'peloBlanco', SpikeCorona1: 'peloClaro', SpikeCorona2: 'peloClaro', SpikeCoronaCentro: 'peloClaro',
      SpikeLateralI: 'peloSombra', SpikeLateralD: 'peloSombra', SpikeNucaI: 'peloSombra', SpikeNucaD: 'peloSombra',
      CuernoDemonio: 'cuerno', BaseCuerno: 'cuernoDetalle',
      CordonCuello: 'cueroNegro', Colgante: 'hebillaMetal',
      PoloRojo: 'rojoPolo', BajoPoloRojo: 'rojoPoloBorde', MangaPolo: 'rojoPolo', RibeteManga: 'rojoPoloBorde',
      CuelloPoloBlanco: 'blancoCuello', SolapaPoloBlanco: 'blancoCuello', BotonPoloBlanco: 'blancoCuello',
      MunequeraGuante: 'cueroNegro', ManoGuante: 'cueroNegro', CorreaGuante: 'correaGris', HebillaGuante: 'hebillaMetal',
      Cinturon: 'cueroNegro', HebillaCinturon: 'hebillaMetal',
      PantalonCargo: 'grisCargo', BolsilloCargo: 'grisCargo', TapaBolsilloCargo: 'grisCargoOscuro', TiraBolsilloCargo: 'correaGris', PunoPantalonCargo: 'grisCargoOscuro',
      HuesoAlaSuperior: 'alaHueso', GarraAla: 'cuernoDetalle', HuesoAlaExterior: 'alaHueso', NervaduraAla1: 'alaHueso', NervaduraAla2: 'alaHueso', MembranaAla: 'alaMembrana',
      CanaBota: 'botas', LenguetaBota: 'cueroNegro', CordonesBota: 'correaGris', BotaCombate: 'botas', SuelaBota: 'suela'
    };

    const materiales = {};
    function material(clave) {
      if (!materiales[clave]) {
        const esMembrana = clave === 'alaMembrana';
        const m = esMembrana
          ? new THREE.MeshLambertMaterial({
              color: COLOR[clave],
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1
            })
          : clayMaterial.clone();

        if (!esMembrana) {
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

    // ---------------- 11. ANIMACIONES DE ANDER ----------------
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

    // Reposo: postura desafiante con respiración pausada y leve ladeo de cabeza
    const dR = 2.4;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('Pecho', dR, (t) => [-1.2 * sen(t), 0, 0]),
      giro('Cabeza', dR, (t) => [1.6 * sen(t), 1.2 * sen(t), 1.0 * sen(t)]),
      ...LADOS.map((s) => giro('Brazo' + L(s), dR, (t) => [2, 0, s * (2.5 + 1.5 * (1 - cos(t)) / 2)]))
    ]);

    // Caminar: marcha decidida y con estilo anime casual
    const dC = 0.9;
    const PASO = 26;
    const caminar = new THREE.AnimationClip('Caminar', dC, [
      sube('Cadera', dC, (t) => 0.012 * (1 - cos(t, 2)) / 2),
      giro('Cadera', dC, (t) => [0, 5 * sen(t), 0]),
      giro('Pecho', dC, (t) => [3, -7 * sen(t), 0]),
      giro('Cabeza', dC, (t) => [-2, 3 * sen(t), 0]),
      ...LADOS.flatMap((s) => [
        giro('Pierna' + L(s), dC, (t) => [s * PASO * sen(t), 0, 0]),
        giro('Pie' + L(s), dC, (t) => [s * -0.45 * PASO * sen(t) + 8 * Math.max(0, s * cos(t)) ** 2, 0, 0]),
        giro('Brazo' + L(s), dC, (t) => [s * -0.9 * PASO * sen(t), 0, s * 2.8]),
        giro('Mano' + L(s), dC, (t) => [s * -8 * sen(t), 0, 0])
      ])
    ]);

    // Celebrar: pose chulesca de demonio (sonrisa victoriosa y pose triunfal)
    const dF = 1.6;
    const alzar = [[0, 0], [0.20, 85], [0.40, 85], [0.60, 115], [0.80, 115], [1, 0]];
    const adelante = [[0, 0], [0.40, 0], [0.60, 18], [0.80, 18], [1, 0]];
    const celebrar = new THREE.AnimationClip('Celebrar', dF, [
      giro('Pecho', dF, (t) => [-5 * Math.sin(Math.PI * t), 0, 0], 32),
      giro('Cabeza', dF, (t) => [-7 * Math.sin(Math.PI * t), 0, 0], 32),
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

