/**
 * StorySystem - Historia de Dino Rey (assets/story/historia.json).
 *
 * - Capítulos con objetivo: el capítulo actual es el primero cuya condición `doneIf` no se cumple.
 * - Personajes de historia: se añaden al mapa cuando se cumple su `showIf`. Los de tipo 'npc'
 *   usan `talk` (el primer bloque cuyo `if` se cumple); los 'trainer' combaten como los del editor
 *   y al ser derrotados ejecutan `onDefeat`.
 * - Guardianes: los entrenadores del mapa listados en `guardians` dan una Piedra Elemental.
 * - Eventos (`events`): objetos en el suelo que se activan al pisarlos o con Espacio, como la
 *   carta del dino inicial que aparece frente a la casa tras el temblor.
 * - Estado guardado: flags, piedras y datos del rival (ver serialize / deserialize).
 */

const STONE_ORDER = ['fuego', 'agua', 'rayo', 'tierra', 'planta', 'viento', 'especial'];

class StorySystem {
    constructor(game) {
        this.game = game;
        this.data = { chapters: [], npcs: [], guardians: {}, stoneNames: {}, mapNames: {} };
        this.reset();
        this.ready = fetch('assets/story/historia.json')
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data) this.data = data; })
            .catch(() => {});
    }

    reset() {
        this.flags = {};
        this.stones = [];
        this.rival = { name: 'Rival', sprite: '', starter: null };
    }

    serialize() {
        return { flags: { ...this.flags }, stones: [...this.stones], rival: { ...this.rival } };
    }

    deserialize(s = {}) {
        this.reset();
        this.flags = { ...(s.flags || {}) };
        this.stones = Array.isArray(s.stones) ? [...s.stones] : [];
        if (s.rival) this.rival = { ...this.rival, ...s.rival };
        this.syncStones();
    }

    /** Partidas anteriores a la historia: las piedras salen de los guardianes ya vencidos. */
    syncStones() {
        for (const [id, element] of Object.entries(this.data.guardians || {})) {
            if (this.isDefeated(id) && !this.stones.includes(element)) this.stones.push(element);
        }
    }

    // ------------------------------------------------------------
    // Condiciones y textos
    // ------------------------------------------------------------
    /** Estado que usan las condiciones (el de la partida en curso o el de una ranura guardada). */
    context() {
        return {
            flags: this.flags,
            stones: this.stones,
            defeated: this.game.defeatedTrainers,
            hasDino: this.game.cards.collection.length > 0
        };
    }

    static contextFromSave(data) {
        const story = data.story || {};
        return {
            flags: story.flags || {},
            stones: story.stones || [],
            defeated: new Set(data.defeatedTrainers || []),
            hasDino: ((data.cards && data.cards.collection) || []).length > 0
        };
    }

    isDefeated(npcId, ctx = this.context()) {
        if (ctx.flags[`defeated:${npcId}`]) return true;
        for (const key of ctx.defeated) {
            if (key.endsWith(`:${npcId}`)) return true;
        }
        return false;
    }

    check(cond, ctx = this.context()) {
        if (!cond) return true;
        if (cond.flag && !ctx.flags[cond.flag]) return false;
        if (cond.notFlag && ctx.flags[cond.notFlag]) return false;
        if (cond.defeated && !this.isDefeated(cond.defeated, ctx)) return false;
        if (cond.notDefeated && this.isDefeated(cond.notDefeated, ctx)) return false;
        if (cond.stones !== undefined && ctx.stones.length < cond.stones) return false;
        if (cond.stonesBelow !== undefined && ctx.stones.length >= cond.stonesBelow) return false;
        if (cond.hasDino && !ctx.hasDino) return false;
        if (cond.noDino && ctx.hasDino) return false;
        return true;
    }

    chapterFor(ctx = this.context()) {
        const chapters = this.data.chapters || [];
        return chapters.find(c => !this.check(c.doneIf, ctx)) || chapters[chapters.length - 1] || null;
    }

    /** Frases de batalla del hermano rival (protagonistas.json). */
    get rivalLines() {
        const hero = this.game.heroes.find(h => h.defaultName === this.rival.name || h.sprite === this.rival.sprite);
        return (hero && hero.lines) || {};
    }

    format(text) {
        const lines = this.rivalLines;
        return String(text || '')
            .replace(/\{rivalEntrarVs\}/g, lines.entrarVs || '¡Vamos a ver quién es mejor Tamer!')
            .replace(/\{rivalGanarVs\}/g, lines.ganarVs || '¡Te gané!')
            .replace(/\{rivalPerderVs\}/g, lines.perderVs || '¡Me ganaste!')
            .replace(/\{player\}/g, this.game.localPlayer.name)
            .replace(/\{rival\}/g, this.rival.name)
            .replace(/\{rivalSprite\}/g, this.rival.sprite)
            .replace(/\{stones\}/g, this.stones.length)
            .replace(/\{left\}/g, Math.max(0, STONE_ORDER.length - this.stones.length));
    }

    get chapter() {
        return this.chapterFor();
    }

    get objective() {
        const ch = this.chapter;
        return ch ? this.format(ch.objective) : '';
    }

    mapName(mapId) {
        const name = (this.data.mapNames || {})[mapId];
        return name ? this.format(name) : null;
    }

    stoneName(element) {
        return (this.data.stoneNames || {})[element] || `Piedra ${element}`;
    }

    hasStone(element) {
        return this.stones.includes(element);
    }

    // ------------------------------------------------------------
    // Personajes de historia
    // ------------------------------------------------------------
    /** Datos (formato NPC del editor) de los personajes de historia visibles en un mapa. */
    getMapNpcs(mapId) {
        return (this.data.npcs || [])
            .filter(n => n.map === mapId && this.check(n.showIf))
            .map(n => this.resolveNpc(n));
    }

    resolveNpc(n) {
        const team = (n.team || []).map(m => ({
            ...m,
            species: m.species === '{rivalStarter}' ? (this.rival.starter || 'velociraptor') : m.species
        }));
        return {
            ...n,
            name: this.format(n.name),
            sprite: this.format(n.sprite),
            dialog: this.format(n.dialog),
            defeatDialog: this.format(n.defeatDialog),
            winDialog: this.format(n.winDialog),
            team,
            story: true
        };
    }

    /** Eventos visibles en un mapa (según su `showIf`). */
    getMapEvents(mapId) {
        return (this.data.events || []).filter(e => e.map === mapId && this.check(e.showIf));
    }

    eventAt(mapId, col, row) {
        return this.getMapEvents(mapId).find(e => e.x === col && e.y === row) || null;
    }

    /** Activa un evento: muestra su texto y ejecuta sus acciones. */
    runEvent(ev) {
        this.game.showDialog('✨ Carta brillante', this.format(ev.text), () => this.runActions(ev.actions || []));
    }

    /** Dibuja los eventos del mapa actual (la carta inicial brillando en el suelo). */
    drawEvents(ctx, mapId, tileSize) {
        const events = this.getMapEvents(mapId);
        if (!events.length) return;
        const t = Date.now();
        for (const ev of events) {
            const cx = ev.x * tileSize + tileSize / 2;
            const cy = ev.y * tileSize + tileSize / 2;
            const pulse = 0.5 + 0.5 * Math.sin(t / 300);
            const bob = Math.sin(t / 400) * 3;
            ctx.save();
            const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
            glow.addColorStop(0, `rgba(255, 230, 120, ${0.55 + pulse * 0.35})`);
            glow.addColorStop(1, 'rgba(255, 200, 60, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(cx, cy, 26, 0, Math.PI * 2);
            ctx.fill();
            const img = this.cardImage(ev);
            const w = 20;
            const h = 28;
            ctx.translate(cx, cy + bob);
            ctx.rotate(Math.sin(t / 700) * 0.15);
            if (img && img.complete && img.naturalWidth) {
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
            } else {
                ctx.fillStyle = '#ffd60a';
                ctx.fillRect(-w / 2, -h / 2, w, h);
            }
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.strokeRect(-w / 2, -h / 2, w, h);
            ctx.restore();
        }
    }

    /** Imagen de la carta del dino inicial del protagonista. */
    cardImage(ev) {
        if (ev.kind !== 'starterCard') return null;
        const id = this.game.starterOf(this.game.protagonist);
        const dino = id && this.game.cards.getDino(id);
        const src = dino && (dino.card || dino.image);
        if (!src) return null;
        this.cardImages = this.cardImages || {};
        if (!this.cardImages[src]) {
            const img = new Image();
            img.src = `assets/dinos/${encodeURI(src)}`;
            this.cardImages[src] = img;
        }
        return this.cardImages[src];
    }

    getNpcDef(id) {
        return (this.data.npcs || []).find(n => n.id === id) || null;
    }

    /** Hablar con un personaje de historia de tipo 'npc'. Devuelve true si lo manejó. */
    onTalk(npc) {
        const def = this.getNpcDef(npc.id);
        if (!def || !def.talk) return false;
        const entry = def.talk.find(t => this.check(t.if));
        if (!entry) return false;
        this.game.showDialog(npc.name, this.format(entry.text), () => this.runActions(entry.actions || []));
        return true;
    }

    /** Se llama al ganar a cualquier entrenador (del editor o de la historia). */
    onTrainerDefeated(npc) {
        this.flags[`defeated:${npc.id}`] = true;
        const element = (this.data.guardians || {})[npc.id];
        const after = [];
        if (element && !this.stones.includes(element)) {
            this.stones.push(element);
            const el = this.game.dinoCatalog.elements[element];
            after.push({ notify: `💎 ¡Conseguiste la ${this.stoneName(element)} ${el ? el.icon : ''}! (${this.stones.length}/7)` });
        }
        const def = this.getNpcDef(npc.id);
        if (def && def.onDefeat) after.push(...def.onDefeat);
        return after;
    }

    /** Acciones de historia. Se ejecutan en orden; algunas esperan a que el jugador elija. */
    runActions(actions, i = 0) {
        if (i >= actions.length) {
            this.afterProgress();
            return;
        }
        const a = actions[i];
        const next = () => this.runActions(actions, i + 1);
        const cards = this.game.cards;

        if (a.setFlag) {
            this.flags[a.setFlag] = true;
            next();
        } else if (a.giveItem) {
            const item = EQUIP_ITEMS[a.giveItem];
            cards.bag[a.giveItem] = (cards.bag[a.giveItem] || 0) + 1;
            if (item) this.game.notifyStatus(`${item.icon} Recibiste ${item.name}. Equípalo en la Mochila (ENTER).`);
            next();
        } else if (a.giveMove) {
            cards.moveCards[a.giveMove] = (cards.moveCards[a.giveMove] || 0) + 1;
            if (!cards.getPlayerMoveCard()) cards.selectedMove = a.giveMove;
            next();
        } else if (a.giveXp) {
            const leveled = cards.gainTeamXp(a.giveXp);
            this.game.notifyStatus(cards.describeXpGain(a.giveXp, leveled));
            next();
        } else if (a.notify) {
            setTimeout(() => this.game.notifyStatus(this.format(a.notify)), 400);
            next();
        } else if (a.starter && cards.collection.length > 0) {
            // Ya tiene dinos (partida antigua): solo marcar el dino inicial como recibido
            this.flags.starter = true;
            next();
        } else if (a.starter) {
            // Cada hermano tiene su dino inicial (protagonistas.json)
            const mine = this.game.starterOf(this.game.protagonist);
            cards.showStarterPicker(() => {
                this.flags.starter = true;
                this.afterProgress();
                setTimeout(() => this.game.notifyStatus(`📜 ${this.objective}`), 1200);
            }, mine ? [mine] : undefined);
        } else if (a.shop) {
            cards.openShop(this.format(a.shop.name || 'Tienda'), a.shop.lines || {});
            next();
        } else if (a.almanac) {
            this.game.toggleMenu();
            this.game.setMenuTab('cards');
            if (a.almanac.after) this.game.afterMenuDialog = { speaker: a.almanac.speaker, text: this.format(a.almanac.after) };
            next();
        } else if (a.challenge) {
            this.refreshNpcs();
            const npc = this.game.npcs.find(n => n.id === a.challenge);
            if (npc) {
                this.game.activeEvent = { npc, phase: 'dialog', timer: 0 };
                this.game.openTrainerChallenge(npc);
            }
        } else if (a.ending) {
            this.afterProgress();
            setTimeout(() => this.game.showEnding(this.format(this.data.ending || '¡Eres el Dino Rey!')), 300);
        } else {
            next();
        }
    }

    /** Tras un avance: actualizar personajes visibles, avisar del nuevo capítulo y autoguardar. */
    afterProgress() {
        this.refreshNpcs();
        const ch = this.chapter;
        if (ch && ch.id !== this.lastChapterId) {
            if (this.lastChapterId) this.game.showBanner(`📜 ${ch.title}`);
            this.lastChapterId = ch.id;
        }
        this.game.saves.autoSave();
    }

    /** Vuelve a colocar a los personajes de historia del mapa actual (sin tocar los del editor). */
    refreshNpcs() {
        const game = this.game;
        const mapId = game.tileMap.currentMapId || 'world_map';
        const keep = game.npcs.filter(n => !n.data.story);
        const busy = game.activeEvent && game.activeEvent.npc;
        const storyNpcs = this.getMapNpcs(mapId).map(d => {
            const existing = game.npcs.find(n => n.data.story && n.id === d.id);
            return existing || new NPC(d, game.tileMap.tileSize, mapId);
        });
        if (busy && busy.data.story && !storyNpcs.includes(busy)) storyNpcs.push(busy);
        game.npcs = [...keep, ...storyNpcs];
        game.refreshNpcBlockers();
    }
}
