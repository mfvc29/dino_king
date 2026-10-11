/**
 * FieldSystem - Habilidades de los dinos fuera de combate, tesoros escondidos, descanso y reglas de gimnasio.
 * La idea: que valga la pena llevar dinos de distintos elementos (no siempre el mismo equipo).
 *
 * Habilidades (sólo si un dino de ese elemento va en tu equipo):
 *   💧 Agua    Nadar: cruzas estanques y lagos (hay tesoros en islas).
 *   🌿 Planta  Cortar arbustos que tapan atajos (Espacio/E frente al arbusto).
 *   🔥 Fuego   Derretir los bloques de hielo de la cueva.
 *   ⛰️ Tierra  Romper las rocas duras de la cueva.
 *   ⚡ Rayo    Iluminar los pisos oscuros de la cueva.
 *   🌪️ Viento  Volar a lugares que ya conoces (desde el Taller).
 *
 * Mapas: "fieldObjects": [{ kind: 'bush', x, y }]   (vuelven a crecer al volver a entrar)
 *        "treasures":    [{ id, x, y, item, n }]      (se recogen una sola vez; se guardan)
 *        "gymRules":     { maxLevel, bannedElement }  (gimnasios)
 */

const FIELD_ABILITIES = {
    agua:   { icon: '💧', name: 'Nadar', desc: 'Cruzas estanques y lagos. ¡Busca islas con tesoros!' },
    planta: { icon: '🌿', name: 'Cortar', desc: 'Cortas arbustos que tapan atajos (Espacio/E frente a ellos).' },
    fuego:  { icon: '🔥', name: 'Derretir', desc: 'Derrites los bloques de hielo de la cueva.' },
    tierra: { icon: '⛰️', name: 'Romper', desc: 'Rompes las rocas duras de la cueva.' },
    rayo:   { icon: '⚡', name: 'Iluminar', desc: 'Iluminas los pisos oscuros de la cueva y ves gemas ocultas desde más lejos.' },
    viento: { icon: '🌪️', name: 'Volar', desc: 'Vuelas a lugares que ya conoces (botones abajo).' }
};

// Destinos de vuelo (sólo los mapas que ya visitaste)
const FLY_SPOTS = [
    { id: 'pueblo', name: 'Pueblo Meteoro', map: 'world_map', x: 52, y: 64 },
    { id: 'colinas', name: 'Colinas del Viento', map: 'world_map', x: 18, y: 25 },
    { id: 'lago', name: 'Lago Cristal', map: 'world_map', x: 111, y: 46 },
    { id: 'canon', name: 'Cañón de Fuego', map: 'world_map', x: 27, y: 88 },
    { id: 'cueva', name: 'Entrada de la Cueva Meteoro', map: 'ruta_1', x: 12, y: 8 },
    { id: 'estadio', name: 'Estadio del Torneo', map: 'torneo', x: 17, y: 29 }
];

const BUSH_TILE = [75, 6];   // arbusto de Outside.png (el objeto musgo_2)

class FieldSystem {
    constructor(game) {
        this.game = game;
        this.bushes = [];       // arbustos del mapa actual { col, row }
        this.treasureList = []; // tesoros del mapa actual
        this.visited = new Set(['world_map']);
        this.foundTreasures = [];
        this.swimNotified = false;
    }

    serialize() {
        return { visited: [...this.visited], foundTreasures: this.foundTreasures };
    }

    deserialize(data = {}) {
        this.visited = new Set(Array.isArray(data.visited) ? data.visited : ['world_map']);
        this.foundTreasures = Array.isArray(data.foundTreasures) ? data.foundTreasures : [];
    }

    reset() {
        this.deserialize({});
    }

    /** ¿Hay un dino de este elemento en el equipo? */
    has(element) {
        return this.game.cards.getTeam().some(c => {
            const d = this.game.cards.getDino(c.id);
            return d && d.element === element;
        });
    }

    // ------------------------------------------------------------
    // Al entrar a un mapa
    // ------------------------------------------------------------
    onMapLoaded() {
        const tm = this.game.tileMap;
        this.visited.add(tm.currentMapId);
        this.bushes = (tm.fieldObjects || []).filter(o => o.kind === 'bush').map(o => ({ col: o.x, row: o.y }));
        this.treasureList = (tm.treasures || []).filter(t => !this.foundTreasures.includes(t.id));
        this.lastStepKey = null;
        const rules = tm.gymRules;
        if (rules) {
            setTimeout(() => this.game.notifyStatus(`🏛️ Regla del gimnasio: ${this.describeRules(rules)}`), 1200);
        }
    }

    blockerKeys() {
        return this.bushes.map(b => `${b.col},${b.row}`);
    }

    /** Espacio/E frente a un arbusto: con un dino de Planta se corta. */
    tryCut(col, row) {
        const bush = this.bushes.find(b => b.col === col && b.row === row);
        if (!bush) return false;
        if (!this.has('planta')) {
            this.game.notifyStatus('🌿 Un arbusto espeso tapa el paso... Un dino de Planta en tu equipo podría cortarlo.');
            return true;
        }
        this.bushes = this.bushes.filter(b => b !== bush);
        this.game.refreshNpcBlockers();
        this.game.notifyStatus('🌿 ¡Tu dino de Planta cortó el arbusto!');
        return true;
    }

    /** Tesoros: se recogen al pisarlos (una sola vez por partida). */
    onStep(col, row) {
        const key = `${col},${row}`;
        if (key === this.lastStepKey) return;
        this.lastStepKey = key;
        const tm = this.game.tileMap;
        if (tm.waterGrid && tm.waterGrid[row] && tm.waterGrid[row][col] && !this.swimNotified) {
            this.swimNotified = true;
            this.game.notifyStatus('💧 ¡Tu dino de Agua te lleva nadando!');
        }
        const t = this.treasureList.find(x => x.x === col && x.y === row);
        if (!t) return;
        this.treasureList = this.treasureList.filter(x => x !== t);
        this.foundTreasures.push(t.id);
        const mine = this.game.mine;
        const n = t.n || 1;
        mine.addItem(t.item, n);
        this.game.notifyStatus(`🎁 ¡Encontraste un tesoro! +${n} ${mine.itemName(t.item)}`);
        this.save();
    }

    save() {
        if (this.game.saves) this.game.saves.autoSave();
    }

    draw(ctx) {
        const ts = this.game.tileMap.tileSize;
        const img = this.game.tileMap.getTilesetImage('outside');
        for (const b of this.bushes) {
            if (img && img.complete && img.naturalWidth) {
                const [r, c] = BUSH_TILE;
                ctx.drawImage(img, c * 32, r * 32, 32, 32, b.col * ts, b.row * ts, ts, ts);
            }
        }
        for (const t of this.treasureList) {
            const cx = t.x * ts + ts / 2, cy = t.y * ts + ts / 2 + Math.sin(Date.now() / 250 + t.x) * 2;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 220, 120, 0.45)';
            ctx.beginPath();
            ctx.arc(cx, cy, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎁', cx, cy);
            ctx.restore();
        }
    }

    // ------------------------------------------------------------
    // Volar (Viento)
    // ------------------------------------------------------------
    flySpots() {
        return FLY_SPOTS.filter(s => this.visited.has(s.map));
    }

    fly(id) {
        const g = this.game;
        const spot = FLY_SPOTS.find(s => s.id === id);
        if (!spot) return;
        if (!this.has('viento')) {
            g.notifyStatus('🌪️ Necesitas un dino de Viento en tu equipo para volar.');
            return;
        }
        if (g.mine.floor > 0) {
            g.notifyStatus('🌪️ No puedes volar bajo tierra. Sal de la cueva primero.');
            return;
        }
        if (g.isMenuOpen) g.toggleMenu();
        g.triggerWarpTransition({ targetMap: spot.map, targetX: spot.x, targetY: spot.y, desc: `🌪️ Volando a ${spot.name}...` });
    }

    // ------------------------------------------------------------
    // Reglas de gimnasio
    // ------------------------------------------------------------
    describeRules(rules) {
        const parts = [];
        if (rules.maxLevel) parts.push(`dinos de nivel ${rules.maxLevel} o menos`);
        if (rules.bannedElement) {
            const el = this.game.cards.catalog.elements[rules.bannedElement];
            parts.push(`prohibidos los de ${el ? el.icon + ' ' + el.name : rules.bannedElement}`);
        }
        return parts.join(' y ') || 'sin reglas';
    }

    /** Devuelve el motivo si tu equipo no cumple las reglas del gimnasio (o null). */
    gymViolation() {
        const rules = this.game.tileMap.gymRules;
        if (!rules) return null;
        const team = this.game.cards.getTeam();
        const bad = team.filter(c => {
            const d = this.game.cards.getDino(c.id);
            return (rules.maxLevel && c.level > rules.maxLevel) || (rules.bannedElement && d && d.element === rules.bannedElement);
        });
        if (!bad.length) return null;
        const names = bad.map(c => (this.game.cards.getDino(c.id) || {}).name || c.id).join(', ');
        return `¡Alto! En este gimnasio sólo se combate con ${this.describeRules(rules)}.\n${names} no cumple la regla. Cambia tu equipo en el Almanaque (ENTER) y vuelve.`;
    }

    // ------------------------------------------------------------
    // Panel (dentro del Taller)
    // ------------------------------------------------------------
    renderAbilitiesHtml() {
        const rows = Object.entries(FIELD_ABILITIES).map(([el, a]) => {
            const on = this.has(el);
            const elem = this.game.cards.catalog.elements[el];
            return `<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 8px;border-radius:6px;background:${on ? '#123524' : '#0f172a'};opacity:${on ? 1 : 0.6};">
                        <span style="font-size:1.1rem;">${a.icon}</span>
                        <div style="font-size:0.78rem;"><strong>${a.name}</strong> <span style="color:${elem ? elem.color : '#94a3b8'};">(${elem ? elem.name : el})</span>
                        ${on ? '<span style="color:#4ade80;">✔ activa</span>' : '<span style="color:#64748b;">— lleva uno en tu equipo</span>'}<br>
                        <span style="color:#94a3b8;">${a.desc}</span></div>
                    </div>`;
        }).join('');
        const fly = this.has('viento')
            ? `<div style="margin-top:6px;">${this.flySpots().map(s => `<button class="menu-item-slot" data-fly="${s.id}" style="display:inline-block;width:auto;margin:3px;padding:5px 10px;">🌪️ ${s.name}</button>`).join('')}</div>`
            : '';
        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px;">${rows}</div>${fly}`;
    }

    bindPanel(panel) {
        panel.querySelectorAll('[data-fly]').forEach(btn => btn.addEventListener('click', () => this.fly(btn.dataset.fly)));
    }
}
