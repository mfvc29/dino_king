/**
 * Cueva Rocosa 3D — bóveda rocosa ahuecada con arco de piedra, contrafuertes laterales y umbral escalonado.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta mineral geológica:
 *       • Interior cavernoso con sombras profundas y oscuridad de cueva natural.
 *       • Bóveda exterior rocosa con estratificación sedimentaria, manto de musgo superior y reflejos solares.
 *       • Arco de entrada tallado con dovelas de piedra caliza y resalte de clave.
 *       • Contrafuertes laterales pétreos con fisuras sombreadas y contacto con el suelo.
 *   - Esqueleto articulado con THREE.Bone para respuesta dinámica ante vibraciones y pisadas.
 *   - Animaciones geológicas temáticas de dinosaurios ('Pisada Dino', 'Temblor Sísmico', 'Reposo').
 */
registrarMalla({
  id: 'cueva_rocosa',
  categoria: 'piedras',
  nombre: 'Cueva Rocosa 3D',
  icono: '🕳️',
  origen: 'procedural/cueva_meteoro',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const C = (hex) => new THREE.Color(hex);
    const grad = Math.PI / 180;

    const mezclar = (c1, c2, t) => c1.clone().lerp(c2, Math.max(0, Math.min(1, t)));
    const suave = (a, b, x) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['BovedaHueso', 'Raiz', 0.00, 1.50, 0.00],
      ['ArcoHueso', 'Raiz', 0.00, 1.80, 1.50],
      ['RocaIzqHueso', 'Raiz', -1.85, 0.75, 1.60],
      ['RocaDerHueso', 'Raiz', 1.85, 0.70, 1.60]
    ];

    const hueso = {};
    HUESOS.forEach(([nombre, padre, x, y, z]) => {
      const b = new THREE.Bone();
      b.name = 'Hueso' + nombre;
      b.userData.reposo = V(x, y, z);
      const p = padre ? hueso[padre] : null;
      b.position.set(x, y, z).sub(p ? p.userData.reposo : V(0, 0, 0));
      (p || g).add(b);
      hueso[nombre] = b;
    });
    g.updateMatrixWorld(true);

    const colgar = (nombre, obj) => {
      const h = typeof nombre === 'string' ? hueso[nombre] : nombre;
      if (!h || !obj) return obj;
      h.attach(obj);
      return obj;
    };

    // ---------------- 2. MODELADO DE LA CUEVA Y ARCO ----------------
    const segW = M.seg(20, 12);
    const segH = M.seg(14, 10);

    const moundGeo = new THREE.SphereGeometry(2.6, segW, segH, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const mPos = moundGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      let vx = mPos.getX(i) * 1.25;
      let vy = mPos.getY(i) * 1.05;
      let vz = mPos.getZ(i) * 1.15;

      const rockRipple = 1.0 + Math.sin(vx * 2.2) * Math.cos(vy * 2.5) * 0.12;
      vx *= rockRipple;
      vy *= rockRipple;

      if (vz > 0.8 && Math.abs(vx) < 1.35 && vy < 1.85) {
        const archFactor = Math.max(0, 1.0 - Math.hypot(vx / 1.35, (vy - 0.6) / 1.35));
        vz -= archFactor * 2.2;
      }
      mPos.setXYZ(i, vx, vy, vz);
    }
    const meshBoveda = M.pieza(moundGeo, 'BovedaRocosaCueva', segW, segH);
    colgar('BovedaHueso', meshBoveda);

    // Arco de entrada
    const meshArco = M.tubo([
      [-1.55, 0.0, 1.65],
      [-1.35, 1.55, 1.55],
      [0.0,   2.25, 1.45],
      [1.35,  1.55, 1.55],
      [1.55,  0.0, 1.65]
    ], 0.42, 0.42, { segLargo: 18, segRadio: 10, nombre: 'ArcoEntradaCueva' });
    colgar('ArcoHueso', meshArco);

    // Contrafuertes de roca tallada a los lados
    const meshRocaIzq = M.roca(-1.85, 1.6, { ancho: 1.9, alto: 1.5, fondo: 1.8, semilla: 31, nombre: 'RocaCuevaIzq' });
    colgar('RocaIzqHueso', meshRocaIzq);

    const meshRocaDer = M.roca(1.85, 1.6, { ancho: 1.8, alto: 1.4, fondo: 1.7, semilla: 32, nombre: 'RocaCuevaDer' });
    colgar('RocaDerHueso', meshRocaDer);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    const COL_CUEVA_INTERIOR = C(0x140e0a); // Penumbra absoluta del fondo de la cueva
    const COL_ROCA_SOMBRA = C(0x322d26);    // Grietas y contacto sombrío
    const COL_ROCA_BASE = C(0x6e685c);      // Piedra montaña basal
    const COL_ROCA_MEDIA = C(0x8c8476);     // Estrato de caliza medio
    const COL_ROCA_CLARA = C(0xb8ad9a);     // Caliza iluminada
    const COL_ROCA_SOL = C(0xd4cabb);       // Coronamiento cenital
    const COL_MUSGO = C(0x4a6a26);          // Manto de musgo exterior superior

    // Pintar bóveda de la cueva
    M.pintar(meshBoveda, (i, p) => {
      // Diferenciar interior excavado (Z profundo con X bajo y Y bajo) vs exterior
      const esInterior = (p.z < 0.6 && Math.abs(p.x) < 1.4 && p.y < 1.8);
      if (esInterior) {
        return mezclar(COL_CUEVA_INTERIOR, COL_ROCA_SOMBRA, suave(-1.0, 0.5, p.z));
      }

      const estrato = 0.5 + 0.5 * Math.sin(p.y * 8.0 + p.x * 2.0);
      let col = mezclar(COL_ROCA_BASE, COL_ROCA_MEDIA, estrato);
      col = mezclar(col, COL_ROCA_SOMBRA, suave(0.5, -0.2, p.y));

      // Luz superior
      const factorLuz = suave(1.0, 2.8, p.y);
      col = mezclar(col, COL_ROCA_CLARA, factorLuz * 0.7);
      if (p.y > 2.3) col = mezclar(col, COL_ROCA_SOL, 0.5);

      // Musgo en la ladera norte/superior exterior
      if (p.y > 1.2 && p.z < 0.8) {
        col = mezclar(col, COL_MUSGO, suave(1.2, 2.4, p.y) * 0.6);
      }

      return col;
    }, g);

    // Pintar arco de entrada
    M.pintar(meshArco, (i, p) => {
      const dovela = 0.5 + 0.5 * Math.sin(p.x * 12 + p.y * 8);
      let col = mezclar(COL_ROCA_MEDIA, COL_ROCA_CLARA, dovela);
      // La clave superior del arco es más prominente
      if (p.y > 1.9) col = mezclar(col, COL_ROCA_SOL, 0.4);
      // Sombra inferior bajo el arco
      if (p.z < 1.4) col = mezclar(col, COL_ROCA_SOMBRA, 0.45);
      return col;
    }, g);

    // Pintar contrafuertes rocosos laterales
    [meshRocaIzq, meshRocaDer].forEach((malla) => {
      M.pintar(malla, (i, p) => {
        const veta = Math.sin(p.y * 10 + p.x * 3);
        let col = mezclar(COL_ROCA_BASE, COL_ROCA_MEDIA, 0.5 + 0.5 * veta);
        col = mezclar(col, COL_ROCA_SOMBRA, suave(0.3, -0.05, p.y));
        if (p.y > 1.0) col = mezclar(col, COL_ROCA_CLARA, 0.45);
        return col;
      }, g);
    });

    // ---------------- 4. ANIMACIONES SÍSMICAS Y DE DINOSAURIOS ----------------
    function giro(nombre, dur, fn, n = 32) {
      const tiempos = [];
      const valores = [];
      const q = new THREE.Quaternion();
      const eu = new THREE.Euler(0, 0, 0, 'YXZ');
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set(x * grad, y * grad, z * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombre}.quaternion`, tiempos, valores);
    }

    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    // Pisada Dino: eco y retumbo en el interior de la caverna
    const dP = 2.0;
    const decae = (t) => Math.exp(-3.2 * t);
    const pisada = new THREE.AnimationClip('Pisada Dino', dP, [
      giro('BovedaHueso', dP, (t) => [2.6 * sen(t, 4) * decae(t), 0, 1.5 * cos(t, 4) * decae(t)]),
      giro('ArcoHueso', dP, (t) => [3.2 * sen(t, 4) * decae(t), 0, 2.0 * cos(t, 4) * decae(t)]),
      giro('RocaIzqHueso', dP, (t) => [-2.4 * cos(t, 4) * decae(t), 0, -1.8 * sen(t, 4) * decae(t)]),
      giro('RocaDerHueso', dP, (t) => [2.4 * sen(t, 4) * decae(t), 0, 1.8 * cos(t, 4) * decae(t)])
    ]);

    // Temblor Sísmico: resonancia profunda
    const dT = 2.5;
    const temblor = new THREE.AnimationClip('Temblor Sísmico', dT, [
      giro('BovedaHueso', dT, (t) => [0.7 * sen(t, 6), 0, 0.5 * cos(t, 6)]),
      giro('ArcoHueso', dT, (t) => [0.9 * sen(t, 6), 0, 0.6 * cos(t, 6)]),
      giro('RocaIzqHueso', dT, (t) => [-0.8 * cos(t, 6), 0, -0.6 * sen(t, 6)]),
      giro('RocaDerHueso', dT, (t) => [0.8 * sen(t, 6), 0, 0.6 * cos(t, 6)])
    ]);

    // Reposo: tranquilidad de cueva milenaria
    const dR = 5.2;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('BovedaHueso', dR, (t) => [0.05 * sen(t), 0, 0.04 * cos(t)]),
      giro('ArcoHueso', dR, (t) => [0.07 * sen(t), 0, 0.05 * cos(t)]),
      giro('RocaIzqHueso', dR, (t) => [-0.06 * cos(t), 0, -0.04 * sen(t)]),
      giro('RocaDerHueso', dR, (t) => [0.06 * sen(t), 0, 0.04 * cos(t)])
    ]);

    g.animations = [pisada, temblor, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
