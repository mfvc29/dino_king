/**
 * Peñasco — una gran roca redondeada con facetas, otra mediana a su lado y guijarros.
 * Origen: assets/arboles/imagenes/Gemini_Generated_Image_y35gq1y35gq1y35g.png
 * Medidas aprox.: 3,8 m de ancho × 2,5 m de alto.
 *
 * Mejoras aplicadas:
 *   - Pintura por vértice facetada (M.pintar) con paleta extraída de la ilustración original:
 *       • Megalito con estratificación suave, tonos granito pardo y caliza soleada.
 *       • Cúpula superior clara iluminada por el sol cenital con aristas esculpidas.
 *       • Penumbra de contacto basal y pátina de líquen mineral.
 *       • Bloques secundarios y guijarros con sombreado de suelo coordinado.
 *   - Esqueleto articulado con THREE.Bone para respuesta dinámica de masa pétrea.
 *   - Animaciones geológicas temáticas ('Pisada Dino', 'Temblor Sísmico', 'Reposo').
 */
registrarMalla({
  id: 'penasco',
  categoria: 'piedras',
  nombre: 'Peñasco',
  icono: '🪨',
  origen: 'assets/arboles/imagenes/Gemini_Generated_Image_y35gq1y35gq1y35g.png',

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

      ['PenascoGrandeH', 'Raiz', -0.50, 1.25, -0.10],
      ['PenascoCorona', 'PenascoGrandeH', -0.50, 2.50, -0.10],
      ['RocaMedianaH', 'Raiz', 1.05, 0.65, 0.15],
      ['RocaPequenaH', 'Raiz', 0.70, 0.30, 0.75],
      ['GuijarrosFront', 'Raiz', 0.00, 0.10, 1.10]
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

    // ---------------- 2. MODELADO DE ROCAS Y GUIJARROS ----------------
    // Roca principal: grande, redondeada pero con caras talladas
    const meshPenasco = M.roca(-0.5, -0.1, {
      ancho: 2.3, alto: 2.5, fondo: 1.9, inclinacion: -0.18, giro: 0.4,
      dureza: 0.66, cortes: 13, semilla: 51, segW: 22, segH: 16, nombre: 'PenascoGrande'
    });
    colgar('PenascoGrandeH', meshPenasco);

    // Roca mediana a la derecha, más angulosa
    const meshMediana = M.roca(1.05, 0.15, {
      ancho: 1.25, alto: 1.3, fondo: 1.0, inclinacion: 0.1, giro: -0.3,
      dureza: 0.52, cortes: 12, semilla: 52, nombre: 'RocaMediana'
    });
    colgar('RocaMedianaH', meshMediana);

    // Roca pequeña delante de la mediana
    const meshPequena = M.roca(0.7, 0.75, {
      ancho: 0.8, alto: 0.6, fondo: 0.7, giro: 0.5,
      dureza: 0.55, cortes: 10, semilla: 53, nombre: 'RocaPequena'
    });
    colgar('RocaPequenaH', meshPequena);

    const listaGuijarros = [[-1.6, 0.95, 0.2], [-1.2, 1.2, 0.12], [-0.6, 1.25, 0.18], [0.1, 1.1, 0.12], [1.75, 0.85, 0.15]];
    const grupoGuijarros = new THREE.Group();
    grupoGuijarros.name = 'GrupoGuijarros';
    M.guijarros(grupoGuijarros, listaGuijarros, 70);
    colgar('GuijarrosFront', grupoGuijarros);

    g.updateMatrixWorld(true);

    // ---------------- 3. PINTURA FACETADA POR VÉRTICE (M.pintar) ----------------
    // Paleta fiel a Gemini_Generated_Image_y35gq1y35gq1y35g.png
    const COL_ROCA_SOMBRA = C(0x38352e); // Penumbra basal y fisuras de sombra
    const COL_ROCA_BASE = C(0x7c766a);   // Granito intemperizado medio
    const COL_ROCA_CALIDA = C(0x988e7e); // Caliza cálida soleada
    const COL_ROCA_CLARA = C(0xc0b6a4);  // Caras superiores iluminadas
    const COL_ROCA_SOL = C(0xd8cebc);    // Cúpula brillante por la luz cenital
    const COL_LIQUEN = C(0x889280);      // Líquen seco de montaña

    [meshPenasco, meshMediana, meshPequena].forEach((malla) => {
      M.pintar(malla, (i, p) => {
        const estrato = 0.5 + 0.5 * Math.sin(p.y * 11 + p.x * 2.8);
        const grano = Math.sin(p.x * 24 + p.z * 18);

        let col = mezclar(COL_ROCA_BASE, COL_ROCA_CALIDA, estrato);
        col = mezclar(col, COL_ROCA_SOMBRA, suave(0.4, -0.05, p.y));

        const factorLuz = suave(0.6, 2.5, p.y);
        col = mezclar(col, COL_ROCA_CLARA, factorLuz * 0.8);
        if (p.y > 2.0 && grano > 0.15) col = mezclar(col, COL_ROCA_SOL, 0.65);

        if (p.y > 0.4 && p.y < 1.8 && estrato > 0.8) {
          col = mezclar(col, COL_LIQUEN, 0.4);
        }

        return col;
      }, g);
    });

    grupoGuijarros.traverse((o) => {
      if (!o.isMesh) return;
      M.pintar(o, (i, p) => {
        const veta = Math.sin(p.x * 32 + p.z * 28);
        let col = mezclar(COL_ROCA_BASE, COL_ROCA_CLARA, 0.5 + 0.5 * veta);
        col = mezclar(col, COL_ROCA_SOMBRA, suave(0.08, -0.03, p.y));
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

    // Pisada Dino: sacudida pesada de megalito por paso de dinosaurio
    const dP = 1.8;
    const decae = (t) => Math.exp(-3.5 * t);
    const pisada = new THREE.AnimationClip('Pisada Dino', dP, [
      giro('PenascoGrandeH', dP, (t) => [2.8 * sen(t, 4) * decae(t), 0, 1.6 * cos(t, 4) * decae(t)]),
      giro('PenascoCorona', dP, (t) => [4.5 * sen(t, 4) * decae(t), 0, 2.8 * cos(t, 4) * decae(t)]),
      giro('RocaMedianaH', dP, (t) => [3.2 * sen(t, 4) * decae(t), 0, 2.4 * cos(t, 4) * decae(t)]),
      giro('RocaPequenaH', dP, (t) => [3.8 * sen(t, 5) * decae(t), 0, 3.0 * cos(t, 5) * decae(t)]),
      giro('GuijarrosFront', dP, (t) => [4.8 * sen(t, 6) * decae(t), 0, 4.0 * cos(t, 6) * decae(t)])
    ]);

    // Temblor Sísmico: vibración de baja frecuencia
    const dT = 2.4;
    const temblor = new THREE.AnimationClip('Temblor Sísmico', dT, [
      giro('PenascoGrandeH', dT, (t) => [0.8 * sen(t, 6), 0, 0.5 * cos(t, 6)]),
      giro('PenascoCorona', dT, (t) => [1.4 * sen(t, 6), 0, 0.9 * cos(t, 6)]),
      giro('RocaMedianaH', dT, (t) => [0.9 * sen(t, 6), 0, 0.7 * cos(t, 6)]),
      giro('RocaPequenaH', dT, (t) => [1.1 * sen(t, 8), 0, 0.9 * cos(t, 8)]),
      giro('GuijarrosFront', dT, (t) => [1.6 * sen(t, 8), 0, 1.3 * cos(t, 8)])
    ]);

    // Reposo: masa sólida inmutable
    const dR = 5.0;
    const reposo = new THREE.AnimationClip('Reposo', dR, [
      giro('PenascoGrandeH', dR, (t) => [0.06 * sen(t), 0, 0.04 * cos(t)]),
      giro('PenascoCorona', dR, (t) => [0.10 * sen(t), 0, 0.07 * cos(t)]),
      giro('RocaMedianaH', dR, (t) => [0.07 * sen(t), 0, 0.05 * cos(t)]),
      giro('RocaPequenaH', dR, (t) => [0.08 * sen(t), 0, 0.06 * cos(t)]),
      giro('GuijarrosFront', dR, (t) => [0.09 * sen(t), 0, 0.07 * cos(t)])
    ]);

    g.animations = [pisada, temblor, reposo];
    hueso.Raiz.userData.esqueleto = HUESOS.map(([nombre]) => 'Hueso' + nombre);

    return g;
  }
});
