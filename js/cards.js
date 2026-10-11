/**
 * CardSystem - Dinos, almanaque de cartas, experiencia y objetos.
 *
 * - Cada 20 a 100 pasos (losas) por la hierba alta aparece un dino salvaje del mismo
 *   nivel que el dino más fuerte de tu equipo. Solo puedes combatir o huir: si lo
 *   derrotas lo capturas (con un nivel menos).
 * - Experiencia: ganar a un dino salvaje da +15% de nivel a tu equipo; ganar a un
 *   entrenador, +20% por cada dino rival derrotado.
 * - Equipo de 3 dinos. Los demás dinos se guardan en el almanaque.
 * - En la hierba alta aparecen objetos (+5 a ataques de su elemento, 1 equipado a la vez)
 *   y cartas de movimiento.
 * - Tabla de tipos (typeChart en dinos.json): daño eficaz por ventaja de elemento.
 * - Estadísticas: salud, ataque/defensa físicos y ataque/defensa especiales (base x nivel).
 * - Cada dino puede aprender los ataques de su elemento y los normales según su nivel;
 *   el Maestro de ataques (NPC tipo "tutor") permite cambiarlos.
 * - Los dinos no evolucionan: solo suben de nivel.
 * - El estado se guarda en la ranura de partida activa (js/save.js).
 */

const STAT_DEFS = [
    { key: 'hp',  icon: '❤️', name: 'Salud' },
    { key: 'atk', icon: '💪', name: 'Ataque físico' },
    { key: 'def', icon: '🛡️', name: 'Defensa física' },
    { key: 'spa', icon: '🔮', name: 'Ataque especial' },
    { key: 'spd', icon: '✨', name: 'Defensa especial' }
];

const ENCOUNTER_MIN_STEPS = 20;
const ENCOUNTER_MAX_STEPS = 100;
const ELEMENT_ITEM_BOOST = 5;
const MAX_TEAM_SIZE = 3;
const MAX_CARD_LEVEL = 50;
const XP_WILD_WIN = 15;          // % de nivel por ganar a un dino salvaje
const XP_PER_TRAINER_DINO = 20;  // % de nivel por cada dino de entrenador derrotado
const STARTER_LEVEL = 5;
const STARTER_DINOS = ['carnotaurus', 'triceratops', 'parasaurolophus']; // si un protagonista no trae 'starter'
const CREDITS_PER_TRAINER_LEVEL = 40;  // Dino-Créditos por cada nivel medio del equipo rival vencido
const ITEM_PRICE = 300;                // precio en la tienda de Ámbar
const MOVE_CARD_PRICE = 600;
const RESERVE_XP_SHARE = 0.5;          // los dinos del almanaque ganan la mitad de la experiencia del equipo

// Cansancio (0-100): cada combate cansa al equipo y los dinos de la reserva descansan
const FATIGUE_PER_BATTLE = { wild: 8, trainer: 15 };
const FATIGUE_REST_PER_BATTLE = 6;
const FATIGUE_LEVELS = [
    { min: 100, label: 'Exhausto', icon: '🥵', factor: 0.6, color: '#ef4444' },
    { min: 70, label: 'Agotado', icon: '😫', factor: 0.75, color: '#f97316' },
    { min: 40, label: 'Cansado', icon: '😴', factor: 0.9, color: '#facc15' },
    { min: 0, label: 'Descansado', icon: '💪', factor: 1, color: '#4ade80' }
];

// Objetos equipables: uno por elemento
const EQUIP_ITEMS = {
    colmillo_volcanico: { name: 'Colmillo Volcánico', icon: '🔥', element: 'fuego' },
    perla_lago:         { name: 'Perla del Lago',     icon: '💧', element: 'agua' },
    cuerno_tormenta:    { name: 'Cuerno Tormenta',    icon: '⚡', element: 'rayo' },
    fosil_ambar:        { name: 'Fósil de Ámbar',     icon: '⛰️', element: 'tierra' },
    hoja_milenaria:     { name: 'Hoja Milenaria',     icon: '🌿', element: 'planta' },
    pluma_ciclon:       { name: 'Pluma Ciclón',       icon: '🌪️', element: 'viento' },
    garra_ancestral:    { name: 'Garra Ancestral',    icon: '✨', element: 'especial' },
    // Amuletos: sólo se fabrican en el Taller con gemas de la cueva (js/mine.js) y dan más poder
    amuleto_fuego:    { name: 'Amuleto de Rubí',       icon: '💎', element: 'fuego',    boost: 12, craftOnly: true },
    amuleto_agua:     { name: 'Amuleto de Aguamarina', icon: '💎', element: 'agua',     boost: 12, craftOnly: true },
    amuleto_rayo:     { name: 'Amuleto de Topacio',    icon: '💎', element: 'rayo',     boost: 12, craftOnly: true },
    amuleto_tierra:   { name: 'Amuleto de Ámbar',      icon: '💎', element: 'tierra',   boost: 12, craftOnly: true },
    amuleto_planta:   { name: 'Amuleto de Esmeralda',  icon: '💎', element: 'planta',   boost: 12, craftOnly: true },
    amuleto_viento:   { name: 'Amuleto de Ópalo',      icon: '💎', element: 'viento',   boost: 12, craftOnly: true },
    amuleto_especial: { name: 'Amuleto de Amatista',   icon: '💎', element: 'especial', boost: 12, craftOnly: true }
};
const itemBoost = (item) => (item && item.boost) || ELEMENT_ITEM_BOOST;

// Tabla por defecto si dinos.json no trae typeChart
const DEFAULT_TYPE_CHART = {
    effective: 1.5,
    neutral: 1,
    beats: {
        fuego: ['planta'],
        planta: ['agua', 'tierra'],
        agua: ['fuego'],
        tierra: ['fuego', 'viento', 'rayo'],
        viento: ['planta'],
        rayo: ['agua']
    },
    alwaysEffective: ['especial']
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const newUid = () => `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class CardSystem {
    constructor(game) {
        this.game = game;

        // Estado de la partida (se guarda en la ranura activa)
        this.resetState();

        // Encuentros
        this.stepsUntilEncounter = this.rollEncounterSteps();
        this.lastTileKey = null;
        this.wildActive = false;   // combate contra un dino salvaje en curso
        this.modalOpen = false;    // ventana de captura / dino inicial

        // Objetos en la hierba alta del mapa actual: [{ col, row, kind: 'item'|'move', itemId }]
        this.groundItems = [];
    }

    get catalog() {
        return this.game.dinoCatalog;
    }

    // ------------------------------------------------------------
    // Persistencia
    // ------------------------------------------------------------
    resetState() {
        this.collection = [];   // almanaque: [{ uid, id, level, xp, attacks, inTeam }]
        this.bag = {};          // itemId -> cantidad
        this.equippedItem = null;
        this.moveCards = {};    // id de carta de movimiento -> cantidad
        this.selectedMove = null;
        this.credits = 0;       // Dino-Créditos (tienda de la Vendedora Ámbar)
    }

    serialize() {
        return {
            collection: this.collection,
            bag: this.bag,
            equippedItem: this.equippedItem,
            moveCards: this.moveCards,
            selectedMove: this.selectedMove,
            credits: this.credits
        };
    }

    deserialize(data = {}) {
        this.resetState();
        this.collection = (Array.isArray(data.collection) ? data.collection : [])
            .map(c => ({ ...c, xp: Number(c.xp) || 0, fatigue: Number(c.fatigue) || 0 }));
        this.bag = data.bag || {};
        this.equippedItem = EQUIP_ITEMS[data.equippedItem] ? data.equippedItem : null;
        this.moveCards = data.moveCards || {};
        this.selectedMove = data.selectedMove || null;
        this.credits = Number(data.credits) || 0;
        this.groundItems = [];
    }

    /** Los cambios se escriben en la ranura de partida activa (autoguardado). */
    save() {
        if (this.game.saves) this.game.saves.autoSave();
    }

    // ------------------------------------------------------------
    // Utilidades de catálogo y poder de ataques
    // ------------------------------------------------------------
    getDino(id) {
        return this.catalog.dinos.find(d => d.id === id) || null;
    }

    getAttack(id) {
        return this.catalog.attacks.find(a => a.id === id) || null;
    }

    getMoveCardList() {
        return [];   // las cartas de movimiento ya no existen (sus cartas ahora son dinos)
    }

    /** Ataques que un dino puede aprender: los de su elemento y los normales (sin cartas de movimiento). */
    getLearnableAttacks(dino) {
        if (!dino) return [];
        return this.catalog.attacks.filter(a => !a.moveCard && (a.element === dino.element || a.element === 'normal'));
    }

    /** Ataques por defecto para un nivel: los 2 más fuertes de su elemento + el normal más fuerte. */
    getDefaultAttacks(dino, level = 1) {
        const learnable = this.getLearnableAttacks(dino).filter(a => (a.level || 1) <= level && a.power > 0);
        const byPower = (a, b) => b.power - a.power;
        const own = learnable.filter(a => a.element === dino.element).sort(byPower);
        const normal = learnable.filter(a => a.element === 'normal').sort(byPower);
        const picked = [...own.slice(0, 2), ...normal].slice(0, 3);
        for (const a of [...own, ...normal]) {
            if (picked.length >= 3) break;
            if (!picked.includes(a)) picked.push(a);
        }
        return picked.map(a => a.id);
    }

    getCategory(attack) {
        const cats = this.catalog.categories || {};
        return cats[attack && attack.category] || { name: 'Físico', icon: '💪' };
    }

    /** Estadísticas base [salud, atq. físico, def. física, atq. especial, def. especial] de 0 a 10. */
    getBaseStats(dinoId) {
        const dino = this.getDino(dinoId);
        const st = dino && Array.isArray(dino.stats) ? dino.stats : [5, 5, 5, 5, 5];
        return st.length >= 5 ? st : [st[0], st[1], st[2], st[1], st[2]];
    }

    /** Estadísticas reales = base x nivel (nivel 50 con base 10 = 500). */
    getStats(dinoId, level) {
        const base = this.getBaseStats(dinoId);
        const out = {};
        STAT_DEFS.forEach((s, i) => { out[s.key] = base[i] * level; });
        return out;
    }

    renderStatsHtml(dinoId, level) {
        const base = this.getBaseStats(dinoId);
        return `<div class="dino-stats">${STAT_DEFS.map((s, i) => `
            <div class="dino-stat" title="${s.name}: ${base[i]}/10 base · ${base[i] * level} a Nv. ${level}">
                <span>${s.icon}</span>
                <div class="dino-stat-bar"><div class="dino-stat-fill ${s.key}" style="width:${base[i] * 10}%"></div></div>
                <span class="dino-stat-val">${base[i] * level}</span>
            </div>`).join('')}</div>`;
    }

    /** Bono del objeto equipado para un elemento de ataque. */
    getElementBoost(element) {
        const item = EQUIP_ITEMS[this.equippedItem];
        return item && item.element === element ? itemBoost(item) : 0;
    }

    /** Poder real de un ataque para el jugador (incluye el objeto equipado). */
    getAttackPower(attack) {
        if (!attack) return 0;
        const boost = this.getElementBoost(attack.element);
        return attack.power > 0 ? attack.power + boost : attack.power;
    }

    getTeam() {
        return this.collection.filter(c => c.inTeam);
    }

    /** Carta de movimiento elegida para combatir (si todavía la tienes). */
    getPlayerMoveCard() {
        return null;
    }

    // ------------------------------------------------------------
    // Tabla de tipos
    // ------------------------------------------------------------
    get typeChart() {
        return this.catalog.typeChart || DEFAULT_TYPE_CHART;
    }

    /**
     * Multiplicador de daño de un ataque contra el elemento del defensor.
     * Especial siempre es eficaz; normal y los elementos sin ventaja son neutros.
     */
    getTypeMultiplier(attackElement, defenderElement) {
        const chart = this.typeChart;
        if ((chart.alwaysEffective || []).includes(attackElement)) return chart.effective;
        const beats = (chart.beats || {})[attackElement] || [];
        if (beats.includes(defenderElement)) return chart.effective;
        // Poco eficaz: el defensor es del elemento que le gana al ataque, o del mismo elemento
        const resisted = chart.resisted;
        if (resisted && attackElement !== 'normal' &&
            (((chart.beats || {})[defenderElement] || []).includes(attackElement) || attackElement === defenderElement)) {
            return resisted;
        }
        return chart.neutral;
    }

    rollEncounterSteps() {
        return randInt(ENCOUNTER_MIN_STEPS, ENCOUNTER_MAX_STEPS);
    }

    // ------------------------------------------------------------
    // Experiencia (porcentaje de nivel)
    // ------------------------------------------------------------
    /** Suma `percent` % de nivel a cada dino del equipo. Devuelve los que subieron de nivel. */
    gainTeamXp(percent) {
        const leveled = [];
        for (const card of this.collection) {
            if (card.level >= MAX_CARD_LEVEL) continue;
            // La reserva también aprende mirando: gana la mitad
            card.xp = (card.xp || 0) + (card.inTeam ? percent : Math.round(percent * RESERVE_XP_SHARE));
            let up = false;
            while (card.xp >= 100 && card.level < MAX_CARD_LEVEL) {
                card.xp -= 100;
                card.level++;
                up = true;
            }
            if (card.level >= MAX_CARD_LEVEL) card.xp = 0;
            if (up) leveled.push(card);
        }
        this.save();
        return leveled;
    }

    describeXpGain(percent, leveled) {
        const names = leveled.map(c => `${this.getDino(c.id)?.name || c.id} Nv. ${c.level}`);
        const canLearn = leveled.some(c => this.getLearnableAttacks(this.getDino(c.id))
            .some(a => a.level === c.level));
        return `📈 Tu equipo gana +${percent}% de nivel (la reserva +${Math.round(percent * RESERVE_XP_SHARE)}%).`
            + (names.length ? ` ⬆️ ¡Subieron: ${names.join(', ')}!` : '')
            + (canLearn ? ' 📚 Hay ataques nuevos: visita al Maestro de ataques.' : '');
    }

    // ------------------------------------------------------------
    // Cansancio
    // ------------------------------------------------------------
    fatigueLevel(card) {
        const f = Number(card && card.fatigue) || 0;
        return FATIGUE_LEVELS.find(l => f >= l.min) || FATIGUE_LEVELS[FATIGUE_LEVELS.length - 1];
    }

    /** Tras cada combate: el equipo se cansa y la reserva descansa. */
    onBattleFatigue(kind) {
        const add = FATIGUE_PER_BATTLE[kind] || 0;
        if (!add) return;
        const tired = [];
        for (const c of this.collection) {
            const before = this.fatigueLevel(c).label;
            c.fatigue = Math.max(0, Math.min(100, (Number(c.fatigue) || 0) + (c.inTeam ? add : -FATIGUE_REST_PER_BATTLE)));
            if (c.inTeam && this.fatigueLevel(c).label !== before && c.fatigue >= 40) tired.push(c);
        }
        if (tired.length) {
            const names = tired.map(c => `${this.fatigueLevel(c).icon} ${this.getDino(c.id)?.name || c.id}`).join(', ');
            setTimeout(() => this.game.notifyStatus(`${names}: ¡se está cansando! Cambia de dinos o usa un objeto que quite el cansancio.`), 2600);
        }
        this.game.hudTeamKey = null;
        this.save();
    }

    /** Quita cansancio: a todo el equipo (team) o a todos tus dinos (all). amount = 100 lo deja en 0. */
    restDinos(amount, scope = 'team') {
        const list = scope === 'all' ? this.collection : this.getTeam();
        list.forEach(c => { c.fatigue = Math.max(0, (Number(c.fatigue) || 0) - amount); });
        this.game.hudTeamKey = null;
        this.save();
        return list.length;
    }

    fatigueHtml(card) {
        const f = Math.round(Number(card.fatigue) || 0);
        const lv = this.fatigueLevel(card);
        return `<div class="dino-xp" title="Cansancio: ${lv.label}${lv.factor < 1 ? ` (−${Math.round((1 - lv.factor) * 100)}% de fuerza)` : ''}" style="margin-top:2px;">
                    <div class="dino-xp-fill" style="width:${f}%;background:${lv.color};"></div><span>${lv.icon} ${f}%</span></div>`;
    }

    // ------------------------------------------------------------
    // Pasos por la hierba alta
    // ------------------------------------------------------------
    get isEncounterActive() {
        return this.wildActive || this.modalOpen || this.tutorOpen || this.shopOpen || !!(this.game.tournament && this.game.tournament.isOpen);
    }

    /** Se llama cada frame tras mover al jugador. Devuelve true si empezó un encuentro. */
    onPlayerUpdate() {
        const player = this.game.localPlayer;
        const ts = this.game.tileMap.tileSize;
        const col = Math.floor(player.x / ts);
        const row = Math.floor(player.y / ts);
        const key = `${col},${row}`;
        if (key === this.lastTileKey) return false;
        this.lastTileKey = key;

        this.pickUpGroundItem(col, row);

        if (!this.game.tileMap.isTallGrass(player.x, player.y)) return false;
        if (--this.stepsUntilEncounter > 0) return false;

        this.stepsUntilEncounter = this.rollEncounterSteps();
        return this.startWildEncounter();
    }

    // ------------------------------------------------------------
    // Objetos y cartas de movimiento en la hierba alta
    // ------------------------------------------------------------
    spawnGroundItems() {
        const tm = this.game.tileMap;
        const tiles = [];
        for (let r = 0; r < tm.rows; r++) {
            for (let c = 0; c < tm.cols; c++) {
                if (tm.tallGrassGrid[r] && tm.tallGrassGrid[r][c] && !(tm.solidGrid[r] && tm.solidGrid[r][c]) &&
                    !(tm.npcBlockers && tm.npcBlockers.has(`${c},${r}`))) {
                    tiles.push({ col: c, row: r });
                }
            }
        }
        this.groundItems = [];
        this.lastTileKey = null;
        if (tiles.length === 0) return;

        // ~1 objeto por cada 40 losas de hierba, entre 2 y 12
        const count = Math.max(2, Math.min(12, Math.round(tiles.length / 40)));
        const itemIds = Object.keys(EQUIP_ITEMS).filter(id => !EQUIP_ITEMS[id].craftOnly);
        const rules = this.game.mine.groundItemRules();
        const allMoves = this.getMoveCardList();
        const strong = allMoves.filter(a => a.power >= 70);
        const moveIds = (rules.strongOnly && strong.length ? strong : allMoves).map(a => a.id);
        for (let i = 0; i < count && tiles.length > 0; i++) {
            const { col, row } = tiles.splice(Math.floor(Math.random() * tiles.length), 1)[0];
            if (Math.random() < 0.22) {
                // Objeto para quitar el cansancio (en la cueva salen hongos)
                this.groundItems.push({ col, row, kind: 'consumable', itemId: this.game.mine.cfg ? 'hongo_luminoso' : 'baya_vigor' });
            } else if (moveIds.length && Math.random() < rules.moveChance) {   // (sin cartas de movimiento, nunca)
                this.groundItems.push({ col, row, kind: 'move', itemId: moveIds[Math.floor(Math.random() * moveIds.length)] });
            } else {
                this.groundItems.push({ col, row, kind: 'item', itemId: itemIds[Math.floor(Math.random() * itemIds.length)] });
            }
        }
    }

    pickUpGroundItem(col, row) {
        const idx = this.groundItems.findIndex(it => it.col === col && it.row === row);
        if (idx < 0) return;
        const it = this.groundItems.splice(idx, 1)[0];

        if (it.kind === 'consumable') {
            this.game.mine.addItem(it.itemId, 1);
            this.game.notifyStatus(`✨ ¡Encontraste ${this.game.mine.itemName(it.itemId)}! Úsalo en el Taller (ENTER) para quitar el cansancio.`);
        } else if (it.kind === 'move') {
            const move = this.getAttack(it.itemId);
            this.moveCards[it.itemId] = (this.moveCards[it.itemId] || 0) + 1;
            if (!this.getPlayerMoveCard()) this.selectedMove = it.itemId;
            this.game.notifyStatus(`🃏 ¡Encontraste la carta de movimiento ${move ? move.name : it.itemId}! Elígela en el Almanaque (ENTER).`);
        } else {
            const item = EQUIP_ITEMS[it.itemId];
            this.bag[it.itemId] = (this.bag[it.itemId] || 0) + 1;
            this.game.notifyStatus(`${item.icon} ¡Encontraste ${item.name}! Equípalo en la Mochila (ENTER).`);
        }
        this.save();
    }

    drawGroundItems(ctx) {
        if (this.groundItems.length === 0) return;
        const ts = this.game.tileMap.tileSize;
        const bob = Math.sin(Date.now() / 250) * 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '16px sans-serif';
        for (const it of this.groundItems) {
            const cx = it.col * ts + ts / 2;
            const cy = it.row * ts + ts / 2 + bob;
            ctx.fillStyle = it.kind === 'move' ? 'rgba(255, 170, 60, 0.45)' : 'rgba(255, 240, 150, 0.35)';
            ctx.beginPath();
            ctx.arc(cx, cy, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText(it.kind === 'move' ? '🃏' : (it.kind === 'consumable' ? this.game.mine.itemIcon(it.itemId) : EQUIP_ITEMS[it.itemId].icon), cx, cy);
        }
        ctx.restore();
    }

    // ------------------------------------------------------------
    // Dino salvaje: combatir o huir; derrotarlo = capturarlo
    // ------------------------------------------------------------
    startWildEncounter() {
        const dinos = this.catalog.dinos;
        if (!dinos || dinos.length === 0) return false;

        const team = this.getTeam();
        if (team.length === 0) {
            if (this.collection.length === 0) {
                this.game.notifyStatus('⚠️ ¡Algo se mueve en la hierba! Sin un dino es peligroso: busca al Dr. Cretácico.');
                return false;
            }
            this.game.notifyStatus('⚠️ Algo se mueve en la hierba... ¡Elige dinos para tu equipo en el Almanaque (ENTER)!');
            return false;
        }

        // Rareza según el piso de la cueva (o el Cebo de Ámbar)
        const { dino, levelBonus, tier } = this.game.mine.pickWild(dinos);
        // Nivel = promedio del equipo (no el más alto), así entrenar dinos nuevos no se vuelve imposible
        const avg = Math.round(team.reduce((s, c) => s + c.level, 0) / team.length);
        const level = Math.min(MAX_CARD_LEVEL, avg + levelBonus);
        const wild = { id: dino.id, level, attacks: this.getDefaultAttacks(dino, level) };

        this.wildActive = true;
        const rare = tier.id !== 'comun' && (this.game.mine.cfg || tier.id === 'legendario');
        if (rare) this.game.notifyStatus(`${tier.label}: ¡${dino.name} salvaje apareció!`);
        // 📖 = ya lo tienes en el almanaque (como la Pokéball junto al nombre en Pokémon)
        const registered = this.isRegistered(dino.id);
        this.game.battle.start({ kind: 'wild', card: wild, title: `${registered ? '📖 ' : ''}${rare ? tier.label + ' · ' : ''}${dino.name} salvaje` });
        return true;
    }

    /** result: 'won' | 'lost' | 'fled' */
    onWildBattleEnd(result, wild) {
        this.wildActive = false;
        const dino = this.getDino(wild.id);
        const name = dino ? dino.name : wild.id;

        if (result === 'fled') {
            this.game.notifyStatus('💨 Escapaste del dino salvaje.');
            return;
        }
        if (result === 'lost') {
            this.game.notifyStatus(`💀 Tus dinos se debilitaron y ${name} salvaje volvió a la hierba.`);
            return;
        }

        const leveled = this.gainTeamXp(XP_WILD_WIN);
        this.game.localPlayer.gainExp(10 + wild.level * 3, `¡Derrotaste a ${name} salvaje!`);
        this.credits += 10 + wild.level * 3;

        // Ya registrado: no se captura otra vez; se va y deja un regalo
        if (this.isRegistered(wild.id)) {
            const bonus = 20 + wild.level * 4;
            this.credits += bonus;
            const gift = Math.random() < 0.3;
            if (gift) this.game.mine.addItem('baya_vigor', 1);
            this.save();
            this.showModal({
                title: '📖 YA REGISTRADO',
                cards: [{ id: wild.id, level: wild.level, attacks: wild.attacks }],
                message: `Ya tienes a ${name} en tu almanaque, así que lo dejaste volver a la naturaleza.<br>
                          Como agradecimiento: 💰 +${bonus} Dino-Créditos${gift ? ' y 🫐 una Baya Vigor' : ''}.
                          <br><small>${this.describeXpGain(XP_WILD_WIN, leveled)}</small>`,
                buttons: [{ label: '▶ Continuar', cls: 'win', onClick: () => this.closeModal() }]
            });
            return;
        }

        const captured = {
            uid: newUid(),
            id: wild.id,
            level: Math.max(1, wild.level - 1),
            xp: 0,
            attacks: wild.attacks,
            inTeam: false
        };
        this.collection.push(captured);
        const xpMsg = this.describeXpGain(XP_WILD_WIN, leveled);
        const team = this.getTeam();

        if (team.length < MAX_TEAM_SIZE) {
            captured.inTeam = true;
            this.save();
            this.showModal({
                title: '🎉 ¡CAPTURADO!',
                cards: [captured],
                message: `¡${name} se unió a tu equipo (Nv. ${captured.level})!<br><small>${xpMsg}</small>`,
                buttons: [{ label: '▶ Continuar', cls: 'win', onClick: () => this.closeModal() }]
            });
            return;
        }

        // Equipo lleno: preguntar si reemplazar a alguno; si no, va al almanaque
        this.save();
        this.showModal({
            title: '🎉 ¡CAPTURADO!',
            cards: [captured],
            message: `Capturaste a ${name} (Nv. ${captured.level}). Tu equipo está lleno: ¿quieres reemplazar a alguno?
                      El que salga se guarda en tu almanaque.<br><small>${xpMsg}</small>`,
            buttons: [
                ...team.map(member => ({
                    label: `🔄 Reemplazar a ${this.getDino(member.id)?.name || member.id} (Nv. ${member.level})`,
                    cls: 'swap',
                    onClick: () => {
                        member.inTeam = false;
                        captured.inTeam = true;
                        this.save();
                        this.closeModal();
                        this.game.notifyStatus(`🃏 ${name} entra al equipo; ${this.getDino(member.id)?.name || member.id} va al almanaque.`);
                    }
                })),
                {
                    label: '📖 Guardar en el almanaque',
                    cls: 'flee',
                    onClick: () => {
                        this.closeModal();
                        this.game.notifyStatus(`📖 ${name} se guardó en tu almanaque.`);
                    }
                }
            ]
        });
    }

    // ------------------------------------------------------------
    // Dino inicial
    // ------------------------------------------------------------
    /** Dino inicial (lo despierta el Dr. Cretácico). `ids`: especies posibles (una sola = sin elegir). */
    showStarterPicker(onPicked = null, ids = STARTER_DINOS) {
        const starters = ids.map(id => this.getDino(id)).filter(Boolean);
        if (starters.length === 0 || this.collection.length > 0) return;
        const cards = starters.map(d => ({ id: d.id, level: STARTER_LEVEL, xp: 0, attacks: this.getDefaultAttacks(d, STARTER_LEVEL) }));
        this.showModal({
            title: cards.length === 1 ? '🦖 ¡TU PRIMER DINO!' : '🦖 ¡ELIGE TU PRIMER DINO!',
            cards,
            message: 'Te acompañará en tus combates. Los demás dinos los consigues derrotándolos en la hierba alta.',
            buttons: cards.map(c => ({
                label: cards.length === 1 ? `¡Vamos, ${this.getDino(c.id).name}!` : `Elegir a ${this.getDino(c.id).name}`,
                cls: 'win',
                onClick: () => {
                    this.collection.push({ uid: newUid(), ...c, inTeam: true });
                    this.save();
                    this.closeModal();
                    this.game.notifyStatus(`🎉 ¡${this.getDino(c.id).name} es tu primer dino!`);
                    if (onPicked) onPicked(c);
                }
            }))
        });
    }

    // ------------------------------------------------------------
    // Maestro de ataques (NPC tipo "tutor")
    // ------------------------------------------------------------
    openTutor(npcName = 'Maestro de ataques') {
        if (this.collection.length === 0) {
            this.game.showDialog(npcName, 'Todavía no tienes dinos. ¡Vuelve cuando tengas alguno!');
            return;
        }
        this.tutorOpen = true;
        this.tutorNpcName = npcName;
        const first = this.getTeam()[0] || this.collection[0];
        this.tutorSel = { uid: first.uid, slot: 0 };
        document.getElementById('tutorTitle').textContent = `📚 ${npcName}`;
        document.getElementById('tutorOverlay').style.display = 'flex';
        this.renderTutor();
    }

    closeTutor() {
        this.tutorOpen = false;
        document.getElementById('tutorOverlay').style.display = 'none';
        if (document.activeElement) document.activeElement.blur();
    }

    renderTutor() {
        const { elements } = this.catalog;
        const sel = this.tutorSel;
        const card = this.collection.find(c => c.uid === sel.uid) || this.collection[0];
        const dino = this.getDino(card.id);

        // Lista de dinos: equipo primero, luego almanaque
        const ordered = [...this.getTeam(), ...this.collection.filter(c => !c.inTeam)];
        const listHtml = ordered.map(c => {
            const d = this.getDino(c.id);
            const src = d && (d.card || d.image);
            return `
                <button class="tutor-dino ${c.uid === card.uid ? 'active' : ''}" data-uid="${c.uid}">
                    <span class="tutor-dino-img" style="${src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : ''}"></span>
                    <span><strong>${escapeHtml(d ? d.name : c.id)}</strong><br><small>Nv. ${c.level}${c.inTeam ? ' · ★ equipo' : ''}</small></span>
                </button>`;
        }).join('');

        const atkRow = (a, extra = '') => {
            const el = elements[a.element];
            const cat = this.getCategory(a);
            return `<span>${el ? el.icon : '•'}${cat.icon} ${escapeHtml(a.name)}</span><span class="atk-power">${a.power > 0 ? a.power : '—'}${extra}</span>`;
        };
        const slotsHtml = card.attacks.map((aid, i) => {
            const a = this.getAttack(aid) || { name: aid, element: 'normal', power: 0 };
            return `<button class="battle-atk-btn tutor-slot ${i === sel.slot ? 'selected' : ''}" data-slot="${i}">${atkRow(a)}</button>`;
        }).join('');

        const learnHtml = this.getLearnableAttacks(dino)
            .sort((a, b) => (a.level || 1) - (b.level || 1) || a.power - b.power)
            .map(a => {
                const locked = (a.level || 1) > card.level;
                const known = card.attacks.includes(a.id);
                const tag = locked ? ` <em class="lock">🔒 Nv. ${a.level}</em>` : (known ? ' <em class="known">✔</em>' : '');
                return `<button class="battle-atk-btn tutor-learn" data-atk="${a.id}" ${locked || known ? 'disabled' : ''}>${atkRow(a, tag)}</button>`;
            }).join('');

        document.getElementById('tutorBody').innerHTML = `
            <div class="tutor-list">${listHtml}</div>
            <div class="tutor-main">
                <div class="tutor-card">${this.renderCardHtml(card)}</div>
                <div class="tutor-attacks">
                    <p class="tutor-hint">1. Elige el ataque que quieres olvidar:</p>
                    <div class="tutor-slots">${slotsHtml}</div>
                    <p class="tutor-hint">2. Elige el ataque nuevo (💪 físico · 🔮 especial · 🌀 estado):</p>
                    <div class="tutor-learnable">${learnHtml}</div>
                </div>
            </div>`;

        const body = document.getElementById('tutorBody');
        body.querySelectorAll('.tutor-dino').forEach(b => b.addEventListener('click', () => {
            this.tutorSel = { uid: b.dataset.uid, slot: 0 };
            this.renderTutor();
        }));
        body.querySelectorAll('.tutor-slot').forEach(b => b.addEventListener('click', () => {
            this.tutorSel.slot = Number(b.dataset.slot);
            this.renderTutor();
        }));
        body.querySelectorAll('.tutor-learn').forEach(b => b.addEventListener('click', () => {
            const old = this.getAttack(card.attacks[sel.slot]);
            const learned = this.getAttack(b.dataset.atk);
            card.attacks[sel.slot] = b.dataset.atk;
            this.save();
            this.game.notifyStatus(`📚 ${dino ? dino.name : card.id} olvidó ${old ? old.name : '...'} y aprendió ${learned.name}.`);
            this.renderTutor();
        }));
    }

    // ------------------------------------------------------------
    // Ventana genérica (captura / dino inicial)
    // ------------------------------------------------------------
    showModal({ title, cards = [], message = '', buttons = [] }) {
        this.modalOpen = true;
        document.getElementById('cardModalTitle').textContent = title;
        document.getElementById('cardModalCards').innerHTML = cards.map(c => this.renderCardHtml(c)).join('');
        document.getElementById('cardModalMessage').innerHTML = message;
        const actions = document.getElementById('cardModalActions');
        actions.innerHTML = '';
        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.className = `battle-btn ${b.cls || ''}`;
            btn.textContent = b.label;
            btn.addEventListener('click', b.onClick);
            actions.appendChild(btn);
        });
        document.querySelector('#cardModal .card-modal-window').classList.toggle('single', cards.length === 1);
        document.getElementById('cardModal').style.display = 'flex';
    }

    closeModal() {
        this.modalOpen = false;
        document.getElementById('cardModal').style.display = 'none';
        if (document.activeElement) document.activeElement.blur();
    }

    // ------------------------------------------------------------
    // Render de cartas
    // ------------------------------------------------------------
    /** Arte grande del dino (PNG sin fondo de assets/dinos/grande, copiado a arte/). side: 'left' | 'right'. */
    artUrl(dinoId, side = 'right') {
        const dino = this.getDino(dinoId);
        const art = dino && dino.art;
        const path = art && (art[side] || art.left || art.right);
        return path ? `assets/dinos/${encodeURI(path)}` : null;
    }

    renderCardHtml(card, { showBoost = false, vsElements = [] } = {}) {
        const dino = this.getDino(card.id);
        const { elements } = this.catalog;
        const el = dino && elements[dino.element];
        const src = dino && (dino.card || dino.image);
        const cardStyle = src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : '';
        const atkHtml = (card.attacks || []).map(aid => {
            const a = this.getAttack(aid);
            const ael = a && elements[a.element];
            const boost = showBoost && a && a.power > 0 ? this.getElementBoost(a.element) : 0;
            const power = a ? a.power + boost : '';
            const boostHtml = boost ? ` <em class="atk-boost">+${boost}</em>` : '';
            const effective = a && a.power > 0 && vsElements.some(de => this.getTypeMultiplier(a.element, de) > 1);
            const effHtml = effective ? ` <em class="atk-effective" title="Eficaz contra el rival">x${this.typeChart.effective}</em>` : '';
            const cat = a ? this.getCategory(a).icon : '';
            return `<li title="${a ? this.getCategory(a).name : ''}">${ael ? ael.icon : '•'}${cat} ${escapeHtml(a ? a.name : aid)}${a ? ` <span>${a.power > 0 ? power : '—'}${boostHtml}${effHtml}</span>` : ''}</li>`;
        }).join('') || '<li><em>Sin ataques</em></li>';
        const xpHtml = card.xp !== undefined && card.level < MAX_CARD_LEVEL
            ? `<div class="dino-xp" title="Progreso al siguiente nivel"><div class="dino-xp-fill" style="width:${card.xp}%"></div><span>${card.xp}%</span></div>`
            : '';
        // La carta y, encima, el dino (como al invocar un monstruo en Yu-Gi-Oh)
        const art = this.artUrl(card.id, 'right');
        const imgHtml = `<div class="battle-dino-img ${dino && dino.card ? '' : 'full-card'}" style="${cardStyle}"></div>`;
        return `
            <div class="battle-dino-card">
                ${art ? `<div class="dino-card-stage">${imgHtml}<img class="dino-card-art" src="${art}" alt="" loading="lazy"></div>` : imgHtml}
                <strong>${escapeHtml(dino ? dino.name : card.id)}</strong>
                <small style="color:${el ? el.color : '#94a3b8'}">${el ? el.icon + ' ' + el.name : ''} · Nv. ${card.level}</small>
                ${xpHtml}
                ${this.renderStatsHtml(card.id, card.level)}
                <ul class="battle-dino-attacks">${atkHtml}</ul>
            </div>`;
    }

    renderMoveCardHtml(move, { selected = false, count = 0 } = {}) {
        const el = this.catalog.elements[move.element];
        const src = move.card || move.image;
        const boost = move.power > 0 ? this.getElementBoost(move.element) : 0;
        return `
            <div class="battle-dino-card move-card ${selected ? 'selected' : ''}">
                <div class="battle-dino-img" style="${src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : ''}"></div>
                <strong>🃏 ${escapeHtml(move.name)}</strong>
                <small style="color:${el ? el.color : '#94a3b8'}">${el ? el.icon + ' ' + el.name : move.element} · ${this.getCategory(move).icon} Poder ${move.power + boost}${boost ? ` <em class="atk-boost">+${boost}</em>` : ''}</small>
                ${count > 1 ? `<small style="color:#8892b0;">x${count}</small>` : ''}
            </div>`;
    }

    // ------------------------------------------------------------
    // Equipo y objetos
    // ------------------------------------------------------------
    isRegistered(dinoId) {
        return this.collection.some(c => c.id === dinoId);
    }

    /** Liberar un dino del almanaque (no del equipo). Da Dino-Créditos según su nivel. */
    releaseDino(uid) {
        const card = this.collection.find(c => c.uid === uid);
        if (!card || card.inTeam || this.collection.length <= 1) return 0;
        this.collection = this.collection.filter(c => c !== card);
        const reward = 15 + card.level * 5;
        this.credits += reward;
        this.save();
        return reward;
    }

    toggleTeam(uid) {
        const card = this.collection.find(c => c.uid === uid);
        if (!card) return false;
        if (!card.inTeam && this.getTeam().length >= MAX_TEAM_SIZE) return false;
        card.inTeam = !card.inTeam;
        this.save();
        return true;
    }

    equip(itemId) {
        if (!this.bag[itemId]) return;
        this.equippedItem = this.equippedItem === itemId ? null : itemId;
        this.save();
    }

    selectMoveCard(id) {
        if (!this.moveCards[id]) return;
        this.selectedMove = this.selectedMove === id ? null : id;
        this.save();
    }

    // ------------------------------------------------------------
    // Paneles del menú (ENTER)
    // ------------------------------------------------------------
    renderBagPanel(panel) {
        const equipped = EQUIP_ITEMS[this.equippedItem];
        const { elements } = this.catalog;
        const owned = Object.keys(EQUIP_ITEMS).filter(id => this.bag[id] > 0);

        const itemsHtml = owned.map(id => {
            const item = EQUIP_ITEMS[id];
            const el = elements[item.element];
            const isEq = this.equippedItem === id;
            return `
                <button class="menu-item-slot equip-slot ${isEq ? 'equipped' : ''}" data-item="${id}">
                    <span class="menu-item-icon">${item.icon}</span>
                    <div>
                        <strong>${item.name}</strong> <span style="color:#8892b0;">x${this.bag[id]}</span><br>
                        <span style="color:${el ? el.color : '#94a3b8'}; font-size:0.78rem;">+${itemBoost(item)} a ataques de ${el ? el.name : item.element}</span><br>
                        <span style="color:${isEq ? '#ffbe0b' : '#64748b'}; font-size:0.72rem; font-weight:bold;">${isEq ? '✔ EQUIPADO (clic para quitar)' : 'Clic para equipar'}</span>
                    </div>
                </button>`;
        }).join('');

        panel.innerHTML = `
            <h3 style="color:#ffbe0b; margin-bottom:4px;">🎒 Mochila de Aventuras</h3>
            <p style="color:#8892b0; font-size:0.8rem; margin-bottom:12px;">
                Solo puedes llevar <strong>1 objeto equipado</strong>. Equipado ahora:
                <strong style="color:#00e5ff;">${equipped ? `${equipped.icon} ${equipped.name}` : 'ninguno'}</strong>
            </p>
            <div class="menu-items-grid">${itemsHtml}</div>
            ${owned.length ? '' : '<p style="color:#64748b; font-size:0.8rem;">Aún no tienes objetos. Búscalos brillando entre la hierba alta 🌿.</p>'}
        `;

        panel.querySelectorAll('.equip-slot[data-item]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.equip(btn.dataset.item);
                const item = EQUIP_ITEMS[btn.dataset.item];
                this.game.notifyStatus(this.equippedItem ? `${item.icon} Equipaste ${item.name}.` : `Te quitaste ${item.name}.`);
                this.renderBagPanel(panel);
            });
        });
    }

    renderTypeChartHtml() {
        const { elements } = this.catalog;
        const chart = this.typeChart;
        const label = (id) => {
            const el = elements[id];
            return `<span style="color:${el ? el.color : '#94a3b8'}">${el ? `${el.icon} ${el.name}` : id}</span>`;
        };
        const rows = Object.keys(elements).map(id => {
            let target;
            if ((chart.alwaysEffective || []).includes(id)) {
                target = '<em>todos los tipos</em>';
            } else {
                const beats = (chart.beats || {})[id] || [];
                target = beats.length ? beats.map(label).join(', ') : '<span style="color:#64748b;">— (neutro)</span>';
            }
            return `<div class="type-chart-row">${label(id)} <span class="type-arrow">➜ eficaz contra</span> ${target}</div>`;
        }).join('');
        return `
            <details class="type-chart">
                <summary>📊 Tabla de tipos (eficaz = x${chart.effective} de daño${chart.resisted ? ` · poco eficaz = x${chart.resisted} contra el elemento que le gana y contra el mismo elemento` : ''})</summary>
                <div class="type-chart-grid">${rows}</div>
            </details>`;
    }

    /** Almanaque: todos tus dinos y tu equipo de 3. */
    renderCardsPanel(panel) {
        const team = this.getTeam();
        const stored = this.collection.filter(c => !c.inTeam);
        const cardHtml = (card) => `
            <div class="collection-card ${card.inTeam ? 'in-team' : ''}">
                ${this.renderCardHtml(card, { showBoost: true })}
                ${this.fatigueHtml(card)}
                <button class="team-toggle-btn" data-uid="${card.uid}">${card.inTeam ? '★ En equipo (quitar)' : '☆ Llevar en el equipo'}</button>
                ${card.inTeam ? '' : `<button class="team-toggle-btn release-btn" data-release="${card.uid}" style="background:#3b1d1d;color:#fca5a5;">🕊️ Liberar</button>`}
            </div>`;


        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; gap:10px;">
                <div>
                    <h3 style="color:#ffbe0b; margin-bottom:4px;">📖 Almanaque de Cartas (${this.collection.length})</h3>
                    <p style="color:#8892b0; font-size:0.8rem;">Llevas 3 dinos en tu equipo. Ganar a un salvaje da +${XP_WILD_WIN}% de nivel; a un entrenador, +${XP_PER_TRAINER_DINO}% por cada dino derrotado (los guardados ganan la mitad).
                    Cada combate <strong>cansa</strong> a tu equipo (😴 −10%, 😫 −25%, 🥵 −40% de fuerza) y los guardados descansan: ¡ve rotando! 📖 = especie ya registrada (no se captura dos veces).</p>
                </div>
                <span style="background:#1f283d; border:1px solid #3c486e; padding:4px 10px; border-radius:6px; font-size:0.75rem; color:#00e5ff; white-space:nowrap;">
                    Equipo: ${team.length}/${MAX_TEAM_SIZE} · 📖 ${this.collection.length} dinos
                </span>
            </div>
            ${this.renderTypeChartHtml()}
            <h4 class="almanac-title">⚔️ Tu equipo</h4>
            <div class="collection-grid">${team.map(cardHtml).join('') || '<p style="color:#64748b;">Tu equipo está vacío. Elige dinos del almanaque.</p>'}</div>
            <h4 class="almanac-title">📖 Guardados en el almanaque (${stored.length})</h4>
            <div class="collection-grid">${stored.map(cardHtml).join('') || '<p style="color:#64748b;">No hay dinos guardados.</p>'}</div>
        `;

        panel.querySelectorAll('.team-toggle-btn[data-uid]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.toggleTeam(btn.dataset.uid)) {
                    this.game.notifyStatus(`⚠️ Tu equipo ya tiene ${MAX_TEAM_SIZE} dinos. Quita uno primero.`);
                }
                this.renderCardsPanel(panel);
            });
        });
        panel.querySelectorAll('.move-card-btn[data-move]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectMoveCard(btn.dataset.move);
                this.renderCardsPanel(panel);
            });
        });
        panel.querySelectorAll('[data-release]').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = this.collection.find(c => c.uid === btn.dataset.release);
                const name = card ? (this.getDino(card.id)?.name || card.id) : '';
                if (!card || !window.confirm(`¿Liberar a ${name} (Nv. ${card.level})? Volverá a la naturaleza y no podrás recuperarlo.`)) return;
                const reward = this.releaseDino(card.uid);
                this.game.notifyStatus(reward ? `🕊️ ${name} volvió a la naturaleza. 💰 +${reward} Dino-Créditos.` : '⚠️ No puedes liberar a tu último dino.');
                this.renderCardsPanel(panel);
            });
        });
    }

    // ------------------------------------------------------------
    // Tienda de la Vendedora Ámbar (Dino-Créditos)
    // ------------------------------------------------------------
    get shopStock() {
        const items = Object.entries(EQUIP_ITEMS).filter(([, it]) => !it.craftOnly).map(([id, it]) => ({ kind: 'item', id, icon: it.icon, name: it.name, price: ITEM_PRICE,
            desc: `+${ELEMENT_ITEM_BOOST} a ataques de ${(this.catalog.elements[it.element] || {}).name || it.element}` }));
        const moves = this.getMoveCardList().map(m => ({ kind: 'move', id: m.id, icon: '🃏', name: m.name, price: MOVE_CARD_PRICE,
            desc: `Carta de movimiento · Poder ${m.power}` }));
        return [...items, ...moves];
    }

    /** lines: { greet, buy, noMoney, bye } (diálogos de la vendedora). */
    openShop(npcName, lines = {}) {
        this.shopOpen = true;
        this.shopNpc = npcName;
        this.shopLines = lines;
        this.shopMessage = lines.greet || '';
        document.getElementById('shopTitle').textContent = `🛍️ ${npcName}`;
        document.getElementById('shopOverlay').style.display = 'flex';
        this.renderShop();
    }

    closeShop() {
        if (!this.shopOpen) return;
        this.shopOpen = false;
        document.getElementById('shopOverlay').style.display = 'none';
        if (document.activeElement) document.activeElement.blur();
        if (this.shopLines && this.shopLines.bye) this.game.showDialog(this.shopNpc, this.shopLines.bye);
    }

    buy(entry) {
        if (this.credits < entry.price) {
            this.shopMessage = this.shopLines.noMoney || 'No tienes suficientes Dino-Créditos.';
            this.renderShop();
            return;
        }
        this.credits -= entry.price;
        if (entry.kind === 'item') this.bag[entry.id] = (this.bag[entry.id] || 0) + 1;
        else {
            this.moveCards[entry.id] = (this.moveCards[entry.id] || 0) + 1;
            if (!this.getPlayerMoveCard()) this.selectedMove = entry.id;
        }
        this.save();
        this.shopMessage = this.shopLines.buy || `¡Compraste ${entry.name}!`;
        this.renderShop();
    }

    renderShop() {
        const body = document.getElementById('shopBody');
        const stock = this.shopStock;
        body.innerHTML = `
            <div class="shop-head">
                <p class="shop-msg">🗨️ ${escapeHtml(this.shopMessage || '')}</p>
                <span class="shop-credits">💰 ${this.credits} Dino-Créditos</span>
            </div>
            <div class="shop-grid">${stock.map((e, i) => {
                const owned = e.kind === 'item' ? (this.bag[e.id] || 0) : (this.moveCards[e.id] || 0);
                return `<button class="shop-item ${this.credits < e.price ? 'expensive' : ''}" data-i="${i}">
                    <span class="shop-icon">${e.icon}</span>
                    <span class="shop-info"><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.desc)}${owned ? ` · tienes ${owned}` : ''}</small></span>
                    <span class="shop-price">${e.price} ₵</span>
                </button>`;
            }).join('')}</div>`;
        body.querySelectorAll('.shop-item').forEach(btn => btn.addEventListener('click', () => this.buy(stock[Number(btn.dataset.i)])));
    }
}
