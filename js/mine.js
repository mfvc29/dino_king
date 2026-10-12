/**
 * MineSystem - Exploración de la Cueva Meteoro por pisos (estilo Stardew Valley) y Taller para
 * fabricar objetos con lo que encuentras (estilo Leyendas Pokémon: Arceus).
 *
 * - Cada piso es un mapa con "mine" en su JSON (lo crea tools/generar_rutas.py).
 * - Al entrar a un piso aparecen rocas al azar. Con el pico (Rose lo regala en el piso 1) se rompen con
 *   Espacio/E: dan minerales y gemas, a veces sale un dino salvaje, y una esconde la escalera al piso siguiente.
 * - Rocas duras / bloques de hielo (pisos profundos): sólo con el Pico Reforzado.
 * - Gemas ocultas: brillan sólo cuando estás cerca (la linterna amplía el radio). Se guardan al recogerlas.
 * - Pisos oscuros: sólo se ve alrededor del jugador (la Linterna de Cristal ilumina más).
 * - Más profundo = dinos salvajes más raros y de más nivel.
 * - Los objetos de elemento de la Mochila (Colmillo Volcánico, Perla del Lago...) también entran al
 *   Taller: los repetidos se funden en la gema de su elemento y con uno de cada se hace el Talismán.
 */

// Materiales: tile = gema de Caves.png (fila 8) para dibujarla; img = la misma gema como objeto del constructor
const MINE_MATERIALS = {
    fragmento:  { name: 'Fragmento de Meteorito', icon: '🪨', desc: 'Sale de casi cualquier roca.' },
    cuarzo:     { name: 'Cuarzo', icon: '🔹', desc: 'Mineral común de las rocas.' },
    ambar:      { name: 'Ámbar', icon: '🟠', desc: 'Resina fósil. Rocas de los pisos de tierra.', element: 'tierra' },
    rubi:       { name: 'Rubí', tile: [8, 1], img: 'gema_roja', element: 'fuego' },
    topacio:    { name: 'Topacio', tile: [8, 2], img: 'gema_amarilla', element: 'rayo' },
    esmeralda:  { name: 'Esmeralda', tile: [8, 3], img: 'gema_verde', element: 'planta' },
    aguamarina: { name: 'Aguamarina', tile: [8, 4], img: 'gema_celeste', element: 'agua' },
    amatista:   { name: 'Amatista', tile: [8, 5], img: 'gema_morada', element: 'especial' },
    opalo:      { name: 'Ópalo Rosa', tile: [8, 6], img: 'gema_rosa', element: 'viento' },
    nucleo:     { name: 'Núcleo de Meteorito', icon: '☄️', desc: 'Rarísimo: sólo en lo más profundo.' }
};

// Objetos de un solo uso (cansancio, escape, cebo). heal = cuánto cansancio quitan; scope = equipo o todos
const MINE_ITEMS = {
    baya_vigor:      { name: 'Baya Vigor', icon: '🫐', heal: 40, scope: 'team', desc: 'Quita 40% de cansancio a tu equipo. Crece en la hierba alta.' },
    hongo_luminoso:  { name: 'Hongo Luminoso', icon: '🍄', heal: 30, scope: 'team', desc: 'Quita 30% de cansancio a tu equipo. Crece en la cueva.' },
    tonico_jurasico: { name: 'Tónico Jurásico', icon: '🧪', heal: 100, scope: 'team', desc: 'Tu equipo queda totalmente descansado.' },
    elixir_meteoro:  { name: 'Elixir de Meteorito', icon: '✨', heal: 100, scope: 'all', desc: 'TODOS tus dinos (equipo y almanaque) quedan descansados.' },
    cuerda:          { name: 'Cuerda de Escape', icon: '🧵', desc: 'Te saca de la cueva al instante.' },
    cebo:            { name: 'Cebo de Ámbar', icon: '🍖', desc: 'El próximo dino salvaje será LEGENDARIO.' }
};

// Objetos de elemento de la Mochila (EQUIP_ITEMS de js/cards.js): al fundirlos dan la gema de su elemento
const BAG_GEMS = {
    colmillo_volcanico: 'rubi',
    perla_lago: 'aguamarina',
    cuerno_tormenta: 'topacio',
    fosil_ambar: 'ambar',
    hoja_milenaria: 'esmeralda',
    pluma_ciclon: 'opalo',
    garra_ancestral: 'amatista'
};

// Rocas por tema de cueva (losas de Caves.png)
const MINE_THEMES = {
    brown: { rock: [21, 5], hard: [22, 6], ladder: [19, 5], gems: ['rubi', 'topacio', 'esmeralda'], amber: true },
    snow:  { rock: [84, 5], hard: [90, 7], ladder: [82, 5], gems: ['aguamarina', 'opalo', 'topacio'] },
    ice:   { rock: [120, 5], hard: [121, 6], ladder: [118, 5], gems: ['aguamarina', 'amatista', 'opalo'] }
};

// Rareza de los dinos salvajes de la cueva según la suma de sus estadísticas
const MINE_RARITY = [
    { id: 'comun', label: 'Común', min: 0 },
    { id: 'raro', label: '✨ RARO', min: 30 },
    { id: 'legendario', label: '🌟 LEGENDARIO', min: 34 }
];
// Probabilidad (%) de común / raro / legendario en cada piso
const MINE_RARITY_BY_FLOOR = [null, [80, 18, 2], [70, 25, 5], [55, 35, 10], [45, 40, 15], [30, 45, 25], [20, 45, 35]];

// Recetas del Taller
const MINE_RECIPES = [
    { id: 'pico_reforzado', kind: 'tool', icon: '⛏️', name: 'Pico Reforzado',
      desc: 'Rompe las rocas de un golpe y también las rocas duras y el hielo de los pisos profundos.',
      cost: { fragmento: 8, cuarzo: 3, topacio: 1 }, requires: 'pico' },
    { id: 'linterna', kind: 'tool', icon: '🔦', name: 'Linterna de Cristal',
      desc: 'Ilumina más en los pisos oscuros y deja ver las gemas ocultas desde más lejos.',
      cost: { cuarzo: 4, topacio: 2 } },
    { id: 'radar', kind: 'tool', icon: '📡', name: 'Radar de Cristales',
      desc: 'Muestra todas las gemas ocultas del piso en el que estás.',
      cost: { amatista: 2, aguamarina: 2, nucleo: 1 } },
    { id: 'tonico_jurasico', kind: 'consumable', icon: '🧪', name: 'Tónico Jurásico',
      desc: 'Combina bayas y un hongo: tu equipo queda totalmente descansado (un solo uso).',
      cost: { baya_vigor: 2, hongo_luminoso: 1 } },
    { id: 'elixir_meteoro', kind: 'consumable', icon: '✨', name: 'Elixir de Meteorito',
      desc: 'Descansa a TODOS tus dinos, también los del almanaque (un solo uso).',
      cost: { tonico_jurasico: 1, ambar: 1, cuarzo: 2 } },
    { id: 'cuerda', kind: 'consumable', icon: '🧵', name: 'Cuerda de Escape',
      desc: 'Te saca de la cueva al instante (a la entrada, en la Ruta 1).', cost: { fragmento: 3 } },
    { id: 'cebo', kind: 'consumable', icon: '🍖', name: 'Cebo de Ámbar',
      desc: 'El próximo dino salvaje que aparezca será LEGENDARIO.', cost: { ambar: 2, cuarzo: 1 } },
    { id: 'amuleto_fuego', kind: 'equip', icon: '💎', name: 'Amuleto de Rubí', desc: '+12 a ataques de Fuego.', cost: { rubi: 3, fragmento: 2 } },
    { id: 'amuleto_agua', kind: 'equip', icon: '💎', name: 'Amuleto de Aguamarina', desc: '+12 a ataques de Agua.', cost: { aguamarina: 3, fragmento: 2 } },
    { id: 'amuleto_rayo', kind: 'equip', icon: '💎', name: 'Amuleto de Topacio', desc: '+12 a ataques de Rayo.', cost: { topacio: 3, fragmento: 2 } },
    { id: 'amuleto_tierra', kind: 'equip', icon: '💎', name: 'Amuleto de Ámbar', desc: '+12 a ataques de Tierra.', cost: { ambar: 3, fragmento: 2 } },
    { id: 'amuleto_planta', kind: 'equip', icon: '💎', name: 'Amuleto de Esmeralda', desc: '+12 a ataques de Planta.', cost: { esmeralda: 3, fragmento: 2 } },
    { id: 'amuleto_viento', kind: 'equip', icon: '💎', name: 'Amuleto de Ópalo', desc: '+12 a ataques de Viento.', cost: { opalo: 3, fragmento: 2 } },
    { id: 'amuleto_especial', kind: 'equip', icon: '💎', name: 'Amuleto de Amatista', desc: '+12 a ataques Especiales.', cost: { amatista: 3, fragmento: 2 } },
    { id: 'talisman_siete', kind: 'equip', icon: '🧿', name: 'Talismán de los Siete',
      desc: '+8 a los ataques de TODOS los elementos (menos Normal): ideal para un equipo variado. Lleva un objeto de cada elemento de la Mochila.',
      cost: { colmillo_volcanico: 1, perla_lago: 1, cuerno_tormenta: 1, fosil_ambar: 1, hoja_milenaria: 1, pluma_ciclon: 1, garra_ancestral: 1 } },
    { id: 'elixir_nucleo', kind: 'consumable', icon: '☄️', name: 'Elixir de Núcleo',
      desc: 'Con la energía del meteorito: TODOS tus dinos quedan descansados (un solo uso).',
      cost: { nucleo: 1, rubi: 1, aguamarina: 1, topacio: 1 }, gives: 'elixir_meteoro' }
];

const MINE_ROCK_HP = { rock: 2, ore: 3, hard: 4 };

class MineSystem {
    constructor(game) {
        this.game = game;
        this.reset();
        this.cfg = null;       // "mine" del piso actual (null fuera de la cueva)
        this.rocks = [];       // [{ col, row, kind: 'rock'|'ore'|'hard', hp, ladder, gem, shake }]
        this.ladder = null;    // escalera descubierta en este piso { col, row }
        this.lastStepKey = null;
    }

    // ------------------------------------------------------------
    // Persistencia (se guarda junto con la partida)
    // ------------------------------------------------------------
    reset() {
        this.tools = {};          // pico, pico_reforzado, linterna, radar -> true
        this.materials = {};      // material -> cantidad
        this.consumables = {};    // cuerda, cebo -> cantidad
        this.foundGems = [];      // ids de gemas ocultas ya recogidas
        this.deepest = 0;         // piso más profundo alcanzado
        this.lure = false;        // Cebo de Ámbar activo
    }

    serialize() {
        return {
            tools: this.tools, materials: this.materials, consumables: this.consumables,
            foundGems: this.foundGems, deepest: this.deepest, lure: this.lure
        };
    }

    deserialize(data = {}) {
        this.reset();
        this.tools = data.tools || {};
        this.materials = data.materials || {};
        this.consumables = data.consumables || {};
        this.foundGems = Array.isArray(data.foundGems) ? data.foundGems : [];
        this.deepest = Number(data.deepest) || 0;
        this.lure = !!data.lure;
    }

    save() {
        if (this.game.saves) this.game.saves.autoSave();
    }

    /** Suma un material u objeto de un solo uso. */
    addItem(id, n = 1) {
        const bucket = MINE_ITEMS[id] ? this.consumables : this.materials;
        bucket[id] = (bucket[id] || 0) + n;
        this.save();
    }

    count(id) {
        if (EQUIP_ITEMS[id]) return this.bagAvailable(id);
        return (MINE_ITEMS[id] ? this.consumables[id] : this.materials[id]) || 0;
    }

    /** Objetos de la Mochila que se pueden gastar en el Taller (el equipado no se toca). */
    bagAvailable(id) {
        const cards = this.game.cards;
        return Math.max(0, (cards.bag[id] || 0) - (cards.equippedItem === id ? 1 : 0));
    }

    itemName(id) {
        return (MINE_ITEMS[id] || MINE_MATERIALS[id] || EQUIP_ITEMS[id] || { name: id }).name;
    }

    itemIcon(id) {
        return (MINE_ITEMS[id] || MINE_MATERIALS[id] || EQUIP_ITEMS[id] || { icon: '❔' }).icon || '💎';
    }

    hasTool(id) {
        return !!this.tools[id] || (id === 'pico' && !!this.tools.pico_reforzado);
    }

    get floor() {
        return this.cfg ? this.cfg.floor : 0;
    }

    get theme() {
        return MINE_THEMES[(this.cfg && this.cfg.theme) || 'brown'] || MINE_THEMES.brown;
    }

    // ------------------------------------------------------------
    // Al entrar a un mapa
    // ------------------------------------------------------------
    onMapLoaded() {
        const tm = this.game.tileMap;
        this.cfg = tm.mine || null;
        this.rocks = [];
        this.ladder = null;
        this.lastStepKey = null;
        if (!this.cfg) return;

        if (this.cfg.floor > this.deepest) {
            this.deepest = this.cfg.floor;
            this.save();
        }
        this.spawnRocks();
        this.game.refreshNpcBlockers();
        if (this.cfg.floor > 1 && !this.hasTool('pico')) {
            this.game.notifyStatus('🪨 Sin pico no podrás romper las rocas. Rose, en la entrada de la cueva, tiene uno.');
        }
    }

    /** Rocas al azar en el suelo, sin tapar nunca el paso (todo el piso sigue siendo alcanzable). */
    spawnRocks() {
        const tm = this.game.tileMap;
        const cfg = this.cfg;
        const spawn = tm.spawn || { x: 0, y: 0 };
        const blocked = new Set(tm.npcBlockers || []);
        const gems = new Set((cfg.hiddenGems || []).map(g => `${g.x},${g.y}`));
        const warps = new Set((tm.warps || []).map(w => `${w.x},${w.y}`));
        const free = (c, r) => c >= 0 && r >= 0 && c < tm.cols && r < tm.rows && !tm.solidGrid[r][c] && !blocked.has(`${c},${r}`);

        const reach = () => {
            const seen = new Set([`${spawn.x},${spawn.y}`]);
            const q = [[spawn.x, spawn.y]];
            while (q.length) {
                const [c, r] = q.pop();
                for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const k = `${c + dc},${r + dr}`;
                    if (!seen.has(k) && free(c + dc, r + dr)) { seen.add(k); q.push([c + dc, r + dr]); }
                }
            }
            return seen;
        };

        const base = reach();
        const cells = [...base]
            .map(k => k.split(',').map(Number))
            .filter(([c, r]) => Math.abs(c - spawn.x) + Math.abs(r - spawn.y) > 3 && !gems.has(`${c},${r}`) && !warps.has(`${c},${r}`));
        for (let i = cells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cells[i], cells[j]] = [cells[j], cells[i]];
        }

        const want = cfg.rocks || 15;
        const oreChance = 0.1 + cfg.floor * 0.02;
        for (const [c, r] of cells) {
            if (this.rocks.length >= want) break;
            blocked.add(`${c},${r}`);
            // La roca no puede dejar zonas encerradas
            if (reach().size !== base.size - this.rocks.length - 1) {
                blocked.delete(`${c},${r}`);
                continue;
            }
            const roll = Math.random();
            const kind = roll < (cfg.hard || 0) ? 'hard' : (roll < (cfg.hard || 0) + oreChance ? 'ore' : 'rock');
            const gem = kind === 'ore' ? this.theme.gems[Math.floor(Math.random() * this.theme.gems.length)] : null;
            this.rocks.push({ col: c, row: r, kind, hp: MINE_ROCK_HP[kind], ladder: false, gem, shake: 0 });
        }
        // Una roca esconde la escalera al piso siguiente
        if (cfg.next && this.rocks.length) {
            this.rocks[Math.floor(Math.random() * this.rocks.length)].ladder = true;
        }
    }

    blockerKeys() {
        return this.rocks.map(r => `${r.col},${r.row}`);
    }

    /** Si una roca quedó justo donde aparece el jugador (partida guardada), se quita. */
    clearAt(col, row) {
        const before = this.rocks.length;
        this.rocks = this.rocks.filter(r => !(r.col === col && r.row === row) || r.ladder);
        if (this.rocks.length !== before) this.game.refreshNpcBlockers();
    }

    // ------------------------------------------------------------
    // Romper rocas (Espacio / E frente a una roca)
    // ------------------------------------------------------------
    tryHit(col, row) {
        const rock = this.rocks.find(r => r.col === col && r.row === row);
        if (!rock) return false;
        if (!this.hasTool('pico')) {
            this.game.notifyStatus('🪨 Una roca... Necesitas un pico. Rose, en la entrada de la cueva, tiene uno.');
            return true;
        }
        const strong = this.hasTool('pico_reforzado');
        const ice = this.cfg.theme === 'ice';
        // Un dino de Fuego derrite el hielo y uno de Tierra rompe las rocas duras (de un golpe)
        const helper = rock.kind === 'hard' && this.game.field.has(ice ? 'fuego' : 'tierra');
        if (rock.kind === 'hard' && !strong && !helper) {
            this.game.notifyStatus(ice
                ? '🧊 Este hielo es demasiado duro. Un dino de 🔥 Fuego en tu equipo lo derretiría (o fabrica el Pico Reforzado).'
                : '🪨 Esta roca es demasiado dura. Un dino de ⛰️ Tierra en tu equipo la rompería (o fabrica el Pico Reforzado).');
            return true;
        }
        if (helper) {
            rock.hp = 0;
            this.game.notifyStatus(ice ? '🔥 ¡Tu dino de Fuego derritió el hielo!' : '⛰️ ¡Tu dino de Tierra partió la roca!');
        }
        rock.hp -= strong ? 2 : 1;
        rock.shake = 10;
        if (rock.hp > 0) return true;
        this.breakRock(rock);
        return true;
    }

    breakRock(rock) {
        this.rocks = this.rocks.filter(r => r !== rock);
        this.game.refreshNpcBlockers();

        const drops = this.rollDrops(rock);
        if (Math.random() < 0.08) drops.hongo_luminoso = 1;
        for (const [id, n] of Object.entries(drops)) this.addItem(id, n);
        const text = Object.entries(drops).map(([id, n]) => `+${n} ${this.itemName(id)}`).join(', ');

        if (rock.ladder) {
            this.revealLadder(rock.col, rock.row);
            this.game.notifyStatus(`🕳️ ¡Encontraste la escalera al piso ${this.floor + 1}! ${text ? `(${text})` : ''}`);
        } else if (this.game.cards.getTeam().length && Math.random() < 0.05 + this.floor * 0.01) {
            this.game.notifyStatus(`⚠️ ¡Un dino salvaje salió de la roca! ${text ? `(${text})` : ''}`);
            setTimeout(() => this.game.cards.startWildEncounter(), 400);
        } else if (text) {
            this.game.notifyStatus(`⛏️ ${text}`);
        }
        this.save();
    }

    rollDrops(rock) {
        const f = this.floor;
        const out = {};
        const add = (id, n = 1) => { out[id] = (out[id] || 0) + n; };
        const gem = () => this.theme.gems[Math.floor(Math.random() * this.theme.gems.length)];
        if (rock.kind === 'ore') {
            add(rock.gem);
            if (Math.random() < 0.2) add(gem());
            if (Math.random() < 0.4) add('cuarzo');
            if (f >= 5 && Math.random() < 0.05) add('nucleo');
        } else if (rock.kind === 'hard') {
            if (Math.random() < 0.6) add('cuarzo', 1 + (Math.random() < 0.4 ? 1 : 0));
            if (Math.random() < 0.6) add('fragmento', 1 + (Math.random() < 0.5 ? 1 : 0));
            if (Math.random() < 0.3) add(gem());
            if (f >= 6 && Math.random() < 0.06) add('nucleo');
        } else {
            if (Math.random() < 0.7) add('fragmento', 1 + (Math.random() < 0.3 ? 1 : 0));
            if (Math.random() < 0.3) add('cuarzo');
            if (this.theme.amber && Math.random() < 0.1) add('ambar');
            if (Math.random() < 0.05 + f * 0.015) add(gem());
        }
        if (!Object.keys(out).length) add('fragmento');
        return out;
    }

    revealLadder(col, row) {
        this.ladder = { col, row };
        const [x, y] = this.cfg.nextArrival || [0, 0];
        this.game.tileMap.warps.push({
            x: col, y: row, targetMap: this.cfg.next, targetX: x, targetY: y,
            desc: `Bajando al piso ${this.floor + 1}...`
        });
    }

    // ------------------------------------------------------------
    // Gemas ocultas (se recogen al pisarlas)
    // ------------------------------------------------------------
    onStep(col, row) {
        if (!this.cfg) return;
        const key = `${col},${row}`;
        if (key === this.lastStepKey) return;
        this.lastStepKey = key;
        const gem = (this.cfg.hiddenGems || []).find(g => g.x === col && g.y === row && !this.foundGems.includes(g.id));
        if (!gem) return;
        this.foundGems.push(gem.id);
        this.materials[gem.item] = (this.materials[gem.item] || 0) + 1;
        this.game.notifyStatus(`💎 ¡Encontraste una gema oculta: ${MINE_MATERIALS[gem.item].name}! (${this.foundGems.length} gemas ocultas en total)`);
        this.save();
    }

    get senseRadius() {
        return (this.hasTool('linterna') ? 4 : 2) + (this.game.field.has('rayo') ? 1 : 0);
    }

    // ------------------------------------------------------------
    // Dinos salvajes de la cueva (más profundo = más raros y fuertes)
    // ------------------------------------------------------------
    rarityOf(dino) {
        const total = (dino.stats || []).reduce((a, b) => a + b, 0);
        return [...MINE_RARITY].reverse().find(t => total >= t.min) || MINE_RARITY[0];
    }

    /** Elige el dino salvaje: { dino, levelBonus, tier }. Fuera de la cueva sólo cambia con el Cebo de Ámbar. */
    pickWild(dinos) {
        const byTier = id => dinos.filter(d => this.rarityOf(d).id === id);
        let tierId = null;
        if (this.lure) {
            tierId = 'legendario';
            this.lure = false;
            this.save();
        } else if (this.cfg) {
            const w = MINE_RARITY_BY_FLOOR[Math.min(this.floor, MINE_RARITY_BY_FLOOR.length - 1)] || [100, 0, 0];
            let roll = Math.random() * 100;
            tierId = roll < w[0] ? 'comun' : (roll < w[0] + w[1] ? 'raro' : 'legendario');
        }
        const pool = tierId ? byTier(tierId) : dinos;
        const list = pool.length ? pool : dinos;
        const dino = list[Math.floor(Math.random() * list.length)];
        return { dino, levelBonus: this.cfg ? this.floor - 1 : 0, tier: this.rarityOf(dino) };
    }

    /** Reglas de los objetos del suelo (antes incluían cartas de movimiento). */
    groundItemRules() {
        if (!this.cfg) return { moveChance: 0.35, strongOnly: false };
        return { moveChance: Math.min(0.8, 0.35 + this.floor * 0.08), strongOnly: this.floor >= 3 };
    }

    // ------------------------------------------------------------
    // Rose, guía de la cueva
    // ------------------------------------------------------------
    talkGuide(npc) {
        const g = this.game;
        if (!this.hasTool('pico')) {
            g.showDialogSequence([
                { speaker: npc.name, text: '¡Hola! Soy Rose, exploradora de cuevas. Esta cueva es mucho más profunda de lo que parece...\nHay pisos de tierra, de nieve y hasta de hielo, ¡y cuanto más bajas, más raros son los dinos y los tesoros!' },
                { speaker: npc.name, text: 'Toma mi Pico de Explorador. Ponte frente a una roca y pulsa Espacio (o E) para romperla.\nDan minerales y gemas... y una de ellas esconde la escalera al piso siguiente.' },
                { speaker: npc.name, text: 'Busca también las gemas ocultas: brillan sólo cuando estás muy cerca, en los rincones más escondidos.\nCon lo que juntes puedes fabricar herramientas y amuletos en el Taller (ENTER → ⛏️ Taller).' }
            ], () => {
                this.tools.pico = true;
                this.save();
                g.notifyStatus('⛏️ ¡Recibiste el Pico de Explorador! Rompe rocas con Espacio / E.');
            });
            return;
        }
        const shortcuts = Object.entries((this.cfg && this.cfg.shortcuts) || {})
            .filter(([floor]) => this.deepest >= Number(floor));
        if (shortcuts.length) {
            g.cards.showModal({
                title: '🛗 Atajo de Rose',
                message: `Llegaste hasta el piso ${this.deepest}. Conozco un atajo... ¿a dónde quieres bajar?`,
                buttons: [
                    ...shortcuts.map(([floor, [x, y]]) => ({
                        label: `⬇️ Piso ${floor}`, cls: 'win',
                        onClick: () => {
                            g.cards.closeModal();
                            g.triggerWarpTransition({ targetMap: `cueva_meteoro_${floor}`, targetX: x, targetY: y, desc: `Atajo al piso ${floor}` });
                        }
                    })),
                    { label: 'Seguir desde aquí', cls: 'flee', onClick: () => g.cards.closeModal() }
                ]
            });
            return;
        }
        const tips = [
            'Las rocas con un brillo de color son vetas: siempre sueltan una gema.',
            'En los pisos de nieve y hielo hay rocas duras. Con fragmentos, cuarzo y un topacio puedes fabricar el Pico Reforzado.',
            'Si te pierdes, una Cuerda de Escape te saca de la cueva al instante. Se fabrica con 3 fragmentos.',
            `Has llegado hasta el piso ${this.deepest}. Cuando llegues al piso 3 te enseño un atajo.`
        ];
        g.showDialog(npc.name, tips[Math.floor(Math.random() * tips.length)]);
    }

    // ------------------------------------------------------------
    // Dibujo
    // ------------------------------------------------------------
    drawTile(ctx, tile, x, y, size = 32) {
        const img = this.game.tileMap.getTilesetImage('caves');
        if (!img || !img.complete || !img.naturalWidth) return;
        ctx.drawImage(img, tile[1] * 32, tile[0] * 32, 32, 32, x, y, size, size);
    }

    /** Rocas, escalera y brillos (en coordenadas del mundo, antes de los personajes). */
    draw(ctx) {
        if (!this.cfg) return;
        const ts = this.game.tileMap.tileSize;
        const t = this.theme;
        if (this.ladder) this.drawTile(ctx, t.ladder, this.ladder.col * ts, this.ladder.row * ts, ts);

        for (const r of this.rocks) {
            let dx = 0;
            if (r.shake > 0) { dx = (r.shake % 2 ? 2 : -2); r.shake--; }
            const x = r.col * ts + dx, y = r.row * ts;
            this.drawTile(ctx, r.kind === 'hard' ? t.hard : t.rock, x, y, ts);
            if (r.kind === 'ore' && MINE_MATERIALS[r.gem].tile) {
                this.drawTile(ctx, MINE_MATERIALS[r.gem].tile, x + ts * 0.45, y + ts * 0.05, ts * 0.5);
                if (Math.floor(Date.now() / 300 + r.col) % 4 === 0) this.drawSparkle(ctx, x + ts * 0.75, y + ts * 0.15, 4);
            }
            if (r.hp < MINE_ROCK_HP[r.kind]) {
                ctx.strokeStyle = 'rgba(20, 10, 0, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x + ts * 0.3, y + ts * 0.3); ctx.lineTo(x + ts * 0.5, y + ts * 0.55); ctx.lineTo(x + ts * 0.7, y + ts * 0.45);
                ctx.stroke();
            }
        }

        // Gemas ocultas: sólo se ven de cerca (o siempre con el radar)
        const p = this.game.localPlayer;
        const pc = Math.floor(p.x / ts), pr = Math.floor(p.y / ts);
        const radar = this.hasTool('radar');
        for (const g of this.cfg.hiddenGems || []) {
            if (this.foundGems.includes(g.id)) continue;
            const dist = Math.abs(g.x - pc) + Math.abs(g.y - pr);
            if (!radar && dist > this.senseRadius) continue;
            const cx = g.x * ts + ts / 2, cy = g.y * ts + ts / 2;
            const pulse = 4 + Math.sin(Date.now() / 200 + g.x) * 2;
            ctx.save();
            ctx.globalAlpha = radar && dist > this.senseRadius ? 0.55 : 0.95;
            this.drawSparkle(ctx, cx, cy, pulse + 3);
            this.drawSparkle(ctx, cx - 7, cy + 6, pulse - 1);
            ctx.restore();
        }
    }

    drawSparkle(ctx, x, y, r) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 230, 0.95)';
        ctx.beginPath();
        ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.3, y + r * 0.3);
        ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y + r * 0.3); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.3, y - r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /** Oscuridad de los pisos profundos (en coordenadas de pantalla, sobre todo lo demás). */
    drawDarkness(ctx) {
        if (!this.cfg || !this.cfg.darkness) return;
        const cam = this.game.camera;
        const p = this.game.localPlayer;
        const ts = this.game.tileMap.tileSize;
        const radius = ((this.hasTool('linterna') ? 5.5 : 3.2) + (this.game.field.has('rayo') ? 2 : 0)) * ts * cam.zoom;
        const sx = (p.x - Math.floor(cam.x)) * cam.zoom;
        const sy = (p.y - 10 - Math.floor(cam.y)) * cam.zoom;
        const grad = ctx.createRadialGradient(sx, sy, radius * 0.3, sx, sy, radius);
        grad.addColorStop(0, 'rgba(4, 4, 12, 0)');
        grad.addColorStop(1, `rgba(4, 4, 12, ${this.cfg.darkness})`);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.game.width, this.game.height);
        ctx.restore();
    }

    // ------------------------------------------------------------
    // Taller (pestaña del menú)
    // ------------------------------------------------------------
    materialIcon(id, size = 22) {
        const m = MINE_MATERIALS[id] || MINE_ITEMS[id] || EQUIP_ITEMS[id];
        if (m.img) return `<img src="assets/maps/objetos/${m.img}.png" alt="" style="width:${size}px;height:${size}px;image-rendering:pixelated;vertical-align:middle;">`;
        return `<span style="font-size:${Math.round(size * 0.8)}px;vertical-align:middle;">${m.icon}</span>`;
    }

    canCraft(recipe) {
        if (recipe.requires && !this.hasTool(recipe.requires)) return false;
        if (recipe.kind === 'tool' && this.hasTool(recipe.id)) return false;
        return Object.entries(recipe.cost).every(([id, n]) => this.count(id) >= n);
    }

    craft(id) {
        const recipe = MINE_RECIPES.find(r => r.id === id);
        if (!recipe || !this.canCraft(recipe)) return;
        const cards = this.game.cards;
        for (const [m, n] of Object.entries(recipe.cost)) {
            if (EQUIP_ITEMS[m]) cards.bag[m] -= n;
            else if (MINE_ITEMS[m]) this.consumables[m] -= n;
            else this.materials[m] -= n;
        }
        let msg = `🔨 Fabricaste ${recipe.name}.`;
        if (recipe.kind === 'tool') {
            this.tools[recipe.id] = true;
        } else if (recipe.kind === 'consumable') {
            const id = recipe.gives || recipe.id;
            this.consumables[id] = (this.consumables[id] || 0) + 1;
        } else if (recipe.kind === 'equip') {
            cards.bag[recipe.id] = (cards.bag[recipe.id] || 0) + 1;
            msg += ' Equípalo en la Mochila.';
        }
        cards.save();
        this.save();
        this.game.notifyStatus(msg);
    }

    /** Funde objetos de elemento de la Mochila: cada uno da la gema de su elemento. Devuelve cuántos fundió. */
    melt(id, n = 1) {
        const gem = BAG_GEMS[id];
        const k = Math.min(n, this.bagAvailable(id));
        if (!gem || k <= 0) return 0;
        const cards = this.game.cards;
        cards.bag[id] -= k;
        if (cards.bag[id] <= 0) delete cards.bag[id];
        this.materials[gem] = (this.materials[gem] || 0) + k;
        cards.save();
        this.save();
        return k;
    }

    meltOne(id) {
        if (this.melt(id)) this.game.notifyStatus(`♻️ Fundiste ${this.itemName(id)}: +1 ${this.itemName(BAG_GEMS[id])}.`);
    }

    /** Repetidos de la Mochila (todo lo que pasa de uno por objeto). */
    duplicateCount() {
        const bag = this.game.cards.bag;
        return Object.keys(BAG_GEMS).reduce((sum, id) => sum + Math.max(0, (bag[id] || 0) - 1), 0);
    }

    /** Funde todos los repetidos y deja uno de cada objeto (para equiparlo o para el Talismán). */
    meltDuplicates() {
        const bag = this.game.cards.bag;
        const got = [];
        for (const id of Object.keys(BAG_GEMS)) {
            const extra = (bag[id] || 0) - 1;
            const k = extra > 0 ? this.melt(id, extra) : 0;
            if (k) got.push(`+${k} ${this.itemName(BAG_GEMS[id])}`);
        }
        this.game.notifyStatus(got.length ? `♻️ Fundiste los repetidos: ${got.join(', ')}.` : '♻️ No tienes objetos repetidos.');
    }

    useConsumable(id) {
        const g = this.game;
        if (!this.consumables[id]) return;
        if (id === 'cuerda') {
            if (!this.cfg || !this.cfg.exit) {
                g.notifyStatus('🧵 La Cuerda de Escape sólo sirve dentro de la cueva.');
                return;
            }
            this.consumables.cuerda--;
            if (g.isMenuOpen) g.toggleMenu();
            const e = this.cfg.exit;
            g.triggerWarpTransition({ targetMap: e.map, targetX: e.x, targetY: e.y, desc: '🧵 ¡Saliste de la cueva!' });
        } else if (MINE_ITEMS[id] && MINE_ITEMS[id].heal) {
            const it = MINE_ITEMS[id];
            const list = it.scope === 'all' ? g.cards.collection : g.cards.getTeam();
            if (!list.length) {
                g.notifyStatus('No tienes dinos a los que dárselo.');
                return;
            }
            if (!list.some(c => (c.fatigue || 0) > 0)) {
                g.notifyStatus(`${it.icon} Tus dinos ya están descansados. Guárdalo para cuando lo necesites.`);
                return;
            }
            this.consumables[id]--;
            g.cards.restDinos(it.heal, it.scope);
            g.notifyStatus(`${it.icon} ¡Usaste ${it.name}! ${it.scope === 'all' ? 'Todos tus dinos' : 'Tu equipo'} recuperó energía.`);
        } else if (id === 'cebo') {
            if (this.lure) {
                g.notifyStatus('🍖 Ya tienes un Cebo de Ámbar activo.');
                return;
            }
            this.consumables.cebo--;
            this.lure = true;
            g.notifyStatus('🍖 Cebo de Ámbar activo: el próximo dino salvaje será LEGENDARIO.');
        }
        this.save();
    }

    renderWorkshopPanel(panel) {
        const chip = (id, need) => {
            const have = this.count(id);
            const ok = have >= need;
            return `<span style="display:inline-flex;align-items:center;gap:3px;margin:2px 6px 2px 0;color:${ok ? '#a7f3d0' : '#fca5a5'};font-size:0.78rem;">
                        ${this.materialIcon(id, 18)} ${have}/${need}</span>`;
        };
        const tools = [['pico', '⛏️', 'Pico de Explorador'], ['pico_reforzado', '⛏️', 'Pico Reforzado'],
            ['linterna', '🔦', 'Linterna de Cristal'], ['radar', '📡', 'Radar de Cristales']];
        const toolsHtml = tools.map(([id, icon, name]) => `
            <span style="display:inline-block;margin:3px 6px 3px 0;padding:4px 8px;border-radius:6px;font-size:0.8rem;
                  background:${this.tools[id] ? '#14532d' : '#1e293b'};color:${this.tools[id] ? '#bbf7d0' : '#64748b'};">
                ${icon} ${name} ${this.tools[id] ? '✔' : ''}</span>`).join('');

        const matsHtml = Object.keys(MINE_MATERIALS).map(id => `
            <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0f172a;border-radius:6px;
                        opacity:${this.materials[id] ? 1 : 0.45};" title="${MINE_MATERIALS[id].desc || ''}">
                ${this.materialIcon(id)} <span style="font-size:0.78rem;">${MINE_MATERIALS[id].name}</span>
                <strong style="margin-left:auto;color:#ffbe0b;">${this.materials[id] || 0}</strong>
            </div>`).join('');

        // Objetos de elemento de la Mochila: se funden en gemas
        const cards = this.game.cards;
        const bagIds = Object.keys(BAG_GEMS).filter(id => (cards.bag[id] || 0) > 0);
        const bagHtml = bagIds.map(id => {
            const it = EQUIP_ITEMS[id];
            const gem = BAG_GEMS[id];
            const free = this.bagAvailable(id);
            return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0f172a;border-radius:6px;">
                        <span style="font-size:1.05rem;">${it.icon}</span>
                        <span style="font-size:0.78rem;">${it.name} <strong style="color:#ffbe0b;">x${cards.bag[id]}</strong>
                            ${cards.equippedItem === id ? '<em style="color:#00e5ff;font-style:normal;font-size:0.7rem;">(1 equipado)</em>' : ''}</span>
                        <button data-melt="${id}" ${free ? '' : 'disabled'} title="Fundir 1 ${it.name}: te da 1 ${this.itemName(gem)}"
                            style="margin-left:auto;padding:2px 8px;border-radius:6px;border:none;white-space:nowrap;cursor:${free ? 'pointer' : 'default'};
                            background:${free ? '#7c3aed' : '#334155'};color:${free ? '#fff' : '#64748b'};font-weight:bold;">♻️ → ${this.materialIcon(gem, 16)}</button>
                    </div>`;
        }).join('');
        const dupes = this.duplicateCount();
        const bagSection = bagIds.length
            ? `<p style="color:#8892b0;font-size:0.76rem;margin:0 0 6px;">Funde los repetidos: cada objeto se convierte en la gema de su elemento
                   (3 gemas + 2 fragmentos = un amuleto de +12). Con uno de cada elemento se fabrica el 🧿 Talismán de los Siete.</p>
               <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;">${bagHtml}</div>
               <button data-melt-all ${dupes ? '' : 'disabled'} style="margin-top:6px;padding:5px 12px;border-radius:6px;border:none;
                   cursor:${dupes ? 'pointer' : 'default'};background:${dupes ? '#7c3aed' : '#334155'};color:${dupes ? '#fff' : '#64748b'};font-weight:bold;">
                   ♻️ Fundir todos los repetidos (${dupes}) · deja 1 de cada</button>`
            : '<p style="color:#64748b;font-size:0.78rem;">Aún no tienes objetos de elemento: brillan entre la hierba alta 🌿 y la Vendedora Ámbar los vende.</p>';

        const consHtml = Object.entries(MINE_ITEMS).map(([id, r]) => {
            const n = this.consumables[id] || 0;
            return `<button class="menu-item-slot" data-use="${id}" ${n ? '' : 'disabled'} style="opacity:${n ? 1 : 0.5};" title="${r.desc}">
                        <span class="menu-item-icon">${r.icon}</span>
                        <div><strong>${r.name}</strong> <span style="color:#8892b0;">x${n}</span><br>
                        <span style="font-size:0.72rem;color:#94a3b8;">${n ? 'Clic para usar (un solo uso)' : r.desc}</span></div>
                    </button>`;
        }).join('');

        const recipesHtml = MINE_RECIPES.map(r => {
            const owned = r.kind === 'tool' && this.hasTool(r.id);
            const can = this.canCraft(r);
            return `<div style="padding:8px;background:#0f172a;border:1px solid ${can ? '#ffbe0b' : '#1e293b'};border-radius:8px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="font-size:1.2rem;">${r.icon}</span><strong style="font-size:0.85rem;">${r.name}</strong>
                            ${owned ? '<span style="margin-left:auto;color:#4ade80;font-size:0.75rem;">✔ Ya lo tienes</span>'
                                    : `<button data-craft="${r.id}" ${can ? '' : 'disabled'} style="margin-left:auto;padding:3px 10px;border-radius:6px;border:none;
                                        cursor:${can ? 'pointer' : 'default'};background:${can ? '#ffbe0b' : '#334155'};color:${can ? '#111' : '#64748b'};font-weight:bold;">🔨 Fabricar</button>`}
                        </div>
                        <div style="font-size:0.74rem;color:#94a3b8;margin:4px 0;">${r.desc}${r.requires && !this.hasTool(r.requires) ? ' <em>(necesitas el pico de Rose)</em>' : ''}</div>
                        <div>${Object.entries(r.cost).map(([id, n]) => chip(id, n)).join('')}</div>
                    </div>`;
        }).join('');

        panel.innerHTML = `
            <h3 style="color:#ffbe0b;margin-bottom:4px;">⛏️ Taller del Explorador</h3>
            <p style="color:#8892b0;font-size:0.8rem;margin-bottom:8px;">
                Piso más profundo: <strong style="color:#00e5ff;">${this.deepest || '—'}</strong> ·
                Gemas ocultas encontradas: <strong style="color:#00e5ff;">${this.foundGems.length}</strong>
                ${this.lure ? ' · <strong style="color:#fb923c;">🍖 Cebo activo</strong>' : ''}
            </p>
            <h4 style="color:#e2e8f0;margin:8px 0 4px;">🦖 Habilidades de tu equipo</h4>${this.game.field.renderAbilitiesHtml()}
            <h4 style="color:#e2e8f0;margin:10px 0 4px;">Herramientas</h4><div>${toolsHtml}</div>
            <h4 style="color:#e2e8f0;margin:10px 0 4px;">Materiales</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:6px;">${matsHtml}</div>
            <h4 style="color:#e2e8f0;margin:10px 0 4px;">🎒 Objetos de la Mochila</h4>${bagSection}
            <h4 style="color:#e2e8f0;margin:10px 0 4px;">Objetos (un solo uso)</h4><div class="menu-items-grid">${consHtml}</div>
            <h4 style="color:#e2e8f0;margin:10px 0 4px;">Recetas</h4>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;">${recipesHtml}</div>`;

        panel.querySelectorAll('[data-craft]').forEach(btn => btn.addEventListener('click', () => {
            this.craft(btn.dataset.craft);
            this.renderWorkshopPanel(panel);
        }));
        panel.querySelectorAll('[data-melt]').forEach(btn => btn.addEventListener('click', () => {
            this.meltOne(btn.dataset.melt);
            this.renderWorkshopPanel(panel);
        }));
        const meltAll = panel.querySelector('[data-melt-all]');
        if (meltAll) meltAll.addEventListener('click', () => {
            this.meltDuplicates();
            this.renderWorkshopPanel(panel);
        });
        this.game.field.bindPanel(panel);
        panel.querySelectorAll('[data-use]').forEach(btn => btn.addEventListener('click', () => {
            this.useConsumable(btn.dataset.use);
            if (this.game.isMenuOpen) this.renderWorkshopPanel(panel);
        }));
    }
}
