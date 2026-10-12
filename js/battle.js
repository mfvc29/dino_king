/**
 * BattleSystem - Combate por turnos 3 contra 3 al estilo Persona 5, contra entrenadores,
 * dinos salvajes y en el Gran Torneo Mesozoico (incluido jugador contra jugador en la misma pantalla).
 *
 * - Todos los dinos están en el campo a la vez. El orden lo decide la VELOCIDAD (💨) de todos, sin
 *   moneda: en cada ronda actúa primero el dino más rápido del campo, sea tuyo o del rival, y así hasta
 *   el más lento (empate: más nivel; si sigue empatado, el tuyo primero).
 * - Cuando le toca a uno de tus dinos eliges un ataque y a qué rival atacar, o "Defender" (recibe la
 *   mitad de daño y no puede ser derribado). También puedes huir.
 * - DERRIBO y ¡UNA MÁS!: un ataque eficaz por tipo (o un golpe crítico físico) derriba al
 *   objetivo y el atacante actúa otra vez. Un dino derribado pierde su siguiente acción
 *   (la usa para levantarse).
 * - RELEVO: durante "¡Una más!" puedes pasar la acción extra a otro dino de tu equipo; su ataque
 *   hace +50% de daño (+100% si se encadenan dos relevos).
 * - Cada dino tiene 2 ataques: el FUERTE, que después de usarlo necesita 1, 2 o 3 turnos de recarga
 *   (según su poder), y el NORMAL, que siempre se puede usar.
 * - Ataques físicos usan ataque/defensa físicos; los especiales, ataque/defensa especiales.
 * - Daño = poder (+5 del objeto) x (ataque / defensa) x (nivel propio + nivel rival) / 50
 *   x ventaja de tipo x variación aleatoria (x1.5 si es crítico).
 * - Ataques de estado (poder 0, p. ej. Rugido) intimidan: el siguiente ataque del objetivo hace -30%.
 * - IA de los rivales (campo "ai" del entrenador): 'normal', 'dificil' o 'experto'. La difícil y la
 *   experta se defienden cuando corren peligro, buscan derribos para encadenar acciones,
 *   intimidan al dino más peligroso y rematan al que pueden debilitar.
 *
 * Presentación (estilo duelo de cartas): cada dino tiene su carta en una zona del campo y el dino
 * sale de ella (a la escala de su tamaño 1-6). Los físicos cruzan el campo para golpear; los especiales
 * lanzan un proyectil de su elemento (efectos en js/battleFx.js). La arena se arma una vez por combate
 * y render() sólo actualiza estados, así las animaciones no se cortan.
 */

const BATTLE_DELAY = 700;
const AI_DELAY = 420;
const INTIMIDATE_FACTOR = 0.7;
const GUARD_FACTOR = 0.5;
const CRIT_CHANCE = 0.08;
const CRIT_FACTOR = 1.5;
const BATON_BOOSTS = [1, 1.5, 2];
const RIVAL_MAX_EXTRA = 2;
const AI_RANDOM = { normal: 0.2, dificil: 0.08, experto: 0 };
// Posición horizontal (% del campo) de cada carta según cuántos dinos hay en el bando
const SLOT_X = {
    player: { 1: [34], 2: [22, 46], 3: [13, 35.5, 58] },
    rival: { 1: [66], 2: [56, 77], 3: [45, 66, 87] }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const otherSide = (side) => (side === 'player' ? 'rival' : 'player');

class BattleSystem {
    constructor(game) {
        this.game = game;
        this.battle = null;

        this.overlay = document.getElementById('battleOverlay');
        this.windowEl = this.overlay.querySelector('.duel-window');
        this.logEl = document.getElementById('battleLog');
        this.actionsEl = document.getElementById('battleActions');
        this.turnEl = document.getElementById('battleTurn');
        this.splashEl = document.getElementById('battleSplash');
        this.bannerEl = document.getElementById('battleBanner');
        this.rivalRow = document.getElementById('battleRivalSide');
        this.playerRow = document.getElementById('battlePlayerSide');
        this.trainerEls = {
            rival: document.getElementById('battleTrainerRival'),
            player: document.getElementById('battleTrainerPlayer')
        };
        this.speedBtn = document.getElementById('battleSpeedBtn');
        this.fx = new BattleFx(this);
        this.hotkeys = {};

        if (this.speedBtn) this.speedBtn.addEventListener('click', () => this.toggleSpeed());
        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    get cards() {
        return this.game.cards;
    }

    get isActive() {
        return !!this.battle;
    }

    /** Velocidad de las animaciones: 1 (normal) o 2 (rápida). Se guarda en Opciones. */
    get speed() {
        const s = this.game.saves && this.game.saves.settings;
        return s && s.battleSpeed === 2 ? 2 : 1;
    }

    wait(ms) {
        return sleep(ms / this.speed);
    }

    toggleSpeed() {
        if (this.game.saves) this.game.saves.setSetting('battleSpeed', this.speed === 2 ? 1 : 2);
        this.applySpeed();
    }

    applySpeed() {
        this.overlay.style.setProperty('--spd', this.speed);
        if (this.speedBtn) {
            this.speedBtn.textContent = this.speed === 2 ? '⏩ x2' : '▶ x1';
            this.speedBtn.classList.toggle('fast', this.speed === 2);
        }
    }

    // ------------------------------------------------------------
    // Preparación
    // ------------------------------------------------------------
    makeFighter(src, side, idx, moveId) {
        const dinoId = src.id || src.species;
        const dino = this.cards.getDino(dinoId);
        const level = Math.max(1, Number(src.level) || 1);
        const stats = { ...this.cards.getStats(dinoId, level) };
        // Cansancio: tus dinos cansados pelean con menos fuerza (no aplica en el torneo)
        const tired = side === 'player' && src.fatigue ? this.cards.fatigueLevel(src) : null;
        if (tired && tired.factor < 1) {
            for (const k of ['atk', 'def', 'spa', 'spd', 'vel']) stats[k] = Math.max(1, Math.round((stats[k] || 0) * tired.factor));
        }
        const attacks = this.cards.normalizeAttacks(dinoId, src.attacks, level);
        if (!attacks.length) attacks.push('embestida');
        const f = {
            side,
            idx,
            dinoId,
            name: (dino && dino.name) || src.name || dinoId,
            element: (dino && dino.element) || src.element || 'normal',
            level,
            attacks,
            image: (dino && (dino.card || dino.image)) || src.card || src.image || '',
            fullCard: dino ? !dino.card : !src.card,
            maxHp: Math.round(stats.hp * (src.hpBoost || 1)),
            hp: Math.round(stats.hp * (src.hpBoost || 1)),
            atk: stats.atk,
            def: stats.def,
            spa: stats.spa,
            spd: stats.spd,
            vel: stats.vel || 0,
            intimidated: false,
            guarding: false,
            down: false,
            boost: 1,
            lastMove: null,
            readyRound: {},     // ataque fuerte: ronda desde la que se puede volver a usar
            tired: tired && tired.factor < 1 ? tired : null
        };
        f.strongest = this.strongestMove(f, moveId);
        return f;
    }

    /** El ataque más fuerte del dino (entre sus ataques y la carta de movimiento). */
    strongestMove(f, moveId) {
        const ids = moveId ? [...f.attacks, moveId] : f.attacks;
        let best = null;
        let bestPower = 0;
        for (const id of ids) {
            const a = this.cards.getAttack(id);
            if (a && a.power > bestPower) {
                bestPower = a.power;
                best = id;
            }
        }
        return best;
    }

    /** ¿Se puede usar este ataque ahora? (el fuerte necesita recarga) */
    canUse(f, id) {
        return this.turnsToWait(f, id) <= 0;
    }

    /** Turnos que faltan para volver a usar un ataque (0 = disponible). */
    turnsToWait(f, id) {
        const ready = (f.readyRound || {})[id] || 0;
        return this.battle ? ready - this.battle.round : 0;
    }

    /**
     * opponent:
     *  { kind: 'trainer', npc }
     *  { kind: 'wild', card, title }
     *  { kind: 'tournament', title, player: { name, team, move }, rival: { name, team, move, human, ai },
     *    intro: [texto], announcer: { lastDino }, onEnd(result) }
     */
    start(opponent) {
        const kind = opponent.kind;
        const isWild = kind === 'wild';
        const isTournament = kind === 'tournament';
        const npc = opponent.npc;
        const myTeam = isTournament ? opponent.player.team : this.cards.getTeam();
        if (myTeam.length === 0) {
            const msg = this.cards.collection.length === 0
                ? '¿Todavía no tienes dinos? ¡Ve a ver al Dr. Cretácico y vuelve!'
                : '¿No tienes dinos en tu equipo?\nElige tu equipo en el Almanaque y vuelve a desafiarme.';
            this.game.showDialog(npc ? npc.name : 'Árbitro', msg, () => (npc ? this.game.endBattle('fled') : null));
            return;
        }

        let rivalTeam;
        if (isTournament) rivalTeam = opponent.rival.team;
        else rivalTeam = isWild ? [opponent.card] : npc.team.slice(0, 3);
        if (rivalTeam.length === 0) {
            // Entrenador sin equipo definido en el editor: un dino al azar de nivel parecido al tuyo
            const dinos = this.cards.catalog.dinos;
            const dino = dinos[Math.floor(Math.random() * dinos.length)];
            const avg = Math.round(myTeam.reduce((s, c) => s + c.level, 0) / myTeam.length);
            rivalTeam = [{ species: dino.id, level: avg }];
        }

        const wantedMove = isTournament ? (opponent.player.move || null) : this.cards.getPlayerMoveCard();
        const playerMove = wantedMove && this.cards.getAttack(wantedMove) ? wantedMove : null;
        const rivalMoveId = isTournament ? opponent.rival.move : (!isWild && npc.moveCard);
        const rivalMove = rivalMoveId && this.cards.getAttack(rivalMoveId) ? rivalMoveId : null;
        const title = isTournament ? opponent.title : (isWild ? opponent.title : npc.name);
        this.battle = {
            kind,
            npc,
            opponent,
            wildCard: isWild ? opponent.card : null,
            title,
            names: {
                player: isTournament ? opponent.player.name : this.game.localPlayer.name,
                rival: isTournament ? opponent.rival.name : title
            },
            humans: { player: true, rival: !!(isTournament && opponent.rival.human) },
            ai: (isTournament ? opponent.rival.ai : (npc && npc.data && npc.data.ai)) || 'normal',
            useItems: !isTournament,
            player: myTeam.map((c, i) => this.makeFighter(c, 'player', i, playerMove)),
            rival: rivalTeam.map((m, i) => this.makeFighter(m, 'rival', i, rivalMove)),
            moves: { player: playerMove, rival: rivalMove },
            playerMove,
            rivalMove,
            phase: 'intro',    // intro | round | human | ai | over
            queue: [],         // orden de la ronda: todos los dinos, del más rápido al más lento
            qi: -1,            // posición en el orden
            turn: null,        // bando del dino humano que está eligiendo acción
            actor: null,       // índice del dino que está eligiendo acción
            aiActor: null,     // dino de la IA que está actuando
            acted: new Set(),  // dinos que ya actuaron en esta ronda
            pending: null,     // ataque elegido esperando objetivo
            oneMore: false,    // el actor tiene una acción extra (¡Una más!)
            batonChain: [],    // dinos que ya pasaron el relevo en esta cadena
            lastDinoAnnounced: {},
            busy: false,
            round: 0,
            over: null
        };

        document.getElementById('battleTrainerName').textContent = title;
        this.overlay.classList.toggle('wild', isWild);
        this.overlay.classList.toggle('pvp', this.battle.humans.rival);
        this.windowEl.classList.remove('defeat', 'victory');
        if (this.logEl) this.logEl.innerHTML = '';
        this.turnEl.textContent = '';
        this.fx.clear();
        this.applySpeed();
        this.overlay.style.display = 'flex';
        this.buildArena();
        this.render();
        this.splash(isWild ? '¡SALVAJE!' : (isTournament ? '¡A LUCHAR!' : '¡DESAFÍO!'), 'intro');
        if (isTournament) {
            (opponent.intro || []).forEach(line => this.log(line));
        } else {
            this.log(isWild ? `🌿 ¡Un ${title} aparece entre la hierba alta!` : `⚔️ ¡${npc.name} te desafía a un combate!`);
        }
        if (rivalMove) this.log(`🃏 ${escapeHtml(this.battle.names.rival)} lleva la carta de movimiento <strong>${this.cards.getAttack(rivalMove).name}</strong>.`);
        this.battle.player.filter(f => f.tired).forEach(f =>
            this.log(`${f.tired.icon} ${f.name} está ${f.tired.label.toLowerCase()}: pelea con −${Math.round((1 - f.tired.factor) * 100)}% de fuerza.`));
        this.beginDuel();
    }

    alive(side) {
        return this.battle[side].filter(f => f.hp > 0);
    }

    // ------------------------------------------------------------
    // Turnos: todos los dinos por velocidad
    // ------------------------------------------------------------
    /** Mientras las cartas salen al campo; luego empieza la primera ronda. */
    async beginDuel() {
        const b = this.battle;
        await this.wait(1500);
        if (this.battle !== b) return;
        this.startRound();
    }

    /** Orden de una ronda: todos los dinos vivos, del más rápido al más lento. */
    turnOrder() {
        const sideRank = (f) => (f.side === 'player' ? 0 : 1);
        return [...this.alive('player'), ...this.alive('rival')].sort((x, y) =>
            (y.vel - x.vel) || (y.level - x.level) || (sideRank(x) - sideRank(y)) || (x.idx - y.idx));
    }

    async startRound() {
        const b = this.battle;
        b.round++;
        b.queue = this.turnOrder();
        b.qi = -1;
        b.acted = new Set();
        b.phase = 'round';
        b.turn = null;
        b.actor = null;
        b.aiActor = null;
        const first = b.queue[0];
        this.turnEl.textContent = `💨 Ronda ${b.round}: orden por velocidad`;
        this.log(`💨 Ronda ${b.round}: ${b.queue.map(f => f.name).join(' → ')}`);
        this.banner(first.side, `RONDA ${b.round}`, `💨 ${first.name} es el más rápido`);
        this.render();
        await this.wait(800);
        if (this.battle !== b) return;
        this.nextTurn();
    }

    /** Pasa al siguiente dino del orden; si ya actuaron todos, empieza otra ronda. */
    async nextTurn() {
        const b = this.battle;
        if (!b || b.over) return;
        b.oneMore = false;
        b.batonChain = [];
        b.pending = null;
        b.turn = null;
        b.actor = null;
        b.aiActor = null;
        let f = null;
        while (++b.qi < b.queue.length) {
            const c = b.queue[b.qi];
            if (c.hp > 0 && !b.acted.has(c)) {
                f = c;
                break;
            }
        }
        if (!f) {
            this.startRound();
            return;
        }
        // Un dino derribado gasta su acción en levantarse
        if (f.down) {
            f.down = false;
            b.acted.add(f);
            b.phase = 'round';
            this.log(`💫 ${f.name} se levanta y pierde su acción.`);
            this.fx.cue(f, '💫 ¡Se levanta!', '#facc15');
            this.render();
            await this.wait(650);
            if (this.battle !== b) return;
            this.nextTurn();
            return;
        }
        if (b.humans[f.side]) {
            this.fx.cue(f, b.humans.rival ? `🎮 ¡Turno de ${b.names[f.side]}!` : '¡TU TURNO!', f.side === 'player' ? '#38bdf8' : '#fb7185');
            this.setActor(f);
        } else {
            this.aiTurn(f);
        }
    }

    /** Un dino humano elige qué hacer (también tras ¡Una más! o un relevo). */
    setActor(f) {
        const b = this.battle;
        b.phase = 'human';
        b.turn = f.side;
        b.actor = f.idx;
        b.pending = null;
        f.guarding = false; // la defensa dura hasta su siguiente acción
        const who = b.humans.rival ? `${b.names[f.side]} · ` : '';
        this.turnEl.textContent = `${f.side === 'player' ? '🟢' : '🔴'} Ronda ${b.round}: ${who}${f.name}${b.oneMore ? ' · ¡UNA MÁS!' : ''}`;
        this.render();
    }

    /** Turno de un dino de la IA (si derriba a uno tuyo, actúa otra vez: máximo RIVAL_MAX_EXTRA). */
    async aiTurn(f) {
        const b = this.battle;
        b.phase = 'ai';
        b.turn = null;
        b.actor = null;
        b.aiActor = f;
        f.guarding = false;
        this.turnEl.textContent = `🔴 Ronda ${b.round}: ${f.name}`;
        this.render();
        await this.wait(AI_DELAY);
        if (this.battle !== b) return;
        for (let extra = 0; extra <= RIVAL_MAX_EXTRA; extra++) {
            const action = this.chooseAIAction(f, extra > 0);
            if (action.guard) {
                f.guarding = true;
                f.lastMove = null;
                this.log(`🛡️ ${f.name} se pone en guardia.`);
                this.fx.cue(f, '🛡️ ¡En guardia!', '#7dd3fc');
                this.render();
                await this.wait(600);
                if (this.battle !== b) return;
                break;
            }
            const result = await this.performAttack(f, action.target, action.attackId);
            if (this.battle !== b) return;
            if (this.checkEnd()) return;
            if (!result.knocked || f.hp <= 0) break;
            this.splash('¡UNA MÁS!', 'rival');
            this.log(`🔁 ¡${f.name} actúa otra vez!`);
            await this.wait(BATTLE_DELAY);
            if (this.battle !== b) return;
        }
        b.acted.add(f);
        this.nextTurn();
    }

    /** El dino al que le toca ahora (humano o de la IA). */
    currentFighter() {
        const b = this.battle;
        if (!b) return null;
        return b.phase === 'ai' ? b.aiActor : this.currentActor();
    }

    // ------------------------------------------------------------
    // Inteligencia artificial
    // ------------------------------------------------------------
    /** Daño estimado (sin azar) del mejor ataque de `a` contra `t`, en proporción de su vida actual. */
    bestHitRatio(a, t, side) {
        const b = this.battle;
        const ids = b.moves[side] ? [...a.attacks, b.moves[side]] : a.attacks;
        let best = 0;
        for (const id of ids) {
            const atk = this.cards.getAttack(id);
            if (!atk || atk.power <= 0 || !this.canUse(a, id)) continue;
            best = Math.max(best, this.calcDamage(a, t, atk, false).damage / Math.max(1, t.hp));
        }
        return best;
    }

    /** Lo peligroso que es un dino rival para nuestro equipo (0..n). */
    threatOf(foe, mySide) {
        if (foe.hp <= 0) return 0;
        const mine = this.alive(mySide);
        return Math.max(0, ...mine.map(m => this.bestHitRatio(foe, m, foe.side))) * (foe.intimidated ? INTIMIDATE_FACTOR : 1);
    }

    /**
     * Elige la acción de un dino controlado por la IA: { attackId, target } o { guard: true }.
     * normal: daño esperado y remates, con un 20% de azar.
     * dificil / experto: además se defiende si corre peligro, busca derribos, intimida al más peligroso, evita golpear a quien se defiende y remata primero
     * al dino que más daño puede hacer.
     */
    chooseAIAction(f, isExtra = false) {
        const b = this.battle;
        const level = b.ai || 'normal';
        const mySide = f.side;
        const foeSide = otherSide(mySide);
        const targets = this.alive(foeSide);
        const allies = this.alive(mySide);
        const move = b.moves[mySide];
        const pool = (move ? [...f.attacks, move] : f.attacks).filter(id => this.canUse(f, id));
        const options = pool.length ? pool : f.attacks;

        if (Math.random() < (AI_RANDOM[level] ?? 0.2)) {
            return {
                attackId: options[Math.floor(Math.random() * options.length)],
                target: targets[Math.floor(Math.random() * targets.length)]
            };
        }
        const smart = level !== 'normal';

        // Defenderse: poca vida y algún rival puede debilitarlo o derribarlo
        if (smart && !isExtra && allies.length > 1 && f.hp < f.maxHp * 0.4) {
            const danger = targets.some(t => !t.down && this.bestHitRatio(t, f, foeSide) >= 1);
            const canKill = targets.some(t => this.bestHitRatio(f, t, mySide) >= 1);
            if (danger && !canKill && Math.random() < (level === 'experto' ? 0.75 : 0.5)) return { guard: true };
        }

        const threats = new Map(targets.map(t => [t, smart ? this.threatOf(t, mySide) : 0]));
        const topThreat = targets.reduce((a, t) => (threats.get(t) > threats.get(a) ? t : a), targets[0]);
        let best = { attackId: options[0], target: targets[0], score: -Infinity };
        for (const id of options) {
            const a = this.cards.getAttack(id);
            if (!a) continue;
            for (const t of targets) {
                let score;
                if (a.power <= 0) {
                    // Intimidar: solo al rival más peligroso y si no está intimidado ya
                    score = !smart ? (t.intimidated ? 0 : 5)
                        : (t === topThreat && !t.intimidated && !t.down ? 18 + threats.get(t) * 30 : -5);
                } else {
                    const { damage, mult } = this.calcDamage(f, t, a, false);
                    const kills = damage >= t.hp;
                    if (!smart) {
                        score = damage + (kills ? 1000 : 0) + (mult > 1 && !t.down && !t.guarding ? 40 : 0);
                    } else {
                        score = Math.min(1, damage / t.maxHp) * 100;
                        if (kills) score += 220 + threats.get(t) * 120;
                        const knocks = !kills && mult > 1 && !t.down && !t.guarding;
                        if (knocks) score += 70;
                        if (t.guarding) score -= 25;
                        if (level === 'experto') score += threats.get(t) * 25;
                    }
                }
                if (score > best.score) best = { attackId: id, target: t, score };
            }
        }
        return best;
    }

    // ------------------------------------------------------------
    // Acciones del jugador (bando humano en su turno)
    // ------------------------------------------------------------
    get foeSide() {
        return otherSide(this.battle.turn || 'player');
    }

    currentActor() {
        const b = this.battle;
        return b && b.turn && b.actor !== null ? b[b.turn][b.actor] : null;
    }

    chooseAttack(attackId) {
        const b = this.battle;
        if (!b || b.phase !== 'human' || b.busy) return;
        const me = this.currentActor();
        if (!me || !this.canUse(me, attackId)) return;
        const targets = this.alive(this.foeSide);
        if (targets.length === 1) {
            this.humanAct(attackId, targets[0]);
            return;
        }
        b.pending = attackId;
        this.render();
    }

    chooseTarget(idx) {
        const b = this.battle;
        if (!b || !b.pending || b.busy) return;
        const target = b[this.foeSide][idx];
        if (!target || target.hp <= 0) return;
        this.humanAct(b.pending, target);
    }

    async humanAct(attackId, target) {
        const b = this.battle;
        const me = this.currentActor();
        b.busy = true;
        b.pending = null;
        me.boost = BATON_BOOSTS[Math.min(b.batonChain.length, BATON_BOOSTS.length - 1)];
        this.render();
        const result = await this.performAttack(me, target, attackId);
        if (this.battle !== b) return;
        me.boost = 1;
        b.busy = false;
        b.acted.add(me);   // si recibió un relevo antes de su turno, ya no vuelve a actuar en esta ronda
        if (this.checkEnd()) return;

        if (result.knocked) {
            // ¡Una más! El mismo dino vuelve a actuar (o pasa el relevo)
            b.oneMore = true;
            this.splash('¡UNA MÁS!', 'player');
            this.log(`🔁 <strong>¡UNA MÁS!</strong> ${me.name} puede actuar otra vez.`);
            this.setActor(me);
            return;
        }
        this.nextTurn();
    }

    guard() {
        const b = this.battle;
        if (!b || b.phase !== 'human' || b.busy) return;
        const me = this.currentActor();
        if (!me) return;
        me.guarding = true;
        me.lastMove = null;
        b.acted.add(me);
        this.log(`🛡️ ${me.name} se pone en guardia: recibirá la mitad de daño y no podrá ser derribado.`);
        this.fx.cue(me, '🛡️ ¡En guardia!', '#7dd3fc');
        this.nextTurn();
    }

    /** Pasa la acción extra a otro dino del equipo, con más poder. */
    async batonPass(idx) {
        const b = this.battle;
        if (!b || !b.oneMore || b.busy) return;
        const from = this.currentActor();
        const to = b[b.turn][idx];
        if (!from || !to || to.hp <= 0 || to.idx === from.idx || b.batonChain.includes(to.idx)) return;
        b.batonChain.push(from.idx);
        const boost = BATON_BOOSTS[Math.min(b.batonChain.length, BATON_BOOSTS.length - 1)];
        b.busy = true;
        this.render();
        await this.fx.relay(from, to);
        if (this.battle !== b) return;
        b.busy = false;
        this.splash('¡RELEVO!', 'baton');
        this.log(`🤝 ${from.name} pasa el relevo a ${to.name}: su ataque hará <strong>x${boost}</strong> de daño.`);
        this.setActor(to);
    }

    /** Termina la acción extra sin hacer nada más. */
    skipExtra() {
        const b = this.battle;
        if (!b || !b.oneMore || b.busy) return;
        this.nextTurn();
    }

    flee() {
        const b = this.battle;
        if (!b || b.phase !== 'human' || b.busy || !this.canFlee(b)) return;
        this.close();
        this.report(b, 'fled');
    }

    /** De los combates de historia y del torneo no se puede huir. */
    canFlee(b) {
        if (b.kind === 'tournament') return false;
        return !(b.kind === 'trainer' && b.npc && b.npc.data && b.npc.data.story);
    }

    // ------------------------------------------------------------
    // Daño
    // ------------------------------------------------------------
    calcDamage(attacker, defender, attack, random = true, crit = false) {
        const b = this.battle;
        const useItem = attacker.side === 'player' && (!b || b.useItems);
        const power = useItem ? this.cards.getAttackPower(attack) : attack.power;
        const special = attack.category === 'especial';
        const atkStat = special ? attacker.spa : attacker.atk;
        const defStat = special ? defender.spd : defender.def;
        const mult = this.cards.getTypeMultiplier(attack.element, defender.element);
        const levelScale = (attacker.level + defender.level) / 50;
        const intimidation = attacker.intimidated ? INTIMIDATE_FACTOR : 1;
        const guard = defender.guarding ? GUARD_FACTOR : 1;
        const variance = random ? 0.9 + Math.random() * 0.1 : 0.95;
        const critMult = crit ? CRIT_FACTOR : 1;
        const damage = Math.max(1, Math.round(power * (atkStat / Math.max(1, defStat)) * levelScale * mult
            * intimidation * guard * variance * critMult * (attacker.boost || 1)));
        return { damage, mult };
    }

    ownerLabel(f) {
        const b = this.battle;
        if (b.kind === 'tournament') return `[${escapeHtml(b.names[f.side])}]`;
        if (f.side === 'player') return 'Tu';
        return b.kind === 'wild' ? 'El' : 'El rival';
    }

    /**
     * Un ataque completo con su animación: el dino se prepara, sale de su carta (físico) o lanza su
     * elemento (especial), golpea y vuelve. Devuelve { knocked } = true si derribó al objetivo.
     */
    async performAttack(attacker, defender, attackId) {
        const b = this.battle;
        const attack = this.cards.getAttack(attackId) || { id: attackId, name: attackId, element: 'normal', power: 20, category: 'fisico' };
        const el = this.cards.catalog.elements[attack.element];
        const cat = this.cards.getCategory(attack);
        attacker.lastMove = attackId;
        // El ataque fuerte entra en recarga
        const cd = this.cards.attackCooldown(attacker.attacks, attackId);
        if (cd) attacker.readyRound[attackId] = b.round + cd + 1;
        this.log(`${el ? el.icon : '•'}${cat.icon} ${this.ownerLabel(attacker)} ${attacker.name} usó ${attack.moveCard ? '🃏 ' : ''}<strong>${escapeHtml(attack.name)}</strong> contra ${defender.name}.`);
        b.striking = { attacker, defender, attack };
        this.render();
        await this.fx.windup(attacker, attack);
        if (this.battle !== b) return { knocked: false };

        if (attack.power <= 0) {
            this.fx.roar(attacker);
            defender.intimidated = true;
            this.log(`😨 ${defender.name} quedó intimidado: su próximo ataque hará menos daño.`);
            b.striking = null;
            this.render();
            await this.wait(BATTLE_DELAY);
            return { knocked: false };
        }

        const crit = attack.category !== 'especial' && Math.random() < CRIT_CHANCE;
        const { damage, mult } = this.calcDamage(attacker, defender, attack, true, crit);
        const weak = mult > 1;
        const resisted = mult < 1;
        const physical = attack.category !== 'especial';

        // Viaje: el dino cruza el campo (físico) o lanza su elemento (especial)
        const comeBack = physical ? await this.fx.dash(attacker, defender) : null;
        if (!physical) await this.fx.projectile(attacker, defender, attack.element);
        if (this.battle !== b) {
            if (comeBack) comeBack();
            return { knocked: false };
        }

        attacker.intimidated = false;
        const guarded = defender.guarding;
        defender.hp = Math.max(0, defender.hp - damage);
        const knocked = (weak || crit) && !defender.down && !defender.guarding && defender.hp > 0;
        if (knocked) defender.down = true;
        const ko = defender.hp <= 0;
        this.fx.impact(attacker, defender, { damage, weak: weak && !guarded, crit, resisted, guarded, element: attack.element, physical, ko });
        if (ko) this.fx.ko(defender);
        this.render();
        this.log(`💥 ${defender.name} recibe ${damage} de daño.${weak ? ' <span class="log-effective">¡Es muy eficaz!</span>' : ''}${resisted ? ' <span style="color:#94a3b8;">No es muy eficaz...</span>' : ''}${crit ? ' <span class="log-effective">¡Crítico!</span>' : ''}${guarded ? ' 🛡️' : ''}`);
        if (knocked) this.log(`💫 <strong>¡${defender.name} fue derribado!</strong>`);
        if (ko) {
            this.log(`☠️ ${defender.name} se debilitó.`);
            this.announceLastDino(defender.side);
        }

        if (comeBack) await comeBack();
        else await this.wait(380);
        if (this.battle !== b) return { knocked };
        b.striking = null;
        this.render();
        await this.wait(ko ? 700 : 260);
        return { knocked };
    }

    /** Torneo: el árbitro avisa cuando a un bando le queda un solo dino. */
    announceLastDino(side) {
        const b = this.battle;
        const line = b.opponent && b.opponent.announcer && b.opponent.announcer.lastDino;
        if (!line || b.lastDinoAnnounced[side] || this.alive(side).length !== 1) return;
        b.lastDinoAnnounced[side] = true;
        this.log(`🎙️ <em>Árbitro:</em> ${escapeHtml(line.replace('{name}', b.names[side]))}`);
    }

    /** Devuelve true si el combate terminó. */
    checkEnd() {
        if (this.alive('rival').length === 0) {
            this.finish('won');
            return true;
        }
        if (this.alive('player').length === 0) {
            this.finish('lost');
            return true;
        }
        return false;
    }

    /** Avisa del resultado al juego (entrenador), al sistema de cartas (salvaje) o al torneo. */
    report(b, result) {
        if (b.kind !== 'tournament') this.cards.onBattleFatigue(b.kind === 'wild' ? 'wild' : 'trainer');
        if (b.kind === 'tournament') {
            if (b.opponent.onEnd) b.opponent.onEnd(result);
        } else if (b.kind === 'wild') {
            this.cards.onWildBattleEnd(result, b.wildCard);
        } else {
            this.game.endBattle(result, { defeated: b.rival.filter(f => f.hp <= 0).length });
        }
    }

    finish(result) {
        const b = this.battle;
        b.over = result;
        b.phase = 'over';
        b.actor = null;
        b.aiActor = null;
        b.turn = null;
        b.oneMore = false;
        b.striking = null;
        const winner = result === 'won' ? b.names.player : b.names.rival;
        const lostLocal = result === 'lost' && !b.humans.rival;
        const win = this.windowEl;
        win.classList.remove('defeat', 'victory');
        void win.offsetWidth;
        win.classList.add(lostLocal ? 'defeat' : 'victory');
        this.fx.cheer(result === 'won' ? 'player' : 'rival');
        if (b.kind === 'tournament') {
            this.turnEl.textContent = `🏆 Gana ${winner}`;
            this.splash(`¡GANA ${winner.toUpperCase()}!`, result === 'won' || b.humans.rival ? 'win' : 'lose');
            this.log(`🏆 <strong>${escapeHtml(winner)}</strong> gana el combate.`);
        } else {
            this.turnEl.textContent = result === 'won' ? '🏆 ¡Victoria!' : '💀 Derrota';
            this.splash(result === 'won' ? '¡VICTORIA!' : 'DERROTA', result === 'won' ? 'win' : 'lose');
            if (b.kind === 'wild') {
                this.log(result === 'won'
                    ? `🏆 ¡Derrotaste a ${b.title}! Ahora puedes capturarlo.`
                    : `💀 Tus dinos se debilitaron. ${b.title} vuelve a la hierba.`);
            } else {
                this.log(result === 'won'
                    ? `🏆 ¡Ganaste el combate contra ${b.title}!`
                    : `💀 Todos tus dinos se debilitaron. ${b.title} gana el combate.`);
            }
        }
        this.render();
    }

    close() {
        this.battle = null;
        this.windowEl.classList.remove('defeat', 'victory');
        this.overlay.style.display = 'none';
        this.overlay.classList.remove('pvp', 'wild');
        this.fx.clear();
        this.rivalRow.innerHTML = '';
        this.playerRow.innerHTML = '';
        if (this.bannerEl) this.bannerEl.className = 'duel-banner';
        if (document.activeElement) document.activeElement.blur();
    }

    // ------------------------------------------------------------
    // Teclado: números para ataques / objetivos, letras para el resto
    // ------------------------------------------------------------
    onKey(e) {
        if (!this.battle || e.repeat) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const b = this.battle;
        if (key === 'v') {
            e.preventDefault();
            this.toggleSpeed();
            return;
        }
        if (b.pending && /^[1-9]$/.test(key)) {
            const foes = b[this.foeSide].filter(f => f.hp > 0);
            const foe = foes[Number(key) - 1];
            if (foe) this.chooseTarget(foe.idx);
            e.preventDefault();
            return;
        }
        if (key === 'Escape' && b.pending) {
            b.pending = null;
            this.render();
            return;
        }
        const action = this.hotkeys[key];
        if (action) {
            e.preventDefault();
            e.stopPropagation();
            action();
        }
    }

    // ------------------------------------------------------------
    // Interfaz: textos grandes
    // ------------------------------------------------------------
    log(html) {
        if (!this.logEl) return;   // el registro del combate ya no se muestra
        const line = document.createElement('div');
        line.innerHTML = html;
        this.logEl.appendChild(line);
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    /** Texto grande que cruza la pantalla (¡UNA MÁS!, ¡RELEVO!, ¡VICTORIA!...). */
    splash(text, kind = '') {
        const el = this.splashEl;
        if (!el) return;
        el.className = 'battle-splash';
        el.innerHTML = `<span>${escapeHtml(text)}</span>`;
        void el.offsetWidth;
        el.className = `battle-splash show ${kind}`;
        clearTimeout(this.splashTimer);
        this.splashTimer = setTimeout(() => { el.className = 'battle-splash'; }, 950);
    }

    /** Franja que cruza el campo al empezar cada ronda. */
    banner(side, big, small = '') {
        const el = this.bannerEl;
        if (!el || !this.battle) return;
        el.className = 'duel-banner';
        el.innerHTML = `<div>${small ? `<small>${escapeHtml(small)}</small>` : ''}<b>${escapeHtml(big)}</b></div>`;
        void el.offsetWidth;
        el.className = `duel-banner show ${side}`;
    }

    // ------------------------------------------------------------
    // Interfaz: el campo (se arma una vez por combate)
    // ------------------------------------------------------------
    slotEl(f) {
        const row = f.side === 'rival' ? this.rivalRow : this.playerRow;
        return row.querySelector(`.duel-slot[data-idx="${f.idx}"]`);
    }

    buildArena() {
        const b = this.battle;
        for (const side of ['rival', 'player']) {
            const row = side === 'rival' ? this.rivalRow : this.playerRow;
            row.innerHTML = '';
            const xs = SLOT_X[side][b[side].length] || SLOT_X[side][3];
            b[side].forEach((f, i) => {
                // Primero salen las cartas del rival y luego las tuyas
                const delay = (side === 'rival' ? 0.15 : 0.6) + i * 0.18;
                row.appendChild(this.createSlot(f, xs[i], delay));
            });
            this.renderTrainerPlate(side);
        }
        const slots = [...this.rivalRow.children, ...this.playerRow.children];
        clearTimeout(this.summonTimer);
        this.summonTimer = setTimeout(() => slots.forEach(s => s.classList.remove('summon')), 3200 / this.speed);
    }

    createSlot(f, x, delay) {
        const { elements } = this.cards.catalog;
        const el = elements[f.element];
        const color = el ? el.color : '#94a3b8';
        const art = this.cards.artUrl(f.dinoId, f.side === 'player' ? 'right' : 'left');
        const card = f.image ? `assets/dinos/${encodeURI(f.image)}` : '';
        const pose = this.cards.getPose(f.dinoId);
        const slot = document.createElement('div');
        slot.className = `duel-slot ${f.side} summon ${pose ? `pose-${pose}` : ''} ${art ? '' : 'no-art'}`;
        slot.dataset.side = f.side;
        slot.dataset.idx = f.idx;
        slot.style.cssText = `--x:${x}%;--el:${color};--k:${this.cards.sizeScale(f.dinoId).toFixed(2)};--d:${delay.toFixed(2)}s;--idle:${(-Math.random() * 3).toFixed(2)}s`;
        slot.title = `${f.name} · ${this.cards.sizeLabel(f.dinoId)} (tamaño ${this.cards.getSize(f.dinoId)}/6)`;
        slot.innerHTML = `
            <div class="duel-zone"><i class="duel-ring"></i></div>
            <div class="duel-card-anchor"><div class="duel-card-lie"><div class="duel-card-inner">
                <div class="duel-card-face ${f.fullCard ? 'full-card' : ''}" style="${card ? `background-image:url('${card}')` : ''}"></div>
                <div class="duel-card-back"></div>
            </div></div></div>
            <div class="duel-beam"></div>
            <div class="duel-shadow"></div>
            <div class="duel-dino-wrap">
                <div class="duel-dino-fx"><div class="duel-dino-pose">
                    <img class="duel-dino" src="${art || card}" alt="${escapeHtml(f.name)}" draggable="false">
                </div></div>
                <div class="duel-guard"></div>
                <div class="duel-dizzy"><i>✦</i><i>✦</i><i>✦</i></div>
                <div class="duel-reticle"></div>
                <div class="duel-tags"></div>
            </div>
            <div class="duel-plate">
                <span class="duel-order-n"></span>
                <div class="duel-plate-top"><span class="duel-name">${escapeHtml(f.name)}</span><span class="duel-status"></span><span class="duel-lv">Nv.${f.level}</span></div>
                <div class="duel-hp"><i class="duel-hp-ghost"></i><i class="duel-hp-fill"></i></div>
                <div class="duel-plate-bot"><span class="duel-el">${el ? el.icon : ''}</span><span class="duel-hp-text">❤️ <b data-v="${f.hp}">${f.hp}</b>/${f.maxHp}</span><span class="duel-vel">💨 ${f.vel}</span></div>
            </div>
            <div class="duel-badge"></div>`;
        slot.addEventListener('click', () => this.onSlotClick(f));
        return slot;
    }

    /** Clic en un dino del campo: elegirlo como objetivo o pasarle el relevo. */
    onSlotClick(f) {
        const b = this.battle;
        if (!b || b.phase !== 'human' || b.busy) return;
        if (b.pending) {
            if (f.side === this.foeSide && f.hp > 0) this.chooseTarget(f.idx);
            return;
        }
        if (b.oneMore && f.side === b.turn && f.idx !== b.actor) this.batonPass(f.idx);
    }

    /** Placa del entrenador (nombre y puntos de vida de todo su equipo, como los LP de Yu-Gi-Oh). */
    renderTrainerPlate(side) {
        const b = this.battle;
        const el = this.trainerEls[side];
        if (!el) return;
        const tag = side === 'player'
            ? (b.kind === 'tournament' ? (b.humans.rival ? 'JUGADOR 1' : 'TU EQUIPO') : 'TU EQUIPO')
            : (b.kind === 'wild' ? 'SALVAJE' : (b.humans.rival ? 'JUGADOR 2' : 'RIVAL'));
        const hp = b[side].reduce((s, f) => s + f.hp, 0);
        el.innerHTML = `
            <span class="duel-trainer-tag">${tag}</span>
            <b class="duel-trainer-name">${escapeHtml(b.names[side])}</b>
            <div class="duel-lp"><span>PV</span><b class="duel-lp-num" data-v="${hp}">${hp}</b><i class="duel-pips"></i></div>
            <div class="duel-lp-bar"><i class="duel-lp-fill"></i></div>`;
    }

    /** Cuenta un número hacia su nuevo valor (como los puntos de vida de Yu-Gi-Oh). */
    countTo(el, to) {
        if (!el) return;
        const from = Number(el.dataset.v);
        el.dataset.v = to;
        if (!Number.isFinite(from) || from === to) {
            el.textContent = to;
            return;
        }
        const t0 = performance.now();
        const dur = 650 / this.speed;
        const step = (t) => {
            if (el.dataset.v !== String(to)) return;   // llegó otro valor: esa animación manda
            const p = Math.min(1, (t - t0) / dur);
            el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    renderSlot(f, keys) {
        const b = this.battle;
        const slot = this.slotEl(f);
        if (!slot) return;
        const human = b.phase === 'human' && !b.busy;
        const isActor = b.phase === 'human' && f.side === b.turn && b.actor === f.idx;
        const aiActor = b.phase === 'ai' && b.aiActor === f;
        const targetable = human && b.pending && f.side === this.foeSide && f.hp > 0;
        const batonable = human && b.oneMore && f.side === b.turn && f.hp > 0 && !isActor && !b.batonChain.includes(f.idx);
        const done = b.acted.has(f) && !isActor && !aiActor && f.hp > 0;
        const striking = b.striking && (b.striking.attacker === f || b.striking.defender === f);
        const classes = {
            actor: isActor || aiActor,
            targetable, batonable, done,
            striking: !!striking,
            down: f.down && f.hp > 0,
            fainted: f.hp <= 0,
            guarding: f.guarding && f.hp > 0,
            intimidated: f.intimidated
        };
        for (const [cls, on] of Object.entries(classes)) slot.classList.toggle(cls, !!on);

        // Etiquetas sobre el dino: tecla, debilidad / resistencia contra el ataque elegido
        let tags = '';
        const key = keys.get(f);
        if (key) tags += `<kbd class="duel-key">${key}</kbd>`;
        if (targetable) {
            const a = this.cards.getAttack(b.pending);
            const mult = a && a.power > 0 ? this.cards.getTypeMultiplier(a.element, f.element) : 1;
            if (mult > 1) tags += `<span class="duel-eff weak">DÉBIL x${this.cards.typeChart.effective}</span>`;
            else if (mult < 1) tags += `<span class="duel-eff resist">RESISTE x${mult}</span>`;
        }
        if (batonable) tags += '<span class="duel-eff baton">🤝 RELEVO</span>';
        const tagsEl = slot.querySelector('.duel-tags');
        if (tagsEl.innerHTML !== tags) tagsEl.innerHTML = tags;

        const badge = f.hp <= 0 ? '<span class="ko">K.O.</span>' : (f.down ? '<span class="down">DERRIBADO</span>' : '');
        const badgeEl = slot.querySelector('.duel-badge');
        if (badgeEl.innerHTML !== badge) badgeEl.innerHTML = badge;

        // Placa: vida, estado y velocidad
        const pct = Math.max(0, Math.round((f.hp / f.maxHp) * 100));
        const fill = slot.querySelector('.duel-hp-fill');
        fill.style.width = `${pct}%`;
        fill.className = `duel-hp-fill ${pct > 50 ? 'high' : (pct > 20 ? 'mid' : 'low')}`;
        slot.querySelector('.duel-hp-ghost').style.width = `${pct}%`;
        this.countTo(slot.querySelector('.duel-hp-text b'), f.hp);
        const status = `${f.guarding && f.hp > 0 ? '🛡️' : ''}${f.intimidated ? '😨' : ''}${f.tired ? f.tired.icon : ''}${f.boost > 1 ? `x${f.boost}` : ''}`;
        const statusEl = slot.querySelector('.duel-status');
        if (statusEl.textContent !== status) statusEl.textContent = status;

        // Puesto en el orden de la ronda (por velocidad)
        const pos = b.queue.indexOf(f);
        const orderEl = slot.querySelector('.duel-order-n');
        const order = f.hp <= 0 || pos < 0 ? '' : (done ? '✔' : `${pos + 1}º`);
        if (orderEl.textContent !== order) orderEl.textContent = order;
        orderEl.classList.toggle('now', !!(isActor || aiActor));
        orderEl.classList.toggle('done', done);
    }

    renderTrainers() {
        const b = this.battle;
        for (const side of ['rival', 'player']) {
            const el = this.trainerEls[side];
            if (!el || !el.firstElementChild) continue;
            const hp = b[side].reduce((s, f) => s + f.hp, 0);
            const max = b[side].reduce((s, f) => s + f.maxHp, 0) || 1;
            this.countTo(el.querySelector('.duel-lp-num'), hp);
            el.querySelector('.duel-lp-fill').style.width = `${Math.round((hp / max) * 100)}%`;
            const pips = b[side].map(f => `<i class="${f.hp > 0 ? 'on' : ''}"></i>`).join('');
            const pipsEl = el.querySelector('.duel-pips');
            if (pipsEl.innerHTML !== pips) pipsEl.innerHTML = pips;
            const cur = this.currentFighter();
            el.classList.toggle('active', !!(cur && cur.side === side));
        }
    }

    /** Crea un botón del panel de órdenes con atajo de teclado. */
    addButton(cls, html, key, onClick, disabled = false, parent = this.actionsEl) {
        const btn = document.createElement('button');
        btn.className = cls;
        const keyLabel = key === ' ' ? 'Espacio' : (key === 'Escape' ? 'Esc' : (key || '').toUpperCase());
        btn.innerHTML = `${key ? `<kbd class="btn-key">${keyLabel}</kbd>` : ''}${html}`;
        btn.disabled = disabled;
        btn.addEventListener('click', onClick);
        parent.appendChild(btn);
        if (key && !disabled) this.hotkeys[key] = onClick;
        return btn;
    }

    render() {
        const b = this.battle;
        if (!b) return;
        this.hotkeys = {};
        // Números de tecla sobre los objetivos al elegir a quién atacar
        const keys = new Map();
        if (b.phase === 'human' && !b.busy && b.pending) this.alive(this.foeSide).forEach((f, i) => keys.set(f, i + 1));
        for (const f of [...b.rival, ...b.player]) this.renderSlot(f, keys);
        this.renderTrainers();
        this.renderCommand();
    }

    // ------------------------------------------------------------
    // Interfaz: panel de órdenes (a la derecha del campo)
    // ------------------------------------------------------------
    /** Mini carta + datos de un dino para la cabecera del panel. */
    dinoHead(f, subtitle) {
        const el = this.cards.catalog.elements[f.element];
        const card = f.image ? `assets/dinos/${encodeURI(f.image)}` : '';
        return `
            <div class="duel-cmd-dino" style="--el:${el ? el.color : '#94a3b8'}">
                <div class="duel-cmd-card ${f.fullCard ? 'full-card' : ''}" style="${card ? `background-image:url('${card}')` : ''}"></div>
                <div class="duel-cmd-info">
                    <small class="duel-cmd-sub">${subtitle}</small>
                    <b>${escapeHtml(f.name)}</b>
                    <small>${el ? `${el.icon} ${el.name}` : f.element} · Nv. ${f.level}</small>
                    <small>❤️ ${f.hp}/${f.maxHp} · 💨 ${f.vel}${f.tired ? ` · ${f.tired.icon}` : ''}</small>
                </div>
            </div>`;
    }

    /** Orden de la ronda (todos los dinos por velocidad): el que actúa, los que ya actuaron y los que vienen. */
    queueHtml() {
        const b = this.battle;
        const queue = b.queue.length ? b.queue : this.turnOrder();
        const now = this.currentFighter();
        const rows = queue.map((f, i) => {
            const art = this.cards.artUrl(f.dinoId, f.side === 'player' ? 'right' : 'left');
            const cls = [f.side, f === now ? 'now' : '', b.acted.has(f) && f !== now ? 'done' : '', f.hp <= 0 ? 'ko' : ''].join(' ');
            return `<li class="${cls}"><span class="q-n">${i + 1}</span>${art ? `<img src="${art}" alt="">` : ''}<span class="q-name">${escapeHtml(f.name)}</span><small>💨 ${f.vel}</small></li>`;
        }).join('');
        return `<p class="duel-cmd-text">💨 Ronda ${Math.max(1, b.round)} · orden por velocidad</p><ol>${rows}</ol>`;
    }

    /** Botón con el dino (arte, nombre, vida): para elegir a quién atacar. */
    dinoButton(f, key, onClick, extra = '') {
        const el = this.cards.catalog.elements[f.element];
        const art = this.cards.artUrl(f.dinoId, f.side === 'player' ? 'right' : 'left');
        const pct = Math.round((f.hp / f.maxHp) * 100);
        const btn = this.addButton('duel-pick',
            `${art ? `<img class="pick-art" src="${art}" alt="">` : ''}
             <span class="pick-info"><span class="pick-name"><b>${escapeHtml(f.name)}</b>${extra}</span>
                <small>${el ? el.icon : ''} ❤️ ${f.hp}/${f.maxHp} · 💨 ${f.vel}</small>
                <i class="pick-hp"><i style="width:${pct}%"></i></i></span>`,
            key, onClick, false, this.cmdList);
        btn.style.setProperty('--el', el ? el.color : '#94a3b8');
        return btn;
    }

    renderCommand() {
        const b = this.battle;
        const panel = this.actionsEl;
        panel.innerHTML = '';
        panel.classList.toggle('one-more', !!b.oneMore);
        panel.classList.toggle('rival-turn', b.phase === 'human' && b.turn === 'rival');
        const head = document.createElement('div');
        head.className = 'duel-cmd-head';
        const list = document.createElement('div');
        list.className = 'duel-cmd-list';
        const queue = document.createElement('div');
        queue.className = 'duel-queue';
        const foot = document.createElement('div');
        foot.className = 'duel-cmd-foot';
        panel.append(head, list, queue, foot);
        this.cmdList = list;
        if (!b.over) queue.innerHTML = this.queueHtml();

        // Fin del combate
        if (b.over) {
            const won = b.over === 'won';
            const title = b.kind === 'tournament'
                ? `🏆 Gana ${escapeHtml(won ? b.names.player : b.names.rival)}`
                : (won ? '🏆 ¡Victoria!' : '💀 Derrota');
            const sub = b.kind === 'wild' && won ? `¡${escapeHtml(b.title)} está a tu alcance!` : (won ? '¡Tus dinos lo dieron todo!' : 'Tus dinos necesitan descansar...');
            head.innerHTML = `<div class="duel-cmd-title ${won || b.humans.rival ? 'win' : 'lose'}">${title}</div><p class="duel-cmd-text">${sub}</p>`;
            const label = b.kind === 'wild' && won ? '🃏 Capturar' : '▶ Continuar';
            const done = () => {
                this.close();
                this.report(b, b.over);
            };
            this.addButton(`duel-btn primary ${won ? 'win' : ''}`, label, ' ', done, false, list);
            this.hotkeys.Enter = done;
            return;
        }

        if (b.phase === 'intro') {
            head.innerHTML = '<div class="duel-cmd-title">⚡ ¡Duelo!</div><p class="duel-cmd-text">Las cartas salen al campo. El orden de ataque lo decide la velocidad 💨 de cada dino.</p>';
            return;
        }

        if (b.phase === 'round') {
            head.innerHTML = `<div class="duel-cmd-title">💨 Ronda ${b.round}</div><p class="duel-cmd-text">Actúa primero el dino más rápido del campo, sea tuyo o del rival.</p>`;
            return;
        }

        // Turno de la IA
        if (b.phase === 'ai') {
            const f = b.aiActor;
            const whose = b.kind === 'wild' ? '¡Ataca el salvaje!' : `Turno de ${escapeHtml(b.names.rival)}`;
            head.innerHTML = f
                ? this.dinoHead(f, `⏳ ${whose}`)
                : `<div class="duel-cmd-title rival">⏳ ${whose}</div>`;
            const s = b.striking;
            if (s && s.attack && s.attacker === f) {
                const ael = this.cards.catalog.elements[s.attack.element];
                head.insertAdjacentHTML('beforeend', `<div class="duel-cmd-chosen" style="--el:${ael ? ael.color : '#94a3b8'}">${ael ? ael.icon : '•'} ${escapeHtml(s.attack.name)} ➜ ${escapeHtml(s.defender.name)}</div>`);
            }
            return;
        }

        const pvp = b.humans.rival ? `🎮 ${escapeHtml(b.names[b.turn])} · ` : '';

        // Ataque en marcha
        if (b.busy) {
            const me = this.currentActor();
            head.innerHTML = me ? this.dinoHead(me, `${pvp}⚔️ ¡Al ataque!`) : '';
            const s = b.striking;
            if (s && s.attack) {
                const ael = this.cards.catalog.elements[s.attack.element];
                head.insertAdjacentHTML('beforeend', `<div class="duel-cmd-chosen" style="--el:${ael ? ael.color : '#94a3b8'}">${ael ? ael.icon : '•'} ${escapeHtml(s.attack.name)} ➜ ${escapeHtml(s.defender.name)}</div>`);
            }
            return;
        }

        const me = this.currentActor();
        if (!me) return;

        // Elegir a quién atacar
        if (b.pending) {
            const a = this.cards.getAttack(b.pending);
            const ael = a && this.cards.catalog.elements[a.element];
            head.innerHTML = `${this.dinoHead(me, `${pvp}🎯 ¿A quién atacas?`)}
                <div class="duel-cmd-chosen" style="--el:${ael ? ael.color : '#94a3b8'}">${ael ? ael.icon : '•'} ${escapeHtml(a ? a.name : b.pending)}</div>`;
            this.alive(this.foeSide).forEach((f, i) => {
                const mult = a && a.power > 0 ? this.cards.getTypeMultiplier(a.element, f.element) : 1;
                const tag = mult > 1 ? '<em class="pick-tag weak">DÉBIL</em>' : (mult < 1 ? '<em class="pick-tag resist">RESISTE</em>' : '');
                this.dinoButton(f, String(i + 1), () => this.chooseTarget(f.idx), tag);
            });
            this.addButton('duel-btn flee', '↩ Cancelar', 'Escape', () => { b.pending = null; this.render(); }, false, foot);
            return;
        }

        // Elegir ataque
        const boost = BATON_BOOSTS[Math.min(b.batonChain.length, BATON_BOOSTS.length - 1)];
        head.innerHTML = this.dinoHead(me, b.oneMore
            ? `${pvp}🔁 ¡UNA MÁS!${boost > 1 ? ` · daño x${boost}` : ''}`
            : `${pvp}¿Qué hará?`);
        const { elements } = this.cards.catalog;
        const move = b.moves[b.turn];
        const attackIds = move ? [...me.attacks, move] : me.attacks;
        const foes = this.alive(this.foeSide);
        const useItem = b.turn === 'player' && b.useItems;
        attackIds.forEach((id, i) => {
            const a = this.cards.getAttack(id);
            if (!a) return;
            const ael = elements[a.element];
            const cat = this.cards.getCategory(a);
            const itemBoost = useItem && a.power > 0 ? this.cards.getElementBoost(a.element) : 0;
            const eff = a.power > 0 && foes.some(f => !f.down && this.cards.getTypeMultiplier(a.element, f.element) > 1);
            const cd = this.cards.attackCooldown(me.attacks, id);
            const wait = Math.min(this.turnsToWait(me, id), cd);   // en el mismo turno en que se usó cuenta desde el siguiente
            const cooldown = wait > 0;
            const role = cd ? `💥 recarga ${cd}` : '♾️ siempre';
            const btn = this.addButton(
                `duel-atk ${cd ? 'strong' : ''} ${cooldown ? 'cooldown' : ''} ${eff ? 'eff' : ''}`,
                `<span class="atk-icon">${ael ? ael.icon : '•'}</span>
                 <span class="atk-main">
                    <span class="atk-name">${escapeHtml(a.name)}</span>
                    <span class="atk-meta">${cat.icon} ${cat.name} · ${role}</span>
                 </span>
                 <span class="atk-pow">${a.power > 0 ? a.power + itemBoost : '—'}${itemBoost ? `<em>+${itemBoost}</em>` : ''}</span>
                 ${eff ? '<em class="atk-tag">DÉBIL</em>' : ''}
                 ${cooldown ? `<span class="atk-wait">⏳ ${wait} turno${wait > 1 ? 's' : ''}</span>` : ''}`,
                String(i + 1),
                () => this.chooseAttack(id),
                cooldown,
                list
            );
            btn.style.setProperty('--el', ael ? ael.color : '#94a3b8');
            btn.title = `${cat.name}${cd ? ` · Ataque fuerte: después de usarlo espera ${cd} turno(s)` : ' · Ataque normal: siempre disponible'}`;
        });

        if (b.oneMore) {
            const mates = this.alive(b.turn).filter(f => f.idx !== me.idx && !b.batonChain.includes(f.idx));
            const keys = ['z', 'x', 'c'];
            mates.forEach((m, i) => {
                this.addButton('duel-btn baton', `🤝 Relevo a ${escapeHtml(m.name)}`, keys[i], () => this.batonPass(m.idx), false, foot);
            });
            this.addButton('duel-btn flee', '⏭ Terminar', 'q', () => this.skipExtra(), false, foot);
            return;
        }

        this.addButton('duel-btn guard', '🛡️ Defender', 'd', () => this.guard(), false, foot);
        if (this.canFlee(b)) this.addButton('duel-btn flee', '🏃 Huir', 'h', () => this.flee(), false, foot);
    }
}
