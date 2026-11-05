/**
 * Estanque Hundido con Isla — cuenca rectangular excavada en el terreno
 * con orillas en talud suave, isleta central y lámina de agua translúcida animada.
 * Medidas: 4.8 m × 4.4 m.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta fluvial y lacustre:
 *       • Pradera exterior en verde esmeralda con motas botánicas.
 *       • Talud de orilla arenosa/fangosa húmeda.
 *       • Fondo submarino oscuro con limo y guijarros.
 *       • Isleta central con pradera viva y rocas de contorno.
 *   - Lámina de agua translúcida (color cian turquesa) a nivel de superficie con oleaje sutil.
 *   - Esqueleto articulado con THREE.Bone y animaciones de oleaje ('Oleaje Suave', 'Ondas de Brisa', 'Reposo').
 */
registrarMalla({
  id: 'estanque_isla',
  categoria: 'terrenos',
  nombre: 'Estanque con Isla',
  icono: '💧',
  origen: 'Ruta 1 — Cuenca de Estanque con Isleta',

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
      ['IslaHueso', 'Raiz', 0.00, 0.32, 0.00],
      ['AguaHueso', 'Raiz', 0.00, 0.08, 0.00]
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

    // ---------------- 2. MODELADO DE CUENCA Y TERRENO ----------------
    const cols = M.seg(32, 16);
    const rows = M.seg(28, 16);
    const ancho = 4.8;
    const fondo = 4.4;

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const ax = Math.abs(x);
      const az = Math.abs(z);

      let y = 0.28;
      // Cuenca rectangular hundida
      if (ax < 1.85 && az < 1.65) {
        const dOrilla = Math.min(1.85 - ax, 1.65 - az);
        const factorCuenca = Math.min(1, dOrilla / 0.45);
        y = 0.28 - factorCuenca * 0.48;

        // Isleta central elevada
        if (ax < 0.65 && az < 0.6) {
          const dIsla = Math.min(0.65 - ax, 0.6 - az);
          const factorIsla = Math.min(1, dIsla / 0.22);
          y += factorIsla * 0.52;
        }
      }

      pos.setY(i, y);
    }

    geo.computeVertexNormals();
    const meshCuenca = M.pieza(geo, 'CuencaEstanqueIsla', cols, rows);
    g.add(meshCuenca);

    // ---------------- 3. LÁMINA DE AGUA TRANSLÚCIDA ----------------
    const waterGeo = new THREE.PlaneGeometry(3.6, 3.2, 12, 10);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x22a8c8,
      roughness: 0.1,
      metalness: 0.15,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide
    });
    const meshAgua = new THREE.Mesh(waterGeo, waterMat);
    meshAgua.position.set(0, 0.08, 0);
    meshAgua.name = 'LaminaAguaEstanque';
    colgar('AguaHueso', meshAgua);

    g.updateMatrixWorld(true);

    // ---------------- 4. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    const COL_CESPED_BASE = C(0x42862a);   // Pradera esmeralda viva
    const COL_CESPED_CLARO = C(0x5ca834);  // Césped iluminado
    const COL_ISLETA_CENTRO = C(0x48962e); // Césped fértil de la isleta
    const COL_ISLETA_BORDE = C(0x766c5c);  // Rocas de perímetro de la isla
    const COL_ORILLA_TALUD = C(0x7c6648);  // Talud arenoso húmedo de orilla
    const COL_FONDO_LIMO = C(0x1e2a18);    // Limo oscuro subacuático
    const COL_FONDO_PROF = C(0x141e12);    // Fondo más profundo

    M.pintar(meshCuenca, (i, p) => {
      const ax = Math.abs(p.x);
      const az = Math.abs(p.z);

      // Isleta central
      if (ax < 0.65 && az < 0.6) {
        const dCentro = Math.hypot(p.x / 0.65, p.z / 0.6);
        let col = mezclar(COL_ISLETA_CENTRO, COL_ISLETA_BORDE, suave(0.4, 0.95, dCentro));
        return col;
      }

      // Zona de cuenca hundida (fondo y orilla)
      if (ax < 1.85 && az < 1.65) {
        if (p.y < 0.0) {
          // Fondo sumergido
          return mezclar(COL_FONDO_LIMO, COL_FONDO_PROF, suave(0.0, -0.2, p.y));
        }
        // Talud de orilla
        return mezclar(COL_ORILLA_TALUD, COL_CESPED_BASE, suave(0.0, 0.28, p.y));
      }

      // Pradera circundante
      const veta = Math.sin(p.x * 3.5) * Math.cos(p.z * 3.2);
      return mezclar(COL_CESPED_BASE, COL_CESPED_CLARO, 0.5 + 0.5 * veta);
    }, g);

    // ---------------- 5. ANIMACIONES ORGÁNICAS DE OLEAJE ----------------
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

    // Oleaje Suave: rizado suave del agua
    const dO = 3.6;
    const oleaje = new THREE.AnimationClip('Oleaje Suave', dO, [
      giro('AguaHueso', dO, (t) => [0.8 * sen(t), 0, 0.6 * cos(t)]),
      giro('IslaHueso', dO, (t) => [0.05 * sen(t), 0, 0.04 * cos(t)])
    ]);

    // Ondas de Brisa: rizado rápido con viento
    const dV = 2.4;
    const brisa = new THREE.AnimationClip('Ondas de Brisa', dV, [
      giro('AguaHueso', dV, (t) => [2.2 * sen(t), 0.5 * cos(t, 2), 1.8 * cos(t)]),
      giro('IslaHueso', dV, (t) => [0.12 * sen(t), 0, 0.10 * cos(t)])
    ]);

    // Reposo: agua plácida de estanque
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('AguaHueso', dR, (t) => [0.15 * sen(t), 0, 0.12 * cos(t)]),
      giro('IslaHueso', dR, (t) => [0.02 * sen(t), 0, 0.02 * cos(t)])
    ]);

    g.animations = [oleaje, brisa, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
