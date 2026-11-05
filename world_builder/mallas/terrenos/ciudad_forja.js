/**
 * Ciudad de la Forja y el Rayo — Malla procedural de ciudadela al frente de la entrada sur.
 * Temática: Fuego (🔥) y Rayo (⚡).
 *
 * Características:
 *   - Gran calzada principal que enlaza directamente con la entrada sur del bosque.
 *   - Plaza de la Forja Central con Obelisco de Pararrayos de aguja dorada y pebeteros de fuego.
 *   - 6 Solares / terrazas urbanas perfectamente niveladas (y = +0.08m) para herrerías, armerías y viviendas.
 *   - Pavimento basáltico con juntas cálidas de rescoldo y pizarra electrostática.
 *   - Costura norte limpia a cota cero (y = 0.00m) en z = -12m para unirse al bosque sin escalón.
 *   - Esqueleto y animaciones temáticas ('Llama de Forja', 'Chispa Sísmica', 'Reposo').
 */
registrarMalla({
  id: 'ciudad_forja',
  categoria: 'terrenos',
  nombre: 'Ciudad de la Forja y el Rayo',
  icono: '⚡',
  origen: 'Bastión Sur de Fuego y Rayo',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const C = (hex) => new THREE.Color(hex);
    const grad = Math.PI / 180;

    const mezclar = (c1, c2, t) => c1.clone().lerp(c2, Math.max(0, Math.min(1, t)));

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['CiudadCentro', 'Raiz', 0.00, 0.00, 0.00],
      ['PlazaForja', 'CiudadCentro', 0.00, 0.00, 1.00],
      ['ObeliscoRayo', 'PlazaForja', 0.00, 2.50, 1.00],
      ['PebeteroIzq', 'CiudadCentro', -4.00, 0.90, -9.00],
      ['PebeteroDer', 'CiudadCentro', 4.00, 0.90, -9.00]
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

    // ---------------- 2. MODELADO TOPOGRÁFICO DE LA CIUDAD ----------------
    const ancho = 34.0; // X: [-17, +17]
    const fondo = 24.0; // Z: [-12, +12]
    const cols = M.seg(64, 32);
    const rows = M.seg(48, 24);

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);

    // 6 Solares nivelados de construcción urbana
    const SOLARES_CIUDAD = [
      { id: 'Solar Gran Forja', cx: -8.0, cz: -4.5, rx: 3.5, rz: 2.8, y: 0.08 },
      { id: 'Solar Armeria', cx: 8.0, cz: -4.5, rx: 3.5, rz: 2.8, y: 0.08 },
      { id: 'Solar Templo Rayo', cx: -8.5, cz: 5.5, rx: 3.2, rz: 2.6, y: 0.08 },
      { id: 'Solar Posada Bastion', cx: 8.5, cz: 5.5, rx: 3.2, rz: 2.6, y: 0.08 },
      { id: 'Solar Taller Chispa', cx: 0.0, cz: 7.5, rx: 3.0, rz: 2.4, y: 0.08 }
    ];

    function calcSolarCiudad(x, z) {
      let maxF = 0, targetY = 0;
      for (let i = 0; i < SOLARES_CIUDAD.length; i++) {
        const s = SOLARES_CIUDAD[i];
        const dx = Math.abs(x - s.cx);
        const dz = Math.abs(z - s.cz);
        if (dx < s.rx + 0.6 && dz < s.rz + 0.6) {
          const fx = Math.max(0, Math.min(1, (s.rx + 0.6 - dx) / 0.6));
          const fz = Math.max(0, Math.min(1, (s.rz + 0.6 - dz) / 0.6));
          const f = fx * fz;
          if (f > maxF) { maxF = f; targetY = s.y; }
        }
      }
      return { factor: maxF, targetY };
    }

    function calcAlturaCiudad(x, z) {
      let y = 0.0;

      // Murallón / terraplén perimetral sur y lateral
      if (z > 7.5 && Math.abs(x) > 3.5) {
        const fS = Math.min(1, (z - 7.5) / 4.5);
        y += fS * fS * 0.75;
      }
      if (Math.abs(x) > 13.0) {
        const fL = Math.min(1, (Math.abs(x) - 13.0) / 4.0);
        y += fL * fL * 0.85;
      }

      // Redondeo de esquinas sureste y suroeste para eliminar ángulos rectos
      if (z > 5.5 && Math.abs(x) > 9.0) {
        const dCorn = Math.hypot(Math.abs(x) - 9.0, z - 5.5);
        if (dCorn > 4.5) y += (dCorn - 4.5) * 0.18;
      }

      // Rampa / embarcadero de acceso al mar al sur (continuación de la gran avenida)
      if (Math.abs(x) < 3.4 && z > 4.5) {
        const fRampaS = Math.min(1, (z - 4.5) / 7.5);
        y = y * (1.0 - fRampaS) + (-0.16) * fRampaS;
      }

      // Gran Avenida y Plaza Central
      const dAvenida = Math.abs(x);
      const dPlaza = Math.hypot(x, z - 1.0);
      if (dAvenida < 2.2 && z < 2.0) {
        y -= (2.2 - dAvenida) * 0.05;
      }
      if (dPlaza < 4.5) {
        y -= 0.04;
      }

      // Nivelado de solares
      const sol = calcSolarCiudad(x, z);
      if (sol.factor > 0) {
        y = y * (1.0 - sol.factor) + sol.targetY * sol.factor;
      }

      // Costura norte orgánica curvada con el bosque (elimina uniones rectas)
      const ondaNorte = 1.4 * Math.sin(x * 0.38);
      const corteNorte = -7.5 + ondaNorte;
      if (z < corteNorte) {
        const tCostura = Math.max(0, Math.min(1, (z - (-12.0)) / (corteNorte - (-12.0))));
        y *= (tCostura * tCostura * (3 - 2 * tCostura));
      }

      return y;
    }

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, calcAlturaCiudad(x, z));
    }
    geo.computeVertexNormals();

    const mallaTerreno = M.pieza(geo, 'TerrenoCiudadForjaBase', cols, rows);
    g.add(mallaTerreno);

    // ---------------- 3. PINTURA POR VÉRTICE (FUEGO 🔥 + RAYO ⚡) ----------------
    const COL_ADOQUIN_BASALTO = C(0x423832);
    const COL_TIERRA_CALIDA = C(0xb86c32);
    const COL_SOLAR_FORJA = C(0x5c4238);
    const COL_PRADERA_SUR = C(0x4c8030);
    const COL_ORO_RAYO = C(0xeab308);
    const COL_ROJO_FUEGO = C(0xef4444);

    M.pintar(mallaTerreno, (i, p) => {
      const x = p.x;
      const z = p.z;
      const dAv = Math.abs(x);
      const dPl = Math.hypot(x, z - 1.0);
      const sol = calcSolarCiudad(x, z);

      // Acceso al mar al sur: rampa de atraque de piedra volcánica
      if (Math.abs(x) < 3.4 && z > 4.5) {
        const colRampa = COL_ADOQUIN_BASALTO.clone().lerp(C(0x3e342f), Math.min(1, (z - 4.5) / 7.5));
        if (p.y < -0.06) colRampa.lerp(C(0x38bdf8), 0.40);
        return mezclar(COL_PRADERA_SUR, colRampa, Math.min(1, (z - 4.0) / 2.0));
      }

      // Plaza de la Forja Central
      if (dPl < 4.8) {
        const fPl = Math.min(1, (4.8 - dPl) / 0.8);
        const patronLosa = Math.sin(x * 4.5) * Math.cos(z * 4.5);
        let col = mezclar(COL_ADOQUIN_BASALTO, COL_TIERRA_CALIDA, 0.4 + 0.3 * patronLosa);
        if (dPl < 1.6) {
          // Destello del pararrayos central
          col = mezclar(col, COL_ORO_RAYO, 0.45);
        }
        return mezclar(COL_PRADERA_SUR, col, fPl);
      }

      // Gran Avenida de Acceso
      if (dAv < 2.5) {
        const fAv = Math.min(1, (2.5 - dAv) / 0.6);
        const colAv = mezclar(COL_ADOQUIN_BASALTO, COL_TIERRA_CALIDA, 0.35);
        return mezclar(COL_PRADERA_SUR, colAv, fAv);
      }

      // Solares de forja y bastión
      if (sol.factor > 0) {
        return mezclar(COL_PRADERA_SUR, COL_SOLAR_FORJA, sol.factor);
      }

      // Pradera circundante
      const ruido = 0.06 * Math.sin(x * 1.8) * Math.cos(z * 1.5);
      return mezclar(COL_PRADERA_SUR, C(0x5ca036), 0.5 + ruido);
    }, g);

    // ---------------- 4. OBELISCO DE PARARRAYOS Y PEBETEROS DE FUEGO ----------------
    // Obelisco central de pararrayos (Rayo ⚡)
    const baseObGeo = new THREE.CylinderGeometry(0.70, 0.95, 0.80, 8, 1);
    baseObGeo.translate(0, 0.40, 1.0);
    const meshBaseOb = M.pieza(baseObGeo, 'BaseObelisco', 8, 1);
    meshBaseOb.material = M.materialFacetado();
    meshBaseOb.material.color.setHex(0x5a5048);
    g.add(meshBaseOb);

    const agujaGeo = new THREE.ConeGeometry(0.22, 3.6, 6);
    agujaGeo.translate(0, 2.6, 1.0);
    const meshAguja = M.pieza(agujaGeo, 'AgujaPararrayos', 6, 1);
    meshAguja.material = clayMaterial.clone();
    meshAguja.material.color.setHex(0xeab308); // Oro Rayo
    g.add(meshAguja);

    // Pebeteros de forja (Fuego 🔥) en la entrada
    [-4.0, 4.0].forEach((px, idx) => {
      const pebGeo = new THREE.CylinderGeometry(0.45, 0.30, 0.90, 8, 1);
      pebGeo.translate(px, 0.45, -9.0);
      const meshPeb = M.pieza(pebGeo, `PebeteroBase_${idx}`, 8, 1);
      meshPeb.material = M.materialFacetado();
      meshPeb.material.color.setHex(0x6e4a3c);
      g.add(meshPeb);

      // Llama encendida
      const llamaGeo = new THREE.ConeGeometry(0.28, 0.65, 6);
      llamaGeo.translate(px, 1.15, -9.0);
      const meshLlama = M.pieza(llamaGeo, `LlamaFuego_${idx}`, 6, 1);
      meshLlama.material = clayMaterial.clone();
      meshLlama.material.color.setHex(0xef4444); // Rojo Fuego
      g.add(meshLlama);
    });

    // ---------------- 5. ANIMACIONES ----------------
    function giro(nombreHueso, dur, fn, n = 32) {
      const tiempos = [], valores = [];
      const q = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ');
      for (let i = 0; i <= n; i++) {
        const [x, y, z] = fn(i / n);
        eu.set(x * grad, y * grad, z * grad);
        q.setFromEuler(eu);
        tiempos.push(i * (dur / n));
        valores.push(q.x, q.y, q.z, q.w);
      }
      return new THREE.QuaternionKeyframeTrack(`Hueso${nombreHueso}.quaternion`, tiempos, valores);
    }
    const sen = (t, k = 1) => Math.sin(2 * Math.PI * k * t);
    const cos = (t, k = 1) => Math.cos(2 * Math.PI * k * t);

    const dF = 2.4;
    const llamaAnim = new THREE.AnimationClip('Llama de Forja', dF, [
      giro('PebeteroIzq', dF, (t) => [2.0 * sen(t, 4), 0, 1.5 * cos(t, 4)]),
      giro('PebeteroDer', dF, (t) => [-2.0 * cos(t, 4), 0, 1.5 * sen(t, 4)]),
      giro('ObeliscoRayo', dF, (t) => [0.1 * sen(t), 0, 0.1 * cos(t)])
    ]);

    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('CiudadCentro', dR, (t) => [0.01 * sen(t), 0, 0.01 * cos(t)])
    ]);

    g.animations = [llamaAnim, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombreH]) => 'Hueso' + nombreH);

    return g;
  }
});

