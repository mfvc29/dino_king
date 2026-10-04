/**
 * BattleSystem - Combate por turnos 3 contra 3 al estilo Persona 5, contra entrenadores,
 * dinos salvajes y en el Gran Torneo Mesozoico (incluido jugador contra jugador en la misma pantalla).
 *
 * - Todos los dinos están en el campo a la vez. Una moneda decide qué bando actúa primero;
 *   después cada bando actúa por completo (cada dino vivo hace una acción) y pasa el turno.
 * - En tu turno eliges, para cada dino: un ataque o la carta de movimiento y a qué rival
 *   atacar, o "Defender" (recibe la mitad de daño y no puede ser derribado). También puedes huir.
 * - DERRIBO y ¡UNA MÁS!: un ataque eficaz por tipo (o un golpe crítico físico) derriba al
 *   objetivo y el atacante actúa otra vez. Un dino derribado pierde su siguiente acción
 *   (la usa para levantarse).
 * - RELEVO: durante "¡Una más!" puedes pasar la acción extra a otro dino de tu equipo; su ataque
 *   hace +50% de daño (+100% si se encadenan dos relevos).
 * - ATAQUE TOTAL: si todos los rivales están derribados, todo tu equipo ataca a la vez.
 * - El ataque más fuerte de cada dino no se puede usar dos veces seguidas.
 * - Ataques físicos usan ataque/defensa físicos; los especiales, ataque/defensa especiales.
 * - Daño = poder (+5 del objeto) x (ataque / defensa) x (nivel propio + nivel rival) / 50
 *   x ventaja de tipo x variación aleatoria (x1.5 si es crítico).
 * - Ataques de estado (poder 0, p. ej. Rugido) intimidan: el siguiente ataque del objetivo hace -30%.
 * - IA de los rivales (campo "ai" del entrenador): 'normal', 'dificil' o 'experto'. La difícil y la
 *   experta se defienden cuando corren peligro, buscan derribos para encadenar acciones, preparan
 *   y lanzan Ataques totales, intimidan al dino más peligroso y rematan al que pueden debilitar.
 */

const BATTLE_DELAY = 700;
const INTIMIDATE_FACTOR = 0.7;
const GUARD_FACTOR = 0.5;
const CRIT_CHANCE = 0.08;
const CRIT_FACTOR = 1.5;
const BATON_BOOSTS = [1, 1.5, 2];
const ALL_OUT_POWER = 45;
const RIVAL_MAX_EXTRA = 2;
const AI_RANDOM = { normal: 0.2, dificil: 0.08, experto: 0 };

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const otherSide = (side) => (side === 'player' ? 'rival' : 'player');

class BattleSystem {
    constructor(game) {
        this.game = game;
        this.battle = null;

        this.overlay = document.getElementById('battleOverlay');
        this.logEl = document.getElementById('battleLog');
        this.actionsEl = document.getElementById('battleActions');
        this.coinEl = document.getElementById('battleCoin');
        this.turnEl = document.getElementById('battleTurn');
        this.splashEl = document.getElementById('battleSplash');
        this.hotkeys = {};

        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    get cards() {
        return this.game.cards;
    }

    get isActive() {
        return !!this.battle;
    }

    // ------------------------------------------------------------
    // Preparación
    // ------------------------------------------------------------
    makeFighter(src, side, idx, moveId) {
        const dinoId = src.id || src.species;
        const dino = this.cards.getDino(dinoId);
        const level = Math.max(1, Number(src.level) || 1);
        const stats = this.cards.getStats(dinoId, level);
        const attacks = (src.attacks && src.attacks.length) ? src.attacks.slice(0, 3)
            : (dino ? this.cards.getDefaultAttacks(dino, level) : ['embestida']);
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
            intimidated: false,
            guarding: false,
            down: false,
            boost: 1,
            lastMove: null
        };
        f.strongest = this.strongestMove(f, moveId);
        return f;
    }

    /** El ataque más fuerte del dino (entre sus 3 ataques y la carta de movimiento). */
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

    /** El ataque más fuerte no se puede repetir dos veces seguidas. */
    canUse(f, id) {
        return !(id === f.strongest && f.lastMove === id);
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

        const playerMove = isTournament ? (opponent.player.move || null) : this.cards.getPlayerMoveCard();
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
            phase: 'coin',
            turn: null,        // bando que está eligiendo acción (humano)
            actor: null,       // índice del dino que está eligiendo acción
            acted: new Set(),  // dinos que ya actuaron este turno
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
        this.logEl.innerHTML = '';
        this.turnEl.textContent = '';
        this.overlay.style.display = 'flex';
        this.render();
        this.splash(isWild ? '¡SALVAJE!' : (isTournament ? '¡A LUCHAR!' : '¡DESAFÍO!'), 'intro');
        if (isTournament) {
            (opponent.intro || []).forEach(line => this.log(line));
        } else {
            this.log(isWild ? `🌿 ¡Un ${title} aparece entre la hierba alta!` : `⚔️ ¡${npc.name} te desafía a un combate!`);
        }
        if (rivalMove) this.log(`🃏 ${escapeHtml(this.battle.names.rival)} lleva la carta de movimiento <strong>${this.cards.getAttack(rivalMove).name}</strong>.`);
        this.flipCoin();
    }

    alive(side) {
        return this.battle[side].filter(f => f.hp > 0);
    }

    // ------------------------------------------------------------
    // Moneda y turnos
    // ------------------------------------------------------------
    async flipCoin() {
        const b = this.battle;
        await sleep(900);
        if (this.battle !== b) return;
        this.log('🪙 Se lanza una moneda para decidir qué bando ataca primero...');
        this.coinEl.className = 'battle-coin flipping';
        this.coinEl.textContent = '🪙';
        await sleep(1300);
        if (this.battle !== b) return;

        const playerFirst = Math.random() < 0.5;
        b.firstSide = playerFirst ? 'player' : 'rival';
        this.coinEl.className = `battle-coin landed ${playerFirst ? 'heads' : 'tails'}`;
        this.coinEl.textContent = playerFirst ? 'CARA' : 'CRUZ';
        this.log(playerFirst ? `🪙 ¡Cara! ${b.kind === 'tournament' ? escapeHtml(b.names.player) : 'Tu equipo'} actúa primero.` : `🪙 ¡Cruz! ${escapeHtml(b.names.rival)} actúa primero.`);
        await sleep(BATTLE_DELAY);
        if (this.battle !== b) return;

        this.startSide(b.firstSide);
    }

    startSide(side) {
        const b = this.battle;
        if (side === b.firstSide) b.round++;
        if (b.humans[side]) {
            b.phase = 'human';
            b.turn = side;
            b.acted = new Set();
            b.oneMore = false;
            b.batonChain = [];
            // Los dinos derribados gastan su acción en levantarse
            for (const f of this.alive(side)) {
                if (f.down) {
                    f.down = false;
                    b.acted.add(f.idx);
                    this.log(`💫 ${f.name} se levanta y pierde su acción.`);
                }
            }
            if (b.humans.rival) this.splash(`TURNO DE ${b.names[side].toUpperCase()}`, side === 'player' ? 'baton' : 'rival');
            this.nextHumanActor();
        } else {
            this.aiPhase(side);
        }
    }

    /** Pasa al siguiente dino del bando humano que no haya actuado; si no quedan, cambia de bando. */
    nextHumanActor() {
        const b = this.battle;
        b.oneMore = false;
        b.batonChain = [];
        const next = b[b.turn].find(f => f.hp > 0 && !b.acted.has(f.idx));
        if (!next) {
            b.actor = null;
            this.startSide(otherSide(b.turn));
            return;
        }
        this.setActor(next);
    }

    setActor(f) {
        const b = this.battle;
        b.actor = f.idx;
        b.pending = null;
        f.guarding = false; // la defensa dura hasta su siguiente acción
        const who = b.humans.rival ? `${b.names[b.turn]} · ` : '';
        this.turnEl.textContent = `${b.turn === 'player' ? '🟢' : '🔴'} Turno ${b.round}: ${who}${f.name}${b.oneMore ? ' · ¡UNA MÁS!' : ''}`;
        this.render();
    }

    async aiPhase(side) {
        const b = this.battle;
        b.phase = 'ai';
        b.turn = null;
        b.actor = null;
        this.turnEl.textContent = `🔴 Turno ${b.round}: ${b.names[side]}`;
        this.render();
        const smart = b.ai !== 'normal';

        for (const f of b[side]) {
            if (f.hp <= 0) continue;
            await sleep(BATTLE_DELAY);
            if (this.battle !== b) return;
            if (f.down) {
                f.down = false;
                this.log(`💫 ${f.name} se levanta y pierde su acción.`);
                this.render();
                continue;
            }
            f.guarding = false;
            // Si derriba a un dino tuyo, actúa otra vez (máximo RIVAL_MAX_EXTRA veces)
            for (let extra = 0; extra <= RIVAL_MAX_EXTRA; extra++) {
                if (extra > 0 && smart && this.allDown(otherSide(side))) {
                    await this.allOutAttack(side, f);
                    if (this.battle !== b) return;
                    break;
                }
                const action = this.chooseAIAction(f, extra > 0);
                if (action.guard) {
                    f.guarding = true;
                    f.lastMove = null;
                    this.log(`🛡️ ${f.name} se pone en guardia.`);
                    this.render();
                    break;
                }
                const result = await this.performAttack(f, action.target, action.attackId);
                if (this.battle !== b) return;
                if (this.checkEnd()) return;
                if (!result.knocked || f.hp <= 0) break;
                this.splash('¡UNA MÁS!', 'rival');
                this.log(`🔁 ¡${f.name} actúa otra vez!`);
                await sleep(BATTLE_DELAY);
                if (this.battle !== b) return;
            }
        }
        this.startSide(otherSide(side));
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
     * dificil / experto: además se defiende si corre peligro, busca derribos (y preparar el Ataque
     * total), intimida al más peligroso, evita golpear a quien se defiende y remata primero
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
                        if (knocks) {
                            score += 70;
                            const othersDown = targets.filter(o => o !== t).every(o => o.down);
                            if (othersDown) score += 120; // prepara el Ataque total
                        }
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
        if (!this.canUse(me, attackId)) return;
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
        b.acted.add(me.idx);
        if (this.checkEnd()) return;

        if (result.knocked) {
            // ¡Una más! El mismo dino vuelve a actuar (o pasa el relevo)
            b.oneMore = true;
            this.splash('¡UNA MÁS!', 'player');
            this.log(`🔁 <strong>¡UNA MÁS!</strong> ${me.name} puede actuar otra vez.${this.allDown(this.foeSide) ? ' ¡Todos derribados: <strong>ATAQUE TOTAL</strong> disponible!' : ''}`);
            this.setActor(me);
            return;
        }
        this.nextHumanActor();
    }

    guard() {
        const b = this.battle;
        if (!b || b.phase !== 'human' || b.busy) return;
        const me = this.currentActor();
        me.guarding = true;
        me.lastMove = null;
        b.acted.add(me.idx);
        this.log(`🛡️ ${me.name} se pone en guardia: recibirá la mitad de daño y no podrá ser derribado.`);
        this.nextHumanActor();
    }

    /** Pasa la acción extra a otro dino del equipo, con más poder. */
    batonPass(idx) {
        const b = this.battle;
        if (!b || !b.oneMore || b.busy) return;
        const from = this.currentActor();
        const to = b[b.turn][idx];
        if (!to || to.hp <= 0 || to.idx === from.idx || b.batonChain.includes(to.idx)) return;
        b.batonChain.push(from.idx);
        const boost = BATON_BOOSTS[Math.min(b.batonChain.length, BATON_BOOSTS.length - 1)];
        this.splash('¡RELEVO!', 'baton');
        this.log(`🤝 ${from.name} pasa el relevo a ${to.name}: su ataque hará <strong>x${boost}</strong> de daño.`);
        this.setActor(to);
    }

    allDown(side) {
        const foes = this.alive(side);
        return foes.length > 0 && foes.every(f => f.down);
    }

    /** Todo el equipo de `side` ataca a la vez a todos los rivales derribados. */
    async allOutAttack(side = null, aiActor = null) {
        const b = this.battle;
        const attackerSide = side || b.turn;
        const foeSide = otherSide(attackerSide);
        const human = !aiActor;
        if (!b || b.busy || !this.allDown(foeSide)) return;
        if (human && !b.oneMore) return;
        const me = human ? this.currentActor() : aiActor;
        b.busy = true;
        b.pending = null;
        this.render();
        this.splash('¡ATAQUE TOTAL!', 'allout');
        this.log(`💥 <strong>¡ATAQUE TOTAL!</strong> El equipo de ${escapeHtml(b.names[attackerSide])} se lanza sobre los rivales derribados.`);
        document.querySelectorAll(`.battle-fighter[data-side="${attackerSide}"]:not(.fainted) .battle-fighter-img`)
            .forEach(el => { el.classList.remove('attacking'); void el.offsetWidth; el.classList.add('attacking'); });
        await sleep(1100);
        if (this.battle !== b) return;

        const allies = this.alive(attackerSide);
        for (const foe of this.alive(foeSide)) {
            let total = 0;
            for (const ally of allies) {
                const atk = (ally.atk + ally.spa) / 2;
                const def = Math.max(1, (foe.def + foe.spd) / 2);
                total += ALL_OUT_POWER * (atk / def) * ((ally.level + foe.level) / 50);
            }
            const damage = Math.max(1, Math.round(total * (0.9 + Math.random() * 0.1)));
            foe.hp = Math.max(0, foe.hp - damage);
            foe.down = false;
            this.animate(foe, 'hit');
            this.log(`💥 ${foe.name} recibe ${damage} de daño.`);
            if (foe.hp <= 0) this.log(`☠️ ${foe.name} se debilitó.`);
        }
        this.render();
        await sleep(BATTLE_DELAY);
        if (this.battle !== b) return;
        b.busy = false;
        if (!human) {
            this.checkEnd();
            return;
        }
        b.acted.add(me.idx);
        if (this.checkEnd()) return;
        this.nextHumanActor();
    }

    /** Termina la acción extra sin hacer nada más. */
    skipExtra() {
        const b = this.battle;
        if (!b || !b.oneMore || b.busy) return;
        this.nextHumanActor();
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

    /** Devuelve { knocked } = true si el ataque derribó al objetivo (debilidad o crítico). */
    async performAttack(attacker, defender, attackId) {
        const attack = this.cards.getAttack(attackId) || { id: attackId, name: attackId, element: 'normal', power: 20, category: 'fisico' };
        const el = this.cards.catalog.elements[attack.element];
        const cat = this.cards.getCategory(attack);
        const mine = this.battle.humans[attacker.side] && !this.battle.humans.rival ? 'player' : (attacker.side === 'player' ? 'player' : 'rival');
        attacker.lastMove = attackId;
        this.log(`${el ? el.icon : '•'}${cat.icon} ${this.ownerLabel(attacker)} ${attacker.name} usó ${attack.moveCard ? '🃏 ' : ''}<strong>${escapeHtml(attack.name)}</strong> contra ${defender.name}.`);
        this.animate(attacker, 'attacking');
        await sleep(BATTLE_DELAY / 2);

        if (attack.power <= 0) {
            defender.intimidated = true;
            this.log(`😨 ${defender.name} quedó intimidado: su próximo ataque hará menos daño.`);
            this.render();
            await sleep(BATTLE_DELAY);
            return { knocked: false };
        }

        const crit = attack.category !== 'especial' && Math.random() < CRIT_CHANCE;
        const { damage, mult } = this.calcDamage(attacker, defender, attack, true, crit);
        const weak = mult > 1;
        attacker.intimidated = false;
        defender.hp = Math.max(0, defender.hp - damage);
        const knocked = (weak || crit) && !defender.down && !defender.guarding && defender.hp > 0;
        if (knocked) defender.down = true;
        this.render();
        this.animate(defender, 'hit');
        if (weak && !defender.guarding) this.splash('¡DÉBIL!', mine === 'player' ? 'weak' : 'rival');
        else if (crit) this.splash('¡CRÍTICO!', mine === 'player' ? 'weak' : 'rival');
        this.log(`💥 ${defender.name} recibe ${damage} de daño.${weak ? ' <span class="log-effective">¡Es muy eficaz!</span>' : ''}${crit ? ' <span class="log-effective">¡Crítico!</span>' : ''}${defender.guarding ? ' 🛡️' : ''}`);
        if (knocked) this.log(`💫 <strong>¡${defender.name} fue derribado!</strong>`);
        if (defender.hp <= 0) {
            this.log(`☠️ ${defender.name} se debilitó.`);
            this.announceLastDino(defender.side);
        }
        await sleep(BATTLE_DELAY);
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
        b.turn = null;
        b.oneMore = false;
        const winner = result === 'won' ? b.names.player : b.names.rival;
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
        this.overlay.style.display = 'none';
        this.overlay.classList.remove('pvp');
        if (document.activeElement) document.activeElement.blur();
    }

    // ------------------------------------------------------------
    // Teclado: números para ataques / objetivos, letras para el resto
    // ------------------------------------------------------------
    onKey(e) {
        if (!this.battle || e.repeat) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const b = this.battle;
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
    // Interfaz
    // ------------------------------------------------------------
    log(html) {
        const line = document.createElement('div');
        line.innerHTML = html;
        this.logEl.appendChild(line);
        this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    /** Texto grande que cruza la pantalla (¡UNA MÁS!, ¡DÉBIL!, ¡ATAQUE TOTAL!...). */
    splash(text, kind = '') {
        const el = this.splashEl;
        if (!el) return;
        el.className = 'battle-splash';
        el.innerHTML = `<span>${escapeHtml(text)}</span>`;
        void el.offsetWidth;
        el.className = `battle-splash show ${kind}`;
        clearTimeout(this.splashTimer);
        this.splashTimer = setTimeout(() => { el.className = 'battle-splash'; }, kind === 'allout' ? 1400 : 950);
    }

    animate(f, cls) {
        const el = document.querySelector(`.battle-fighter[data-side="${f.side}"][data-idx="${f.idx}"] .battle-fighter-img`);
        if (!el) return;
        el.classList.remove(cls);
        void el.offsetWidth; // reiniciar animación
        el.classList.add(cls);
    }

    renderFighter(f, targetNumber = 0) {
        const b = this.battle;
        const el = this.cards.catalog.elements[f.element];
        const hpPct = Math.round((f.hp / f.maxHp) * 100);
        const hpClass = hpPct > 50 ? 'high' : (hpPct > 20 ? 'mid' : 'low');
        const imgStyle = f.image ? `background-image:url('assets/dinos/${encodeURI(f.image)}')` : '';
        const isActor = b.phase === 'human' && f.side === b.turn && b.actor === f.idx;
        const targetable = b.phase === 'human' && f.side === this.foeSide && b.pending && f.hp > 0;
        let effTag = '';
        if (targetable) {
            const a = this.cards.getAttack(b.pending);
            if (a && a.power > 0 && this.cards.getTypeMultiplier(a.element, f.element) > 1) {
                effTag = `<span class="fighter-eff">DÉBIL x${this.cards.typeChart.effective}</span>`;
            }
        }
        const done = b.phase === 'human' && f.side === b.turn && b.acted.has(f.idx) && !isActor;
        const status = `${f.guarding ? '🛡️' : ''}${f.intimidated ? '😨' : ''}${done ? '✔' : ''}`;
        return `
            <div class="battle-fighter ${isActor ? 'actor' : ''} ${targetable ? 'targetable' : ''} ${f.hp <= 0 ? 'fainted' : ''} ${f.down ? 'down' : ''}"
                 data-side="${f.side}" data-idx="${f.idx}">
                ${effTag}
                ${targetable && targetNumber ? `<kbd class="fighter-key">${targetNumber}</kbd>` : ''}
                ${f.down ? '<span class="fighter-down">DERRIBADO</span>' : ''}
                <div class="battle-fighter-img battle-dino-img ${f.fullCard ? 'full-card' : ''}" style="${imgStyle}"></div>
                <div class="battle-fighter-info">
                    <strong>${escapeHtml(f.name)} <span class="fighter-status">${status}</span></strong>
                    <small style="color:${el ? el.color : '#94a3b8'}">${el ? el.icon + ' ' + el.name : f.element} · Nv. ${f.level}</small>
                    <div class="battle-hp-bar"><div class="battle-hp-fill ${hpClass}" style="width:${hpPct}%"></div></div>
                    <small class="battle-hp-text">❤️ ${f.hp}/${f.maxHp}</small>
                </div>
            </div>`;
    }

    /** Crea un botón de acción con atajo de teclado. */
    addButton(cls, html, key, onClick, disabled = false) {
        const btn = document.createElement('button');
        btn.className = cls;
        const keyLabel = key === ' ' ? 'Espacio' : (key === 'Escape' ? 'Esc' : (key || '').toUpperCase());
        btn.innerHTML = `${key ? `<kbd class="btn-key">${keyLabel}</kbd>` : ''}${html}`;
        btn.disabled = disabled;
        btn.addEventListener('click', onClick);
        this.actionsEl.appendChild(btn);
        if (key && !disabled) this.hotkeys[key] = onClick;
        return btn;
    }

    render() {
        const b = this.battle;
        if (!b) return;
        this.hotkeys = {};
        const rivalRow = document.getElementById('battleRivalSide');
        const playerRow = document.getElementById('battlePlayerSide');
        const foeSide = this.foeSide;
        let n = 0;
        const numbered = (f) => (f.side === foeSide && f.hp > 0 ? ++n : 0);
        rivalRow.innerHTML = b.rival.map(f => this.renderFighter(f, foeSide === 'rival' ? numbered(f) : 0)).join('');
        playerRow.innerHTML = b.player.map(f => this.renderFighter(f, foeSide === 'player' ? numbered(f) : 0)).join('');
        [rivalRow, playerRow].forEach(row => row.querySelectorAll('.battle-fighter.targetable').forEach(el => {
            el.addEventListener('click', () => this.chooseTarget(Number(el.dataset.idx)));
        }));

        const actions = this.actionsEl;
        actions.innerHTML = '';
        actions.classList.toggle('one-more', !!b.oneMore);

        if (b.over) {
            const label = b.kind === 'wild' && b.over === 'won' ? '🃏 Capturar' : '▶ Continuar';
            const done = () => {
                this.close();
                this.report(b, b.over);
            };
            this.addButton(`battle-btn ${b.over === 'won' ? 'win' : 'flee'} battle-continue`, label, ' ', done);
            this.hotkeys.Enter = done;
            return;
        }

        if (b.phase !== 'human' || b.actor === null) {
            const acting = b.phase === 'coin' ? '🪙 Lanzando la moneda...' : `⏳ ${escapeHtml(b.names.rival)} está actuando...`;
            actions.innerHTML = `<p class="battle-wait">${acting}</p>`;
            return;
        }

        if (b.pending) {
            const a = this.cards.getAttack(b.pending);
            actions.innerHTML = `<p class="battle-wait">🎯 Elige a qué rival atacar con <strong>${escapeHtml(a ? a.name : b.pending)}</strong> (clic en su carta o teclas <kbd>1</kbd>-<kbd>3</kbd>).</p>`;
            this.addButton('battle-btn flee', '↩ Cancelar', 'Escape', () => { b.pending = null; this.render(); });
            return;
        }

        const me = this.currentActor();
        const { elements } = this.cards.catalog;
        const move = b.moves[b.turn];
        const attackIds = move ? [...me.attacks, move] : me.attacks;
        const foes = this.alive(foeSide);
        const boost = BATON_BOOSTS[Math.min(b.batonChain.length, BATON_BOOSTS.length - 1)];
        const useItem = b.turn === 'player' && b.useItems;

        if (b.humans.rival) {
            actions.insertAdjacentHTML('beforeend', `<p class="battle-wait pvp-turn">🎮 Turno de <strong>${escapeHtml(b.names[b.turn])}</strong></p>`);
        }

        if (b.oneMore && this.allDown(foeSide)) {
            this.addButton('battle-btn allout', '💥 ¡ATAQUE TOTAL!', 't', () => this.allOutAttack(), b.busy);
        }

        attackIds.forEach((id, i) => {
            const a = this.cards.getAttack(id);
            if (!a) return;
            const ael = elements[a.element];
            const cat = this.cards.getCategory(a);
            const itemBoost = useItem && a.power > 0 ? this.cards.getElementBoost(a.element) : 0;
            const eff = a.power > 0 && foes.some(f => !f.down && this.cards.getTypeMultiplier(a.element, f.element) > 1);
            const cooldown = !this.canUse(me, id);
            const btn = this.addButton(
                `battle-atk-btn ${a.moveCard ? 'move' : ''}`,
                `<span>${a.moveCard ? '🃏' : (ael ? ael.icon : '•')}${cat.icon} ${escapeHtml(a.name)}</span>
                 <span class="atk-power">${cooldown ? '⏳ recarga' : `${a.power > 0 ? a.power + itemBoost : '—'}${itemBoost ? ` <em class="atk-boost">+${itemBoost}</em>` : ''}${eff ? ' <em class="atk-effective">DÉBIL</em>' : ''}${boost > 1 && a.power > 0 ? ` <em class="atk-boost">x${boost}</em>` : ''}`}</span>`,
                String(i + 1),
                () => this.chooseAttack(id),
                cooldown || b.busy
            );
            btn.style.setProperty('--el', ael ? ael.color : '#94a3b8');
            btn.title = `${cat.name}${id === me.strongest ? ' · Ataque más fuerte: no se puede usar dos veces seguidas' : ''}`;
        });

        if (b.oneMore) {
            const mates = this.alive(b.turn).filter(f => f.idx !== me.idx && !b.batonChain.includes(f.idx));
            const keys = ['z', 'x', 'c'];
            mates.forEach((m, i) => {
                this.addButton('battle-btn baton', `🤝 Relevo a ${escapeHtml(m.name)}`, keys[i], () => this.batonPass(m.idx), b.busy);
            });
            this.addButton('battle-btn flee', '⏭ Terminar', 'q', () => this.skipExtra(), b.busy);
            return;
        }

        this.addButton('battle-btn guard', '🛡️ Defender', 'd', () => this.guard(), b.busy);
        if (this.canFlee(b)) this.addButton('battle-btn flee', '🏃 Huir', 'h', () => this.flee(), b.busy);
    }
}
