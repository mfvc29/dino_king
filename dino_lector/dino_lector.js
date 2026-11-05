/**
 * DINO LECTOR // Dino Rey Pokédex & Card Scanner Studio
 * Sistema interactivo de lectura biométrica de tarjetas y módulo de invocación.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // ESTADO GLOBAL DEL DINO LECTOR
  // -------------------------------------------------------------
  const state = {
    catalog: null,
    dinos: [],
    attacks: {},
    elements: {},
    activeDino: null,
    activeDinoIndex: 0,
    activeElementFilter: 'todos',
    searchQuery: '',
    sortBy: 'id',
    viewMode: 'chibi', // 'chibi', 'card', 'art'
    ocultas: {},        // id → zona de la isla donde está escondida (static/cartas_ocultas.json)
    coleccion: 'todas', // filtro del álbum: 'todas' | 'encontradas' | 'faltan'
  };

  // Metadatos Paleontológicos y Taxonomía extendida
  const DINO_LORE_DATABASE = {
    fuego: {
      affinity: 'Fuego / Magma',
      advantage: 'Hierba / Planta y Viento',
      habitats: ['Tierras Volcánicas', 'Cañones Ardientes', 'Cráter Meteoro'],
      elementCrest: '🔥',
      loreTemplates: [
        'Los sensores detectan glándulas térmicas igníferas de alta compresión en la cavidad craneal. Su ataque libera ondas de choque incendiarias capaces de fundir rocas.',
        'Especie con blindaje refractario. Su musculatura mandibular acumula energía magmática que se desata con el impacto de su técnica de corte.',
        'Depredador dominante de fuego. Su paso genera una estela de ignición que eleva la temperatura del campo de combate al instante.'
      ]
    },
    agua: {
      affinity: 'Agua / Mareas Profundas',
      advantage: 'Fuego y Tierra',
      habitats: ['Costas del Archipiélago', 'Lagos Abisales', 'Ríos Caudalosos'],
      elementCrest: '💧',
      loreTemplates: [
        'Resonancia hidrodinámica detectada. Sus extremidades y aletas canalizan torrentes de agua presurizada con fuerza demoledora.',
        'Especie adaptada a corrientes feroces. Su piel secreta una capa deslizante que neutraliza impactos físicos y redirige vórtices acuáticos.',
        'Titán de las profundidades marinas. Es capaz de convocar marejadas y crestas de olas vivas para arrastrar al rival.'
      ]
    },
    rayo: {
      affinity: 'Rayo / Alto Voltaje',
      advantage: 'Agua y Viento',
      habitats: ['Cumbres Tempestuosas', 'Mesetas Electrificadas', 'Valle del Trueno'],
      elementCrest: '⚡',
      loreTemplates: [
        'Acumuladores bioeléctricos detectados en sus crestas y espinas. Puede descargar arcos voltaicos de hasta 100,000 voltios con un solo rugido.',
        'Velocidad de reacción fulgurante. La conductividad de su sistema nervioso le permite esquivar ataques y contraatacar en fracciones de segundo.',
        'Canalizador de tormentas. Al entrar en batalla atrae relámpagos del cielo que sobrecargan sus colmillos con plasma puro.'
      ]
    },
    tierra: {
      affinity: 'Tierra / Resonancia Sísmica',
      advantage: 'Rayo y Fuego',
      habitats: ['Montañas Rocosas', 'Canteras Antiguas', 'Cañón de la Forja'],
      elementCrest: '⛰️',
      loreTemplates: [
        'Estructura ósea ultra densa con mineralización de basalto. Su masa corporal genera temblores sísmicos capaces de fracturar el terreno.',
        'Blindaje de placas tectónicas vivas. Posee la defensa física más impenetrable del registro paleontológico.',
        'Mazo óseo y cornamenta reforzada. Sus golpes directos pulverizan fortificaciones de piedra y dejan cráteres en el suelo.'
      ]
    },
    planta: {
      affinity: 'Planta / Hierba Ancestral',
      advantage: 'Agua y Tierra',
      habitats: ['Selvas Primigenias', 'Bosque Esmeralda', 'Pantanos Nebulosos'],
      elementCrest: '🌿',
      loreTemplates: [
        'Simbiogénesis con flora prehistórica. Su cuerpo regenera tejidos mediante fotosíntesis celular acelerada durante el combate.',
        'Especie titánica de herbívoro acorazado. Canaliza raíces y esporas aturdidoras para controlar el movimiento de sus enemigos.',
        'Resonancia biológica natural. Su presencia fortalece la vitalidad de sus compañeros y desgasta la resistencia rival con espinas tóxicas.'
      ]
    },
    viento: {
      affinity: 'Viento / Torbellino Aéreo',
      advantage: 'Hierba / Planta y Tierra',
      habitats: ['Acantilados Costeros', 'Puerto Viento', 'Cañones Eólicos'],
      elementCrest: '🌪️',
      loreTemplates: [
        'Aerodinámica perfecta y huesos neumáticos livianos. Genera cuchillas de viento cortante y ráfagas huracanadas al batir sus garras o alas.',
        'Agilidad sin igual en campo abierto. Su velocidad y capacidad de giro le permiten ejecutar cortes rápidos antes de que el rival reaccione.',
        'Señor de los cielos y mesetas altas. Se eleva en corrientes ascendentes para lanzar ataques en picada de precisión milimétrica.'
      ]
    },
    especial: {
      affinity: 'Especial / Cósmico & Meteoro',
      advantage: 'Todos los Elementos',
      habitats: ['Cueva Meteoro', 'Laboratorio Secreto', 'Anomalías Cuánticas'],
      elementCrest: '✨',
      loreTemplates: [
        'Firma de ADN anómala enriquecida con radiación de meteorito. Trasciende la afinidad elemental común con técnicas de energía pura.',
        'Especie legendaria con capacidad de alterar la gravedad y el tiempo del combate. Los sensores registran una potencia destructiva incalculable.',
        'Dinosaurio alfa de bioingeniería avanzada. Sus ataques no pueden ser mitigados por defensas elementales convencionales.'
      ]
    },
    normal: {
      affinity: 'Neutral / Fuerza Bruta Pura',
      advantage: 'Equilibrio Universal',
      habitats: ['Praderas Abiertas', 'Llanuras de Caza'],
      elementCrest: '⚪',
      loreTemplates: [
        'Potencia física desprovista de magia elemental. Basa su letalidad en musculatura, mordida aplastante y resistencia tenaz.',
        'Especie clásica equilibrada. Adaptabilidad total a cualquier escenario de combate sin debilidades elementales marcadas.'
      ]
    }
  };

  const SIZE_TEXTS = {
    1: 'Pequeño (1 - 2 metros)',
    2: 'Mediano (3 - 5 metros)',
    3: 'Grande (6 - 8 metros)',
    4: 'Muy Grande (9 - 11 metros)',
    5: 'Gigante (12 - 15 metros)',
    6: 'Colosal (Más de 16 metros)'
  };

  // -------------------------------------------------------------
  // INICIALIZACIÓN
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadCatalog();
  });

  // -------------------------------------------------------------
  // AUDIO SYNTHESIZER (WEB AUDIO API - SIN DEPENDENCIAS EXTERNAS)
  // -------------------------------------------------------------





  // -------------------------------------------------------------
  // CARGA DE DATOS DEL CATÁLOGO
  // -------------------------------------------------------------
  async function loadCatalog() {
    const urls = [
      '/assets/dinos/dinos.json',
      '../assets/dinos/dinos.json',
      'assets/dinos/dinos.json'
    ];

    let data = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch (e) {}
    }

    if (!data || !data.dinos) {
      console.error('No se pudo cargar dinos.json');
      document.getElementById('reading-lore-text').textContent =
        'Error de enlace con la base de datos de cartas. Verifica el servidor en el puerto 8086 o 8000.';
      return;
    }

    state.catalog = data;
    state.dinos = data.dinos || [];
    state.attacks = data.attacks || {};
    state.elements = data.elements || {};

    // Cartas de la isla: niveles, requisitos y zona donde está escondida cada una; misiones de vínculo de cada dino
    if (window.CartasIsla) {
      window.CartasIsla.usarDinos(state.dinos);
      await window.CartasIsla.cargarRequisitos();
    }
    try {
      const oc = await (await fetch('/static/cartas_ocultas.json', { cache: 'no-store' })).json();
      (oc.cartas || []).forEach((c) => { state.ocultas[c.id] = c.zona; });
    } catch (e) {}
    // Si el juego encuentra una carta (en otra pestaña) el álbum se actualiza solo
    window.addEventListener('storage', (e) => {
      if (!window.CartasIsla || e.key !== window.CartasIsla.CLAVE) return;
      updateFilterCounts();
      applyDinoToUI(state.activeDino, state.activeDinoIndex);
      renderRosterGrid();
    });

    // Actualizar conteos en badges de filtros
    updateFilterCounts();

    // Dino pedido en la dirección (?dino=id, desde el juego) o el Tyrannosaurus Rex
    const pedido = new URLSearchParams(location.search).get('dino');
    let startIdx = pedido ? state.dinos.findIndex(d => d.id === pedido) : -1;
    if (startIdx < 0) startIdx = state.dinos.findIndex(d => d.id === 'tyrannosaurus_rex');
    selectDinoByIndex(Math.max(0, startIdx));

    renderRosterGrid();
  }

  function updateFilterCounts() {
    const counts = { todos: state.dinos.length };
    state.dinos.forEach(d => {
      const el = d.element || 'normal';
      counts[el] = (counts[el] || 0) + 1;
    });

    document.querySelectorAll('.element-filter-btn').forEach(btn => {
      const elKey = btn.dataset.element;
      const numSpan = btn.querySelector('.badge-num');
      if (numSpan && counts[elKey] !== undefined) {
        numSpan.textContent = counts[elKey];
      }
    });

    const p = progreso();
    const totalBadge = document.getElementById('telemetry-counter');
    if (totalBadge) totalBadge.textContent = `${p.encontradas.length} / ${state.dinos.length}`;
    const guard = document.getElementById('telemetry-guardianes');
    if (guard && window.CartasIsla) guard.textContent = `${p.guardianes.length} / ${Object.keys(window.CartasIsla.GUARDIANES).length}`;
  }

  // Progreso de la isla (cartas encontradas y guardianes vencidos), compartido con el modo juego
  function progreso() {
    return window.CartasIsla ? window.CartasIsla.leer() : { encontradas: [], guardianes: [] };
  }

  function chibiUrl(dino) {
    return `/assets/chibi/dinos/${dino.element || 'normal'}/${dino.id}.png`;
  }

  // Estado de una carta en la colección: 'encontrada' | 'escondida' | 'sellada'
  function estadoCarta(dino, p = progreso()) {
    if (p.encontradas.includes(dino.id)) return 'encontrada';
    if (window.CartasIsla && window.CartasIsla.sellada(dino.id, p)) return 'sellada';
    return 'escondida';
  }

  // -------------------------------------------------------------
  // SELECCIÓN Y RENDERIZADO DEL DINOSAURIO ACTIVO
  // -------------------------------------------------------------
  function selectDinoByIndex(index) {
    if (index < 0) index = state.dinos.length - 1;
    if (index >= state.dinos.length) index = 0;

    state.activeDinoIndex = index;
    const dino = state.dinos[index];
    state.activeDino = dino;

    applyDinoToUI(dino, index);
  }

  // Mapeo de Fondos de Pantalla HD por Elemento
  const ELEMENT_WALLPAPERS = {
    fuego: '/assets/dinos/fondos/fondo_fuego.jpg',
    agua: '/assets/dinos/fondos/fondo_agua.jpg',
    rayo: '/assets/dinos/fondos/fondo_rayo.jpg',
    tierra: '/assets/dinos/fondos/fondo_tierra.jpg',
    planta: '/assets/dinos/fondos/fondo_planta.jpg',
    viento: '/assets/dinos/fondos/fondo_viento.jpg',
    especial: '/assets/dinos/fondos/fondo_especial.jpg',
    normal: '/assets/dinos/fondos/fondo_normal.jpg'
  };

  function applyDinoToUI(dino, index) {
    const elKey = dino.element || 'fuego';
    const elInfo = (state.elements && state.elements[elKey]) || { name: elKey, icon: '🦖', color: '#ef4444' };
    const loreData = DINO_LORE_DATABASE[elKey] || DINO_LORE_DATABASE.fuego;

    // Cambiar tema del body para sincronizar los colores del chasis
    document.body.className = `theme-${elKey}`;

    // Actualizar Fondo de Pantalla Elemental Ambiental y Backdrop 2D
    const wpUrl = ELEMENT_WALLPAPERS[elKey] || ELEMENT_WALLPAPERS.fuego;
    const bgWp = document.getElementById('elemental-wallpaper');
    if (bgWp) bgWp.style.backgroundImage = `url('${wpUrl}')`;
    const artBackdrop = document.getElementById('art-2d-backdrop');
    if (artBackdrop) artBackdrop.style.backgroundImage = `url('${wpUrl}')`;

    // 1. Cabecera y Telemetría
    const numStr = `DK-${String(index + 1).padStart(3, '0')}`;
    const dinoNumEl = document.getElementById('reading-dino-num');
    if (dinoNumEl) dinoNumEl.textContent = `REGISTRO ${numStr} // REF: ${dino.id.toUpperCase()}`;

    const dinoNameEl = document.getElementById('reading-dino-name');
    if (dinoNameEl) dinoNameEl.textContent = dino.name.toUpperCase();

    const navCounterEl = document.getElementById('reading-nav-counter');
    if (navCounterEl) navCounterEl.textContent = `${index + 1} / ${state.dinos.length}`;

    // Taxonomía y rareza
    const sizeName = SIZE_TEXTS[dino.size] || `Escala ${dino.size}`;
    const taxEl = document.getElementById('reading-taxonomy');
    if (taxEl) taxEl.textContent = `Afinidad: ${elInfo.name} · ${sizeName}`;

    const C = window.CartasIsla, p = progreso(), estado = estadoCarta(dino, p);
    const nivelKey = C ? C.nivel(dino.id) : 'comun', nv = C ? C.NIVELES[nivelKey] : { nombre: 'Común', icono: '⚪', color: '#a8a29e' };
    const starsEl = document.getElementById('reading-rarity-stars');
    if (starsEl) {
      const starCount = { comun: 1, rara: 2, epica: 3, legendaria: 4, mitica: 5 }[nivelKey] || 1;
      starsEl.textContent = '⭐'.repeat(starCount);
      starsEl.title = `Carta ${nv.nombre}`;
    }

    // Estado en la colección de la isla
    const estadoEl = document.getElementById('coleccion-estado');
    if (estadoEl) {
      const chip = `<span class="nivel-chip" style="background:${nv.color}">${nv.icono} ${nv.nombre}</span>`;
      const zona = C && state.ocultas[dino.id] ? C.ZONAS[state.ocultas[dino.id]] : 'algún rincón de la isla';
      let txt;
      if (estado === 'encontrada') txt = '✅ En tu colección';
      else if (estado === 'sellada') txt = `🔒 Sellada: ${C.textoRequisito(dino.id, p)}. Hasta entonces el Dino Lector no la detecta.`;
      else txt = `📍 Escondida en ${zona}. Búscala con el Dino Lector de mano.`;
      estadoEl.className = `coleccion-estado ${estado}`;
      estadoEl.innerHTML = `${chip}<span>${txt}</span>`;
    }
    // Sin la carta: estadísticas, técnicas y notas de campo ocultas (y su técnica estrella)
    const tiene = estado === 'encontrada';
    const grid = document.querySelector('.reading-panels-grid');
    if (grid) grid.classList.toggle('hidden', !tiene);
    const bloqueado = document.getElementById('panel-bloqueado');
    if (bloqueado) bloqueado.classList.toggle('hidden', tiene);
    const sigOculto = document.getElementById('reading-sig-badge');
    if (sigOculto) sigOculto.classList.toggle('hidden', !tiene);
    renderCompanero(dino, tiene, p);

    const viewport = document.getElementById('card-viewport');
    if (viewport) {
      // Paisaje ilustrado del elemento detrás del dino (assets/dinos/fondos)
      viewport.style.setProperty('--fondo', `url('${ELEMENT_WALLPAPERS[elKey] || ELEMENT_WALLPAPERS.fuego}')`);
      viewport.classList.toggle('no-encontrada', estado !== 'encontrada');
      viewport.classList.toggle('sellada', estado === 'sellada');
    }

    // Ataque característico exclusivo badge
    const sigBadge = document.getElementById('reading-sig-badge');
    if (sigBadge) {
      if (dino.signatureAttack) {
        sigBadge.textContent = `⭐ ${dino.signatureAttack.name.toUpperCase()} (${dino.signatureAttack.power} PWR)`;
        sigBadge.title = dino.signatureAttack.description || 'Ataque característico exclusivo';
      } else {
        sigBadge.textContent = '⭐ ATAQUE CARACTERÍSTICO';
      }
    }

    // 2. Tarjeta Física (Frente y Reverso)
    const cardImg = document.getElementById('card-front-img');
    const artImg = document.getElementById('art-2d-img');

    // Rutas de imagen con normalización
    const cardPath = getAssetUrl(dino.card || dino.image || '');
    const artPath = getAssetUrl((dino.art && (dino.art.right || dino.art.left)) || dino.card || '');

    if (cardImg) cardImg.src = cardPath;
    // Pestaña "Chibi": el modelo chibi del mundo (en sombra si la carta aún no es tuya); si no tiene render, la ilustración
    if (artImg) { artImg.onerror = () => { artImg.onerror = null; artImg.src = artPath; }; artImg.src = chibiUrl(dino); }
    // Pestaña "Dino": la versión grande (todas miran a la derecha) si la carta es tuya; si no, la sombra chibi
    const arteDer = getAssetUrl((dino.art && dino.art.right) || dino.card || '');
    const chibiImg = document.getElementById('chibi-img');
    const chibiWrap = document.getElementById('chibi-wrapper');
    if (chibiWrap) chibiWrap.classList.toggle('grande', estado === 'encontrada');
    if (chibiImg) {
      chibiImg.onerror = () => { chibiImg.onerror = null; chibiImg.src = arteDer; };
      chibiImg.src = estado === 'encontrada' ? arteDer : chibiUrl(dino);
    }

    const cardCodeEl = document.getElementById('card-code-display');
    if (cardCodeEl) cardCodeEl.textContent = numStr;

    const cardElemEl = document.getElementById('card-element-display');
    if (cardElemEl) cardElemEl.textContent = `${elInfo.icon || '🦖'} ${elInfo.name.toUpperCase()}`;

    // 3. Insignia Elemental de Piedra
    const stoneIcon = document.getElementById('badge-stone-icon');
    const stoneName = document.getElementById('badge-stone-name');
    const advantageTag = document.getElementById('badge-advantage-tag');

    if (stoneIcon) stoneIcon.textContent = elInfo.icon || '💎';
    if (stoneName) stoneName.textContent = `PIEDRA ELEMENTAL: ${elInfo.name.toUpperCase()}`;
    if (advantageTag) advantageTag.textContent = `Ventaja: ${loreData.advantage || 'Equilibrio'}`;

    // 4. Estadísticas Base
    // stats: [hp, atk, def, spa, spd]
    const stats = dino.stats || [5, 5, 5, 5, 5];
    const hp = stats[0] || 5;
    const atk = stats[1] || 5;
    const def = stats[2] || 5;
    const spa = stats[3] || 5;
    const spd = stats[4] || 5;
    const totalPower = hp + atk + def + spa + spd;

    setStatBar('hp', hp);
    setStatBar('atk', atk);
    setStatBar('def', def);
    setStatBar('spa', spa);
    setStatBar('spd', spd);

    const totalStatPill = document.getElementById('total-stat-pill');
    if (totalStatPill) totalStatPill.textContent = `PODER TOTAL BASE: ${totalPower}`;

    // Métricas físicas
    const speedEl = document.getElementById('metric-speed');
    if (speedEl) speedEl.textContent = `${dino.speed || 5} / 10`;

    const sizeEl = document.getElementById('metric-size');
    if (sizeEl) sizeEl.textContent = sizeName;

    const affEl = document.getElementById('metric-affinity');
    if (affEl) affEl.textContent = loreData.affinity || elInfo.name;

    // 5. Ataques / Técnicas Compatibles
    renderAttacksList(dino, elKey);

    // 6. Análisis Paleontológico / Lore
    renderLoreText(dino, loreData, elInfo);

    // 8. Marcar tarjeta activa en la cuadrícula inferior
    updateActiveRosterCard(index);
  }

  // Panel Compañero: misión de vínculo única del dino, su progreso y el botón Invocar / Guardar en la carta
  const TIPOS_MISION = { caminar: '🚶 Caminar', jugar: '🎾 Jugar', alimentar: '🍖 Alimentar', mision: '📜 Misión', coleccion: '📚 Colección' };
  function renderCompanero(dino, tiene, p) {
    const panel = document.getElementById('panel-companero');
    const C = window.CartasIsla;
    if (!panel || !C) return;
    panel.classList.toggle('hidden', !tiene);
    if (!tiene) return;
    const req = C.requisitoVinculo(dino.id) || { tipo: 'mision', texto: 'Misión por definir' };
    const ev = C.estadoVinculo(dino.id, p);
    const invocado = p.invocado === dino.id;
    document.getElementById('mision-tipo').textContent = TIPOS_MISION[req.tipo] || '📜 Misión';
    document.getElementById('mision-texto').textContent = req.texto;
    const pill = document.getElementById('vinculo-pill');
    pill.textContent = ev.hecho ? '✅ Vínculo creado' : invocado ? '🐾 Te acompaña' : 'Sin vínculo';
    const barra = document.getElementById('mision-progreso');
    const detalle = document.getElementById('mision-detalle');
    if (ev.hecho) {
      barra.style.width = '100%';
      detalle.textContent = '¡Misión cumplida! Ya puede usarse en combate.';
    } else if (ev.medible) {
      barra.style.width = `${Math.min(100, (100 * ev.hechos) / ev.meta)}%`;
      const f = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`);
      detalle.textContent = `${f(ev.hechos)} de ${f(ev.meta)} caminando juntos${invocado ? '' : ' · invócalo para seguir'}`;
    } else {
      barra.style.width = '0%';
      detalle.textContent = invocado ? 'Te acompaña por la isla. Este tipo de misión se activará pronto.' : 'Invócalo para que te acompañe por la isla.';
    }
    const btn = document.getElementById('btn-invocar');
    btn.textContent = invocado ? '🌙 Guardar en la carta' : '✨ Invocar';
    btn.classList.toggle('guardar', invocado);
    btn.onclick = () => {
      if (invocado) C.guardarCompanero(); else C.invocar(dino.id);
      applyDinoToUI(state.activeDino, state.activeDinoIndex);
    };
  }

  function setStatBar(id, val) {
    const valEl = document.getElementById(`val-stat-${id}`);
    const barEl = document.getElementById(`bar-stat-${id}`);
    if (valEl) valEl.textContent = val;
    if (barEl) {
      // Máximo aproximado es 10
      const pct = Math.min(100, Math.max(15, (val / 10) * 100));
      barEl.style.width = `${pct}%`;
    }
  }

  function renderAttacksList(dino, elementKey) {
    const container = document.getElementById('attacks-list-container');
    if (!container) return;
    container.innerHTML = '';

    const pill = document.getElementById('attacks-count-pill');
    if (pill) pill.textContent = '3 TÉCNICAS';

    const typeIcons = {
      fisico: '💪',
      especial: '🔮',
      estado: '🌀'
    };

    // Obtener exactamente los 3 ataques configurados del dinosaurio
    const attackIds = Array.isArray(dino.attacks) ? dino.attacks : [];
    const attacks = attackIds.map(id => {
      if (dino.signatureAttack && dino.signatureAttack.id === id) return dino.signatureAttack;
      if (Array.isArray(state.attacks)) return state.attacks.find(a => a.id === id);
      return state.attacks[id];
    }).filter(Boolean);

    // Fallback si no tuviera dino.attacks
    if (attacks.length === 0 && dino.signatureAttack) {
      attacks.push(dino.signatureAttack);
    }

    attacks.forEach(atk => {
      const chip = document.createElement('div');
      const isDefinitivo = (atk.cooldown === 4 || atk.tier === 'definitivo' || atk.isSignature);
      const isPotente = (atk.cooldown === 1 || atk.tier === 'potente');

      let chipClass = 'attack-card-chip';
      let tagText = '';
      let tagClass = '';

      if (isDefinitivo) {
        chipClass += ' tier-definitivo';
        tagText = '⭐ DEFINITIVO (SE ACTIVA CADA 4 TURNOS)';
        tagClass = 'tag-definitivo';
      } else if (isPotente) {
        chipClass += ' tier-potente';
        tagText = '💥 POTENTE (RECARGA: 1 TURNO / NO CONSECUTIVO)';
        tagClass = 'tag-potente';
      } else {
        chipClass += ' tier-basico';
        tagText = '♾️ BÁSICO (SIEMPRE DISPONIBLE A CADA RATO)';
        tagClass = 'tag-basico';
      }

      chip.className = chipClass;
      const icon = typeIcons[atk.category] || '⚡';

      chip.innerHTML = `
        <div class="atk-chip-left">
          <span class="atk-type-icon">${icon}</span>
          <div class="atk-chip-info">
            <div class="atk-title-row">
              <span class="atk-chip-name">${atk.name}</span>
              <span class="atk-tier-tag ${tagClass}">${tagText}</span>
            </div>
            <span class="atk-chip-sub">${atk.description || ''}</span>
          </div>
        </div>
        <span class="atk-power-badge">${atk.power || 0} PWR</span>
      `;

      container.appendChild(chip);
    });
  }

  function renderLoreText(dino, loreData, elInfo) {
    const loreEl = document.getElementById('reading-lore-text');
    if (!loreEl) return;

    const templates = loreData.loreTemplates || [];
    const hash = Array.from(dino.id).reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const selectedTemplate = templates[hash % templates.length] || templates[0];

    loreEl.innerHTML = `
      <strong>Lectura Biométrica de ${dino.name}:</strong> ${selectedTemplate}
      <br><br>
      <small>
        🏝️ En la isla: ${state.ocultas[dino.id] && window.CartasIsla ? window.CartasIsla.ZONAS[state.ocultas[dino.id]] : 'en algún rincón'} ·
        Hábitat original: ${loreData.habitats ? loreData.habitats.join(' / ') : 'Región Silvestre'}
      </small>
    `;
  }

  function getAssetUrl(relPath) {
    if (!relPath) return '';
    if (relPath.startsWith('http://') || relPath.startsWith('https://')) return relPath;
    let clean = relPath.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
    if (!clean.startsWith('assets/')) {
      clean = 'assets/dinos/' + clean;
    }
    return '/' + clean;
  }

  // -------------------------------------------------------------
  // CARROUSEL / CUADRÍCULA DEL ROSTER (POKÉDEX INFERIOR)
  // -------------------------------------------------------------
  function renderRosterGrid() {
    const container = document.getElementById('cards-grid-container');
    if (!container) return;
    container.innerHTML = '';

    const query = state.searchQuery.trim().toLowerCase();
    const filter = state.activeElementFilter;

    let filtered = state.dinos.filter((d, idx) => {
      d.__index = idx;
      if (filter !== 'todos' && d.element !== filter) return false;
      if (state.coleccion !== 'todas') {
        const tiene = progreso().encontradas.includes(d.id);
        if ((state.coleccion === 'encontradas') !== tiene) return false;
      }
      if (query) {
        const matchesName = d.name.toLowerCase().includes(query);
        const matchesId = d.id.toLowerCase().includes(query);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });

    // Ordenar
    if (state.sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (state.sortBy === 'power') {
      filtered.sort((a, b) => {
        const pA = (a.stats || []).reduce((s, v) => s + v, 0);
        const pB = (b.stats || []).reduce((s, v) => s + v, 0);
        return pB - pA;
      });
    } else if (state.sortBy === 'speed') {
      filtered.sort((a, b) => (b.speed || 0) - (a.speed || 0));
    } else if (state.sortBy === 'size') {
      filtered.sort((a, b) => (b.size || 0) - (a.size || 0));
    }

    const countDisplay = document.getElementById('roster-count-display');
    if (countDisplay) countDisplay.textContent = `${filtered.length} Dinos`;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:20px;">No se encontraron tarjetas con esos filtros.</div>';
      return;
    }

    const elementColors = {
      fuego: '#ef4444',
      agua: '#0ea5e9',
      rayo: '#eab308',
      tierra: '#d97706',
      planta: '#10b981',
      viento: '#a855f7',
      especial: '#ec4899',
      normal: '#94a3b8'
    };

    const p = progreso();
    const fondos = { fuego: '#fee2e2', agua: '#e0f2fe', rayo: '#fef9c3', tierra: '#ffedd5', planta: '#dcfce7', viento: '#e0f2fe', especial: '#fae8ff', normal: '#f5f5f4' };
    filtered.forEach(d => {
      const item = document.createElement('div');
      const estado = estadoCarta(d, p);
      item.className = `roster-card-item ${estado}${estado !== 'encontrada' ? ' no-encontrada' : ''}`;
      item.style.setProperty('--fondo-elem', fondos[d.element] || '#f5f5f4');
      item.style.setProperty('--color-elem', elementColors[d.element] || '#a8a29e');
      item.style.setProperty('--fondo-img', `url('${ELEMENT_WALLPAPERS[d.element] || ELEMENT_WALLPAPERS.normal}')`);
      item.dataset.index = d.__index;

      if (d.__index === state.activeDinoIndex) {
        item.classList.add('active-dino');
      }

      // Encontrada: dino grande (todos mirando a la derecha). Sin encontrar: sombra chibi
      const arteDer = getAssetUrl((d.art && d.art.right) || d.card || d.image || '');
      const imgPath = estado === 'encontrada' ? arteDer : chibiUrl(d), cartaPath = arteDer;
      const nv = window.CartasIsla ? window.CartasIsla.NIVELES[window.CartasIsla.nivel(d.id)] : null;
      const elColor = elementColors[d.element] || '#fff';

      item.innerHTML = `
        <div class="roster-card-img-box">
          <img src="${imgPath}" alt="${d.name}" loading="lazy" onerror="this.onerror=null;this.src='${cartaPath}'">
        </div>
        <div class="roster-card-footer">
          ${nv ? `<span class="roster-nivel" style="background:${nv.color}" title="Carta ${nv.nombre}">${nv.icono} ${nv.nombre}</span>` : ''}
          <span class="roster-card-name">${d.name}</span>
          <div class="roster-card-meta">
            <span>DK-${String(d.__index + 1).padStart(3, '0')}</span>
            <span class="roster-card-element-dot" style="background:${elColor};"></span>
          </div>
        </div>
      `;

      item.onclick = () => {
        selectDinoByIndex(d.__index);
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      };

      container.appendChild(item);
    });
  }

  function updateActiveRosterCard(activeIdx) {
    document.querySelectorAll('.roster-card-item').forEach(card => {
      if (parseInt(card.dataset.index, 10) === activeIdx) {
        card.classList.add('active-dino');
      } else {
        card.classList.remove('active-dino');
      }
    });
  }

  // -------------------------------------------------------------
  // EFECTO DE PERSPECTIVA 3D EN LA TARJETA
  // -------------------------------------------------------------
  function setupCardTilt() {
    const wrapper = document.getElementById('card-3d-wrapper');
    const viewport = document.getElementById('card-viewport');
    if (!wrapper || !viewport) return;

    viewport.addEventListener('mousemove', (e) => {
      if (state.viewMode !== 'card') return;
      const rect = viewport.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      const rotY = (x / (rect.width / 2)) * 18;
      const rotX = -(y / (rect.height / 2)) * 18;

      wrapper.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.03, 1.03, 1.03)`;
    });

    viewport.addEventListener('mouseleave', () => {
      wrapper.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    });
  }

  // -------------------------------------------------------------
  // SELECTOR DE MODO DE VISTA (TARJETA / ARTE 2D)
  // -------------------------------------------------------------
  function setViewMode(mode) {
    state.viewMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t => {
      if (t.dataset.mode === mode) t.classList.add('active');
      else t.classList.remove('active');
    });

    const cardWrap = document.getElementById('card-3d-wrapper');
    const artWrap = document.getElementById('art-2d-wrapper');
    const chibiWrap = document.getElementById('chibi-wrapper');

    if (chibiWrap) chibiWrap.classList.toggle('hidden', mode !== 'chibi');
    if (cardWrap) cardWrap.classList.toggle('hidden', mode !== 'card');
    if (artWrap) artWrap.classList.toggle('hidden', mode !== 'art');

  }

  // -------------------------------------------------------------
  // VISUALIZADOR DE ONDA SONORA / RUGIDO (CANVAS EQUALIZER)
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  // MODAL DE INVOCACIÓN ÉPICA (DINO SLASH)
  // -------------------------------------------------------------


  // -------------------------------------------------------------
  // MODAL DE FONDO DE PANTALLA ELEMENTAL HD
  // -------------------------------------------------------------


  // -------------------------------------------------------------
  // EVENT LISTENERS Y ENLACES
  // -------------------------------------------------------------
  function setupEventListeners() {
    setupCardTilt();

    // Botones de Navegación Anterior / Siguiente
    const prevBtn = document.getElementById('btn-nav-prev');
    const nextBtn = document.getElementById('btn-nav-next');
    if (prevBtn) prevBtn.onclick = () => selectDinoByIndex(state.activeDinoIndex - 1);
    if (nextBtn) nextBtn.onclick = () => selectDinoByIndex(state.activeDinoIndex + 1);

    // Abierto como ventana flotante sobre el juego: "Volver a la isla" y Esc solo cierran la ventana
    const enModal = window.self !== window.top;
    const cerrarModal = () => window.parent.postMessage('cerrar-dino-lector', location.origin);
    const volver = document.getElementById('btn-volver-isla');
    if (volver && enModal) volver.onclick = (e) => { e.preventDefault(); cerrarModal(); };
    if (enModal) window.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });

    // Filtro del álbum por colección
    const colSelect = document.getElementById('select-coleccion');
    if (colSelect) colSelect.onchange = (e) => { state.coleccion = e.target.value; renderRosterGrid(); };

    // Tabs de modo de vista
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.onclick = () => setViewMode(tab.dataset.mode);
    });

    // Filtros de Elementos
    document.querySelectorAll('.element-filter-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.element-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeElementFilter = btn.dataset.element;
        renderRosterGrid();
      };
    });

    // Búsqueda
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    if (searchInput) {
      searchInput.oninput = (e) => {
        state.searchQuery = e.target.value;
        if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
        renderRosterGrid();
      };
    }
    if (clearSearchBtn && searchInput) {
      clearSearchBtn.onclick = () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderRosterGrid();
      };
    }

    // Ordenamiento
    const sortSelect = document.getElementById('select-sort');
    if (sortSelect) {
      sortSelect.onchange = (e) => {
        state.sortBy = e.target.value;
        renderRosterGrid();
      };
    }

    // Navegación por teclado
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectDinoByIndex(state.activeDinoIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectDinoByIndex(state.activeDinoIndex + 1);
      }
    });
  }

})();

