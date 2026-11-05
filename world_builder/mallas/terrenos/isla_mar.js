/**
 * Océano de la Isla — Malla procedural de mar circundante con límite visible que engloba
 * todo el archipiélago y transforma las 3 aldeas y el bosque central en una gran ISLA.
 *
 * Características:
 *   - Lámina oceánica translúcida azul profunda y turquesa (210 m × 200 m).
 *   - Límite visible nítido: barrera de arrecife perimetral con cresta de espuma marina blanca (#e0f2fe).
 *   - Zócalo de caída abisal en los cuatro bordes para enmarcar la maqueta como una isla completa.
 *   - Esqueleto y animaciones de oleaje marino ('Marea Oceánica', 'Oleaje de Arrecife', 'Mar en Calma').
 */
registrarMalla({
  id: 'isla_mar',
  categoria: 'terrenos',
  nombre: 'Océano de la Isla',
  icono: '🌊',
  origen: 'Capa Marina Circundante de la Isla',

  construir(M) {
    const g = new THREE.Group();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const C = (hex) => new THREE.Color(hex);
    const grad = Math.PI / 180;

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['MarCentro', 'Raiz', 0.00, -0.35, 12.00],
      ['OesteOceano', 'MarCentro', -53.00, -0.35, 0.00],
      ['EsteOceano', 'MarCentro', 53.00, -0.35, 0.00],
      ['NorteOceano', 'MarCentro', 0.00, -0.35, -43.00],
      ['SurOceano', 'MarCentro', 0.00, -0.35, 43.00]
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

    // ---------------- 2. MODELADO DE LA LÁMINA MARINA (A 2 CUADROS DE DISTANCIA) ----------------
    const ancho = 106.0; // Enmarca los 102m de tierra + 2m de margen a cada lado
    const fondo = 86.0;  // Enmarca los 82m de tierra + 2m de margen a cada lado
    const cols = M.seg(48, 24);
    const rows = M.seg(40, 20);

    const geo = new THREE.PlaneGeometry(ancho, fondo, cols, rows);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.32, 12.0);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Distancia normalizada al borde exterior
      const ax = Math.abs(x) / (ancho * 0.5);
      const az = Math.abs(z - 12.0) / (fondo * 0.5);
      const bordeMax = Math.max(ax, az);

      let y = -0.32;
      // Barrera perimetral de cresta de arrecife / límite visible a 2 cuadros
      if (bordeMax > 0.88) {
        const fBorde = (bordeMax - 0.88) / 0.12;
        y += Math.sin(fBorde * Math.PI) * 0.28;
      }

      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mallaMar = M.pieza(geo, 'MarOceanoIsla', cols, rows);
    mallaMar.material = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.82,
      roughness: 0.14,
      metalness: 0.08
    });
    g.add(mallaMar);

    // ---------------- 3. PINTURA POR VÉRTICE DEL MAR ----------------
    const COL_AZUL_ABISAL = C(0x034a75);
    const COL_AZUL_MAR = C(0x0284c7);
    const COL_TURQUESA_COSTA = C(0x38bdf8);
    const COL_ESPUMA_LIMITE = C(0xf0f9ff);

    M.pintar(mallaMar, (i, p) => {
      const x = p.x;
      const z = p.z;
      const ax = Math.abs(x) / (ancho * 0.5);
      const az = Math.abs(z - 12.0) / (fondo * 0.5);
      const bordeMax = Math.max(ax, az);

      // Límite visible (arrecife de borde)
      if (bordeMax > 0.90) {
        return COL_ESPUMA_LIMITE;
      }

      const dCentro = Math.hypot(x, z - 12.0);
      const fCosta = Math.max(0, Math.min(1, (55.0 - dCentro) / 35.0));

      const colOceano = COL_AZUL_MAR.clone().lerp(COL_AZUL_ABISAL, 1.0 - fCosta);
      return colOceano.lerp(COL_TURQUESA_COSTA, fCosta * 0.60);
    }, g);

    // ---------------- 4. BARRERA EXTERIOR VISIBLE (MARCO DE LÍMITE) ----------------
    const marcoGeo = new THREE.BoxGeometry(ancho + 1.2, 0.45, fondo + 1.2, 2, 1, 2);
    marcoGeo.translate(0, -0.55, 12.0);
    const meshMarco = M.pieza(marcoGeo, 'MarcoLimiteMar', 2, 1);
    meshMarco.material = M.materialFacetado();
    meshMarco.material.color.setHex(0x1e3a5f);
    g.add(meshMarco);

    // ---------------- 5. PEÑASCOS Y ROCAS EN MEDIO DEL MAR (Caminos e Interferencias) ----------------
    const rocasMarinas = [
      // Paso marino / camino de rocas del Puerto (Oeste)
      { wx: -37.0, wz: -21.0, rad: 1.6, alt: 1.4, name: 'PasoMarino_Oeste_1' },
      { wx: -41.5, wz: -16.0, rad: 1.9, alt: 1.8, name: 'PasoMarino_Oeste_2' },
      { wx: -46.0, wz: -10.0, rad: 2.3, alt: 2.2, name: 'PasoMarino_Oeste_3' },
      { wx: -49.5, wz: -2.0,  rad: 1.8, alt: 1.7, name: 'PasoMarino_Oeste_4' },
      { wx: -50.0, wz: 6.0,   rad: 2.1, alt: 2.0, name: 'PasoMarino_Oeste_5' },
      { wx: -47.0, wz: 14.0,  rad: 1.7, alt: 1.6, name: 'PasoMarino_Oeste_6' },
      { wx: -42.0, wz: 21.0,  rad: 1.5, alt: 1.4, name: 'PasoMarino_Oeste_7' },
      { wx: -37.0, wz: 26.0,  rad: 1.4, alt: 1.3, name: 'PasoMarino_Oeste_8' },

      // Arrecife y camino de peñascos de la Aldea (Este)
      { wx: 37.0,  wz: -19.0, rad: 1.5, alt: 1.3, name: 'Arrecife_Este_1' },
      { wx: 42.0,  wz: -13.0, rad: 2.0, alt: 1.9, name: 'Arrecife_Este_2' },
      { wx: 47.0,  wz: -5.0,  rad: 2.4, alt: 2.4, name: 'Arrecife_Este_3' },
      { wx: 50.0,  wz: 3.0,   rad: 2.1, alt: 2.1, name: 'Arrecife_Este_4' },
      { wx: 48.0,  wz: 11.0,  rad: 1.8, alt: 1.7, name: 'Arrecife_Este_5' },
      { wx: 43.0,  wz: 19.0,  rad: 1.5, alt: 1.4, name: 'Arrecife_Este_6' },
      { wx: 38.0,  wz: 25.0,  rad: 1.4, alt: 1.2, name: 'Arrecife_Este_7' },

      // Farallones e interferencias Norte (tras las cumbres)
      { wx: -20.0, wz: -30.0, rad: 2.4, alt: 3.2, name: 'Farallon_Norte_1' },
      { wx: -8.0,  wz: -30.5, rad: 2.0, alt: 2.7, name: 'Farallon_Norte_2' },
      { wx: 6.0,   wz: -30.5, rad: 2.6, alt: 3.5, name: 'Farallon_Norte_3' },
      { wx: 19.0,  wz: -30.0, rad: 2.2, alt: 2.9, name: 'Farallon_Norte_4' },

      // Rompeolas y peñascos de Ciudad Forja (Sur)
      { wx: -15.0, wz: 47.0,  rad: 1.8, alt: 1.6, name: 'Rompeolas_Sur_1' },
      { wx: -6.0,  wz: 50.0,  rad: 2.2, alt: 2.1, name: 'Rompeolas_Sur_2' },
      { wx: 6.0,   wz: 50.0,  rad: 2.2, alt: 2.1, name: 'Rompeolas_Sur_3' },
      { wx: 15.0,  wz: 47.0,  rad: 1.8, alt: 1.6, name: 'Rompeolas_Sur_4' },

      // Interferencias en esquinas
      { wx: -48.0, wz: -28.0, rad: 2.0, alt: 2.3, name: 'Interferencia_NW' },
      { wx: 48.0,  wz: -28.0, rad: 2.0, alt: 2.3, name: 'Interferencia_NE' },
      { wx: -46.0, wz: 49.0,  rad: 1.9, alt: 1.8, name: 'Interferencia_SW' },
      { wx: 46.0,  wz: 49.0,  rad: 1.9, alt: 1.8, name: 'Interferencia_SE' }
    ];

    rocasMarinas.forEach((r, idx) => {
      const rockGeo = new THREE.DodecahedronGeometry(r.rad, 1);
      const rPos = rockGeo.attributes.position;
      for (let k = 0; k < rPos.count; k++) {
        const px = rPos.getX(k);
        const py = rPos.getY(k);
        const pz = rPos.getZ(k);
        rPos.setY(k, py * (r.alt / r.rad));
        const perturb = 1.0 + 0.12 * Math.sin(px * 2.5 + pz * 2.0);
        rPos.setX(k, px * perturb);
        rPos.setZ(k, pz * perturb);
      }
      rockGeo.computeVertexNormals();

      const elevY = (r.alt * 0.40) - 0.22;
      rockGeo.translate(r.wx, elevY, r.wz);

      const mRoca = M.pieza(rockGeo, r.name, 6, 4);
      mRoca.material = M.materialFacetado();
      const colRoca = C(0x645c54);
      if (idx % 2 === 0) colRoca.lerp(C(0x766d64), 0.35);
      mRoca.material.color = colRoca;
      g.add(mRoca);
    });

    // ---------------- 6. ANIMACIONES ----------------
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

    const dM = 6.0;
    const marea = new THREE.AnimationClip('Marea Oceánica', dM, [
      giro('OesteOceano', dM, (t) => [0.4 * sen(t), 0, 0.3 * cos(t)]),
      giro('EsteOceano', dM, (t) => [-0.4 * sen(t), 0, -0.3 * cos(t)]),
      giro('NorteOceano', dM, (t) => [0.3 * cos(t), 0, 0.4 * sen(t)]),
      giro('SurOceano', dM, (t) => [-0.3 * cos(t), 0, -0.4 * sen(t)])
    ]);

    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Mar en Calma', dR, [
      giro('MarCentro', dR, (t) => [0.01 * sen(t), 0, 0.01 * cos(t)])
    ]);

    g.animations = [marea, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombreH]) => 'Hueso' + nombreH);

    return g;
  }
});

