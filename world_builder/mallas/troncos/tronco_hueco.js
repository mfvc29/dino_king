/**
 * Tronco Hueco — tronco caído vacío por dentro, con la parte delantera superior rota (abertura),
 * un nudo hueco en el costado y dos ramas secas saliendo por arriba.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_fquohmfquohmfquo.png
 * (La imagen Gemini_Generated_Image_xvjtvkxvjtvkxvjt.png es la misma: no se duplica.)
 * Medidas aprox.: 3,4 m de largo × 1,2 m de ancho.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice (M.pintar) con paleta extraída de la ilustración original:
 *       • Corteza exterior nudosa y agrietada con pátina de líquen y manto de musgo superior.
 *       • Interior cavernoso con sombras profundas y degradado de luz entrando por la abertura y nudo.
 *       • Bordes de madera astillada y anillos concéntricos en las bocas frontal y trasera.
 *       • Ramas secas altas con textura de madera fósil deshidratada.
 *   - Esqueleto articulado con THREE.Bone para ambas ramas maestras y ramitas superiores.
 *   - Animaciones orgánicas de viento ('Brisa Suave', 'Viento Fuerte', 'Reposo').
 */
registrarMalla({
  id: 'tronco_hueco',
  categoria: 'troncos',
  nombre: 'Tronco Hueco',
  icono: '🪵',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_fquohmfquohmfquo.png',

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

    const R = 0.58;
    const Rin = 0.46;
    const L = 3.4;

    // ---------------- 1. ESQUELETO Y BONES ----------------
    const HUESOS = [
      ['Raiz', null, 0, 0, 0],
      ['TroncoBase', 'Raiz', 0, R, 0],

      // Rama seca izquierda (se eleva hacia X negativo y Z negativo)
      ['RamaIzqBase', 'TroncoBase', -0.35, R + 0.50, -0.10],
      ['RamaIzqPunta', 'RamaIzqBase', -1.50, R + 1.60, -0.05],
      ['RamitaIzq', 'RamaIzqBase', -0.90, R + 1.95, -0.08],

      // Rama seca derecha (se eleva hacia X positivo)
      ['RamaDerBase', 'TroncoBase', 0.35, R + 0.50, -0.05],
      ['RamaDerPunta', 'RamaDerBase', 1.05, R + 2.10, 0.00],
      ['RamitaDer', 'RamaDerBase', 1.25, R + 1.65, 0.05]
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

    const tronco = new THREE.Group();
    tronco.position.y = R;
    g.add(tronco);

    // Caras a quitar: abertura irregular arriba-delante y nudo hueco en el costado
    const quitar = (p) => {
      const ang = Math.atan2(p.z, p.y); // 0 = arriba, positivo = hacia el frente
      const dientes = 0.12 * Math.sin(ang * 7) + 0.1 * Math.sin(p.x * 6);
      const abertura = p.x < -0.1 + dientes && Math.abs(ang - 0.35) < 1.05 + dientes;
      const dx = (p.x - 0.95) / 0.3;
      const da = ((ang - 1.2) * R) / 0.28;
      const nudo = dx * dx + da * da < 1;
      return abertura || nudo;
    };

    const corteza = (ang, u) => 1 + 0.04 * Math.sin(ang * 10 + u * 3) + 0.025 * Math.sin(ang * 3 + 1.3);
    const liso = (ang) => 1 + 0.02 * Math.sin(ang * 5);

    // ---------------- 2. MODELADO DE CORTEZA E INTERIOR HUECO ----------------
    const meshCorteza = M.recortar(M.cilindroTumbado(R, L, { perfil: corteza, segRadio: 28, segLargo: 24, nombre: 'CortezaExterior' }), quitar);
    tronco.add(meshCorteza);

    const meshInterior = M.recortar(M.cilindroTumbado(Rin, L, { perfil: liso, segRadio: 28, segLargo: 24, nombre: 'InteriorHueco' }), quitar);
    tronco.add(meshInterior);

    // Bordes de madera que unen corteza e interior en ambos extremos
    const bordeFrontal = M.recortar(M.anillos(Rin, R, -L / 2, { perfil: corteza, u: 0, anillos: 2, segRadio: 28, nombre: 'BordeFrontal' }), quitar);
    tronco.add(bordeFrontal);

    const bordeTrasero = M.anillos(Rin, R, L / 2, { perfil: corteza, u: 1, anillos: 2, segRadio: 28, nombre: 'BordeTrasero' });
    tronco.add(bordeTrasero);

    // Dos ramas secas que salen por arriba (articuladas con huesos)
    const meshRamaIzq = M.tubo([[-0.35, 0.5, -0.1], [-0.6, 1.0, -0.15], [-1.0, 1.4, -0.1], [-1.5, 1.6, -0.05]], 0.06, 0.015, { segLargo: 10, segRadio: 6, nombre: 'RamaIzquierda' });
    colgar('RamaIzqBase', meshRamaIzq);

    const meshRamitaIzq = M.tubo([[-0.85, 1.28, -0.12], [-0.95, 1.65, -0.1], [-0.9, 1.95, -0.08]], 0.025, 0.01, { segLargo: 5, segRadio: 5, nombre: 'RamitaIzquierda' });
    colgar('RamitaIzq', meshRamitaIzq);

    const meshRamaDer = M.tubo([[0.35, 0.5, -0.05], [0.55, 1.1, -0.05], [0.8, 1.7, 0], [1.05, 2.1, 0]], 0.065, 0.015, { segLargo: 10, segRadio: 6, nombre: 'RamaDerecha' });
    colgar('RamaDerBase', meshRamaDer);

    const meshRamitaDer = M.tubo([[0.62, 1.3, 0], [0.95, 1.55, 0.05], [1.25, 1.65, 0.05]], 0.03, 0.01, { segLargo: 5, segRadio: 5, nombre: 'RamitaDerecha' });
    colgar('RamitaDer', meshRamitaDer);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA ARTÍSTICA POR VÉRTICE (M.pintar) ----------------
    // Paleta fiel a Gemini_Generated_Image_fquohmfquohmfquo.png
    const COL_CORTEZA_PROF = C(0x231813);   // Surcos sombríos de corteza vieja
    const COL_CORTEZA_BASE = C(0x483428);   // Tono castaño envejecido
    const COL_CORTEZA_CALIDA = C(0x6b5039); // Crestas de corteza secadas al sol
    const COL_CORTEZA_CENIZA = C(0x605a52); // Líquenes y corteza plateada

    const COL_MUSGO_OSCURO = C(0x304818);   // Musgo en la penumbra
    const COL_MUSGO_VIVO = C(0x527926);     // Manto de musgo verde esmeralda
    const COL_MUSGO_LUZ = C(0x789e36);      // Borde de musgo dorado por la luz

    const COL_HUECO_FONDO = C(0x130c08);    // Penumbra profunda del fondo del tronco
    const COL_HUECO_PARED = C(0x28190f);    // Madera descompuesta de la cavidad interna
    const COL_HUECO_LUZ = C(0x523824);      // Pared interna donde entra la luz

    const COL_FIBRA_BORDE = C(0xb28652);    // Borde desgarrado de la abertura
    const COL_ANILLO_ALBURA = C(0xcaa26c);  // Sección de albura clara
    const COL_ANILLO_DURAMEN = C(0x764e28); // Sección de madera interior y anillos oscuros

    // Pintar corteza exterior
    M.pintar(meshCorteza, (i, p) => {
      const dy = (p.y - R) / R;
      const veta = Math.sin(p.x * 14 + p.z * 16);
      const grano = Math.sin(p.x * 36);

      let col = mezclar(COL_CORTEZA_BASE, COL_CORTEZA_CALIDA, 0.5 + 0.5 * veta);
      col = mezclar(col, COL_CORTEZA_PROF, suave(0.2, -0.7, dy)); // Sombra de contacto con la tierra
      if (grano > 0.4) col = mezclar(col, COL_CORTEZA_CENIZA, 0.4);

      // Musgo en la cresta superior del tronco
      const ruido = 0.22 * Math.sin(p.x * 5.5) + 0.15 * Math.sin(p.z * 8.0);
      const factorMusgo = suave(0.18 + ruido, 0.80 + ruido, dy);
      if (factorMusgo > 0) {
        const colMusgo = (dy > 0.75 && veta > 0.1) ? COL_MUSGO_LUZ : (veta > 0 ? COL_MUSGO_VIVO : COL_MUSGO_OSCURO);
        col = mezclar(col, colMusgo, factorMusgo * 0.90);
      }

      // Resalte de fibra de madera en los labios de la abertura rota
      if (p.x < 0.2 && p.y > R) {
        const factorBorde = suave(0.2, -0.3, p.x);
        col = mezclar(col, COL_FIBRA_BORDE, factorBorde * 0.4);
      }

      return col;
    }, g);

    // Pintar interior hueco: degradado dramático de luz/sombra
    M.pintar(meshInterior, (i, p) => {
      // La abertura está en X < 0 y hacia arriba/frente (+Z, +Y)
      const cercaniaAbertura = suave(0.8, -0.6, p.x) * suave(0.2, R, p.y);
      let col = mezclar(COL_HUECO_FONDO, COL_HUECO_PARED, 0.6);
      col = mezclar(col, COL_HUECO_LUZ, cercaniaAbertura * 0.85);

      // Fondo del extremo cerrado es más oscuro
      if (p.x > 0.8) col = mezclar(col, COL_HUECO_FONDO, suave(0.8, 1.6, p.x));
      return col;
    }, g);

    // Pintar bordes de corte circular con anillos
    const pintarBorde = (mesh) => {
      M.pintar(mesh, (i, p) => {
        const rho = Math.hypot(p.y - R, p.z) / R;
        const anillo = 0.5 + 0.5 * Math.sin(rho * 42);
        let col = mezclar(COL_ANILLO_DURAMEN, COL_ANILLO_ALBURA, anillo);
        if (rho < (Rin / R) + 0.05) col = mezclar(col, COL_HUECO_PARED, 0.7); // Borde hacia el hueco
        if (rho > 0.90) col = mezclar(col, COL_CORTEZA_PROF, 0.8); // Borde exterior corteza
        return col;
      }, g);
    };
    pintarBorde(bordeFrontal);
    pintarBorde(bordeTrasero);

    // Pintar ramas secas que se elevan
    const pintarRama = (mesh) => {
      M.pintar(mesh, (i, p) => {
        const veta = Math.sin(p.y * 22 + p.x * 14);
        let col = mezclar(COL_CORTEZA_CENIZA, COL_CORTEZA_BASE, 0.45 + 0.3 * veta);
        if (p.y > R + 1.2) col = mezclar(col, COL_ANILLO_ALBURA, 0.35); // Puntas más claras
        if (p.y < R + 0.8 && p.z < 0) col = mezclar(col, COL_MUSGO_OSCURO, 0.4); // Musgo en horquillas
        return col;
      }, g);
    };
    [meshRamaIzq, meshRamitaIzq, meshRamaDer, meshRamitaDer].forEach(pintarRama);

    // ---------------- 4. ANIMACIONES ORGÁNICAS DE VIENTO ----------------
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

    // Brisa Suave: vaivén flexible de las ramas desnudas
    const dB = 4.8;
    const brisa = new THREE.AnimationClip('Brisa Suave', dB, [
      giro('RamaIzqBase', dB, (t) => [0.7 * sen(t), 0, 1.1 * cos(t)]),
      giro('RamaIzqPunta', dB, (t) => [1.5 * sen(t), 0.4 * cos(t, 2), 2.2 * cos(t)]),
      giro('RamitaIzq', dB, (t) => [1.8 * cos(t), 0, -2.0 * sen(t)]),

      giro('RamaDerBase', dB, (t) => [-0.8 * sen(t), 0, 1.2 * cos(t)]),
      giro('RamaDerPunta', dB, (t) => [-1.7 * sen(t), 0.5 * cos(t, 2), 2.5 * cos(t)]),
      giro('RamitaDer', dB, (t) => [-1.9 * cos(t), 0, -2.2 * sen(t)])
    ]);

    // Viento Fuerte: ráfagas que arquean fuertemente las ramas secas
    const dV = 3.2;
    const viento = new THREE.AnimationClip('Viento Fuerte', dV, [
      giro('RamaIzqBase', dV, (t) => [2.4 * sen(t), 0, 3.6 * sen(t)]),
      giro('RamaIzqPunta', dV, (t) => [5.0 * sen(t), 1.1 * cos(t, 2), 6.2 * sen(t)]),
      giro('RamitaIzq', dV, (t) => [5.6 * cos(t), 0, -6.0 * sen(t)]),

      giro('RamaDerBase', dV, (t) => [-2.6 * sen(t), 0, 3.8 * sen(t)]),
      giro('RamaDerPunta', dV, (t) => [-5.4 * sen(t), 1.2 * cos(t, 2), 6.8 * sen(t)]),
      giro('RamitaDer', dV, (t) => [-6.0 * cos(t), 0, -6.5 * sen(t)])
    ]);

    // Reposo: micro-oscilación casi imperceptible
    const dR = 5.8;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('RamaIzqBase', dR, (t) => [0.22 * sen(t), 0, 0.32 * cos(t)]),
      giro('RamaIzqPunta', dR, (t) => [0.45 * sen(t), 0, 0.60 * cos(t)]),
      giro('RamitaIzq', dR, (t) => [0.50 * cos(t), 0, -0.55 * sen(t)]),

      giro('RamaDerBase', dR, (t) => [-0.25 * sen(t), 0, 0.35 * cos(t)]),
      giro('RamaDerPunta', dR, (t) => [-0.50 * sen(t), 0, 0.70 * cos(t)]),
      giro('RamitaDer', dR, (t) => [-0.55 * cos(t), 0, -0.60 * sen(t)])
    ]);

    g.animations = [brisa, viento, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
