/**
 * TournamentSystem - Gran Torneo Mesozoico (estadio del torneo, mapa "torneo").
 *
 * - Al entrar al estadio (o al hablar con el Árbitro) se abre el menú: combatir solo o con alguien más.
 * - 8 Tamers: Fer, Ander y 6 NPCs elegidos al azar (sin repetir los del torneo anterior si hay suficientes).
 *   · Solo: tú contra 7 rivales con IA experta (tu hermano incluido).
 *   · Con alguien más: Fer y Ander los manejan dos personas en la misma pantalla (por turnos).
 * - Todos los dinos combaten a nivel 50 con sus mejores ataques para ese nivel.
 * - Cuadro de eliminación directa: cuartos de final, semifinal y gran final. Los combates entre NPCs se
 *   simulan; los tuyos se juegan. El ganador se consagra campeón (+1500 Dino-Créditos si eres tú).
 * - Antes de la final puede irrumpir un Dinosaurio Alfa (evento sorpresa del árbitro).
 */

const TOURNAMENT_LEVEL = 50;
const TOURNAMENT_NPCS = 6;
const ROUND_NAMES = ['Cuartos de final', 'Semifinal', 'Gran Final'];
const ALPHA_CHANCE = 0.25;
const CHAMPION_CREDITS = 1500;
const ALPHA_CREDITS = 500;
const TOURNAMENT_MAPS = ['world_map', 'ruta_1', 'cueva_meteoro'];
const REFEREE_LINES = {
    welcome: '¡Bienvenidos al Gran Torneo Mesozoico! Ocho Tamers, todos los dinos a nivel 50... ¡y solo un campeón!',
    start: '¡Damas y caballeros! ¡El enfrentamiento de hoy hará temblar la tierra! ¡Tamers, preparen sus Cartas Dino... y a luchar!',
    lastDino: '¡Increíble! ¡A {name} solo le queda un dinosaurio! ¿Será este el fin o veremos una remontada épica?',
    alpha: '¡Atención a todos los presentes! Las alarmas indican que un Dinosaurio Alfa ha interrumpido en la arena. ¡Se suspenden las reglas del torneo, todos deben defenderse!'
};

class TournamentSystem {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
        this.view = null;
        this.t = null;          // torneo en curso
        this.pool = null;       // NPCs que pueden participar
        this.faces = {};        // caché de imágenes de sprites
        this.overlay = document.getElementById('tournamentOverlay');
        this.body = document.getElementById('tournamentBody');
    }

    get cards() {
        return this.game.cards;
    }

    get lines() {
        return { ...REFEREE_LINES, ...((this.refereeNpc && this.refereeNpc.data.lines) || {}) };
    }

    // ------------------------------------------------------------
    // Entrada
    // ------------------------------------------------------------
    onEnterArena() {
        const g = this.game;
        if (this.isOpen || g.dialog || g.activeEvent || g.state !== 'overworld') return;
        this.greet(g.npcs.find(n => n.data.tournament) || null);
    }

    greet(npc) {
        this.refereeNpc = npc;
        this.game.showDialog(npc ? npc.name : 'Árbitro', this.lines.welcome, () => this.open());
    }

    open() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
        this.show(this.t && !this.t.done ? 'bracket' : 'menu');
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        if (document.activeElement) document.activeElement.blur();
    }

    onEscape() {
        if (this.view === 'menu' || this.view === 'champion') this.close();
        else if (this.view === 'partner' || this.view === 'picker') this.show('menu');
    }

    show(view) {
        this.view = view;
        if (view === 'menu') this.renderMenu();
        else if (view === 'partner') this.renderPartner();
        else if (view === 'picker') this.renderPicker();
        else if (view === 'bracket') this.renderBracket();
        else if (view === 'champion') this.renderChampion();
    }

    // ------------------------------------------------------------
    // Participantes
    // ------------------------------------------------------------
    /** NPCs con nombre de todos los mapas y de la historia (sin los hermanos). */
    async loadPool() {
        if (this.pool) return this.pool;
        const heroNames = new Set(this.game.heroes.map(h => h.defaultName));
        const byName = new Map();
        const add = (n) => {
            const name = String(n.name || '').split(',')[0].trim();
            if (!name || name.includes('{') || heroNames.has(name) || byName.has(name) || !n.sprite || n.sprite.includes('{')) return;
            const team = (n.team || []).map(m => m.species || m.id).filter(id => this.cards.getDino(id));
            byName.set(name, { name, sprite: n.sprite, species: team.slice(0, 3), move: n.moveCard || null });
        };
        for (const id of TOURNAMENT_MAPS) {
            const data = await TileMap.fetchMap(id);
            if (data) (data.npcs || []).forEach(add);
        }
        (this.game.story.data.npcs || []).forEach(add);
        this.pool = [...byName.values()];
        return this.pool;
    }

    shuffle(list) {
        const a = [...list];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /** 6 NPCs al azar, evitando repetir los del torneo anterior. */
    pickNpcs(pool) {
        const last = new Set(this.game.story.flags.torneoUltimos || []);
        const fresh = this.shuffle(pool.filter(p => !last.has(p.name)));
        const used = this.shuffle(pool.filter(p => last.has(p.name)));
        const chosen = [...fresh, ...used].slice(0, TOURNAMENT_NPCS);
        this.game.story.flags.torneoUltimos = chosen.map(p => p.name);
        return chosen;
    }

    randomSpecies(count, element = null) {
        const dinos = this.cards.catalog.dinos;
        const pool = element ? dinos.filter(d => d.element === element) : dinos;
        return this.shuffle(pool.length >= count ? pool : dinos).slice(0, count).map(d => d.id);
    }

    /** Equipo a nivel 50 con los mejores ataques de cada dino para ese nivel. */
    levelTeam(speciesList) {
        return speciesList.slice(0, 3).map(id => {
            const dino = this.cards.getDino(id);
            return { species: id, level: TOURNAMENT_LEVEL, attacks: this.cards.getDefaultAttacks(dino, TOURNAMENT_LEVEL) };
        });
    }

    randomMove() {
        const moves = this.cards.getMoveCardList();
        return moves.length ? moves[Math.floor(Math.random() * moves.length)].id : null;
    }

    heroData(hero, overrides = {}) {
        return {
            name: hero ? hero.defaultName : 'Tamer',
            sprite: hero ? hero.sprite : '',
            heroId: hero ? hero.id : null,
            lines: hero ? hero.lines : null,
            ...overrides
        };
    }

    /** El equipo del hermano cuando lo maneja la IA: su dino inicial + 2 de su elemento. */
    brotherTeam(hero) {
        const starter = this.game.starterOf(hero);
        const extra = this.randomSpecies(3, hero && hero.element).filter(id => id !== starter);
        return this.levelTeam(starter ? [starter, ...extra] : extra);
    }

    async startTournament(mode, partnerTeam = null) {
        const g = this.game;
        const myTeam = this.cards.getTeam();
        if (myTeam.length === 0) return;
        const pool = await this.loadPool();
        const hero = g.protagonist && g.heroes.find(h => h.id === g.protagonist.id);
        const brother = g.heroes.find(h => h !== hero);

        const me = this.heroData(hero, {
            name: g.localPlayer.name,
            sprite: g.localPlayer.spriteFile,
            human: true,
            team: this.levelTeam(myTeam.map(c => c.id)),
            move: this.cards.getPlayerMoveCard(),
            local: true
        });
        const bro = this.heroData(brother, mode === 'duo'
            ? { human: true, team: partnerTeam.team, move: partnerTeam.move, name: partnerTeam.name || (brother && brother.defaultName) }
            : { human: false, ai: 'experto', team: this.brotherTeam(brother), move: this.randomMove() });
        const npcs = this.pickNpcs(pool).map(p => ({
            name: p.name,
            sprite: p.sprite,
            human: false,
            ai: 'experto',
            team: this.levelTeam(p.species.length >= 3 ? p.species : [...p.species, ...this.randomSpecies(3 - p.species.length)]),
            move: p.move || this.randomMove()
        }));

        const players = this.shuffle([me, bro, ...npcs]);
        const first = [];
        for (let i = 0; i < players.length; i += 2) first.push({ a: players[i], b: players[i + 1], winner: null });
        this.t = { mode, players, rounds: [first], round: 0, alphaDone: false, message: this.lines.start, done: false, champion: null };
        g.saves.autoSave();
        this.show('bracket');
    }

    // ------------------------------------------------------------
    // Combates
    // ------------------------------------------------------------
    currentMatch() {
        const t = this.t;
        return t.rounds[t.round].find(m => !m.winner) || null;
    }

    async playNext() {
        const t = this.t;
        if (!t || t.done) return;
        const match = this.currentMatch();
        if (!match) return;

        // Evento sorpresa: un Dinosaurio Alfa antes de la final
        if (t.round === ROUND_NAMES.length - 1 && !t.alphaDone) {
            t.alphaDone = true;
            const defender = t.players.find(p => p.human && !p.eliminated);
            if (defender && Math.random() < ALPHA_CHANCE) {
                this.alphaBattle(defender);
                return;
            }
        }

        if (!match.a.human && !match.b.human) {
            const winner = this.simulate(match.a, match.b);
            this.finishMatch(match, winner, `🤖 ${match.a.name} vs ${match.b.name}: ¡gana ${winner.name}!`);
            return;
        }
        this.humanBattle(match);
    }

    humanBattle(match) {
        const t = this.t;
        const player = match.a.human ? match.a : match.b;
        const rival = player === match.a ? match.b : match.a;
        const vsBrother = !!(player.heroId && rival.heroId);
        const intro = [`🎙️ <em>Árbitro:</em> ${escapeHtml(this.lines.start)}`];
        [player, rival].forEach(p => {
            if (p.lines) intro.push(`🗨️ <strong>${escapeHtml(p.name)}:</strong> “${escapeHtml(vsBrother ? p.lines.entrarVs : p.lines.entrar)}”`);
        });
        this.overlay.style.display = 'none';
        this.game.battle.start({
            kind: 'tournament',
            title: `${ROUND_NAMES[t.round]} · ${rival.name}`,
            player: { name: player.name, team: player.team, move: player.move },
            rival: { name: rival.name, team: rival.team, move: rival.move, human: rival.human, ai: rival.ai || 'experto' },
            intro,
            announcer: { lastDino: this.lines.lastDino },
            onEnd: (result) => {
                const winner = result === 'won' ? player : rival;
                this.overlay.style.display = 'flex';
                this.finishMatch(match, winner);
            }
        });
    }

    /** Frases de Fer y Ander al ganar o perder. */
    resultLines(winner, loser) {
        const vs = !!(winner.heroId && loser.heroId);
        const out = [];
        if (winner.lines) out.push(`🗨️ ${winner.name}: “${vs ? winner.lines.ganarVs : winner.lines.ganar}”`);
        if (loser.lines) out.push(`🗨️ ${loser.name}: “${vs ? loser.lines.perderVs : loser.lines.perder}”`);
        return out.join('\n');
    }

    finishMatch(match, winner, extra = '') {
        const t = this.t;
        match.winner = winner;
        const loser = winner === match.a ? match.b : match.a;
        loser.eliminated = true;
        t.message = [extra || `🏆 ¡${winner.name} gana y pasa de ronda!`, this.resultLines(winner, loser)].filter(Boolean).join('\n');

        if (!this.currentMatch()) {
            const winners = t.rounds[t.round].map(m => m.winner);
            if (winners.length === 1) {
                this.crown(winners[0]);
                return;
            }
            const next = [];
            for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1], winner: null });
            t.rounds.push(next);
            t.round++;
            t.message += `\n🎙️ ¡Comienza la ${ROUND_NAMES[t.round]}!`;
        }
        this.show('bracket');
    }

    crown(champion) {
        const t = this.t;
        t.done = true;
        t.champion = champion;
        const flags = this.game.story.flags;
        flags.torneoCampeon = champion.name;
        if (champion.local) {
            flags.torneoVictorias = (flags.torneoVictorias || 0) + 1;
            this.cards.credits += CHAMPION_CREDITS;
        }
        this.game.saves.autoSave();
        this.show('champion');
    }

    alphaBattle(defender) {
        const t = this.t;
        const species = ['tyrannosaurus_rex', 'gigas', 'spinosaurus', 'maximus', 'saichania']
            .filter(id => this.cards.getDino(id));
        const id = species[Math.floor(Math.random() * species.length)] || this.cards.catalog.dinos[0].id;
        const alpha = { species: id, level: TOURNAMENT_LEVEL + 10, hpBoost: 3, attacks: this.cards.getDefaultAttacks(this.cards.getDino(id), 60) };
        t.message = `🚨 ${this.lines.alpha}`;
        this.renderBracket();
        setTimeout(() => {
            this.overlay.style.display = 'none';
            this.game.battle.start({
                kind: 'tournament',
                title: '🚨 ¡DINOSAURIO ALFA!',
                player: { name: defender.name, team: defender.team, move: defender.move },
                rival: { name: `${this.cards.getDino(id).name} Alfa`, team: [alpha], move: null, human: false, ai: 'experto' },
                intro: [`🎙️ <em>Árbitro:</em> ${escapeHtml(this.lines.alpha)}`],
                announcer: null,
                onEnd: (result) => {
                    this.overlay.style.display = 'flex';
                    if (result === 'won') {
                        if (defender.local) this.cards.credits += ALPHA_CREDITS;
                        t.message = `🦖 ¡${defender.name} detuvo al Dinosaurio Alfa!${defender.local ? ` 💰 +${ALPHA_CREDITS} Dino-Créditos.` : ''}\n🎙️ ¡Las reglas vuelven a la normalidad: que empiece la Gran Final!`;
                    } else {
                        t.message = '🦖 El Dinosaurio Alfa escapó de la arena... ¡pero el torneo continúa! Que empiece la Gran Final.';
                    }
                    this.show('bracket');
                }
            });
        }, 1800);
    }

    /** Combate rápido entre dos NPCs con las mismas fórmulas de daño (sin animaciones). */
    simulate(a, b) {
        const make = (p) => p.team.map(m => {
            const dino = this.cards.getDino(m.species);
            const st = this.cards.getStats(m.species, m.level);
            return { ...st, maxHp: st.hp, element: dino.element, level: m.level, attacks: [...m.attacks, p.move].filter(Boolean) };
        });
        const sides = [make(a), make(b)];
        const alive = (s) => sides[s].filter(f => f.hp > 0);
        let turn = Math.random() < 0.5 ? 0 : 1;
        for (let round = 0; round < 60 && alive(0).length && alive(1).length; round++) {
            for (const f of alive(turn)) {
                const foes = alive(1 - turn);
                if (!foes.length) break;
                let best = null;
                for (const id of f.attacks) {
                    const atk = this.cards.getAttack(id);
                    if (!atk || atk.power <= 0) continue;
                    for (const t of foes) {
                        const special = atk.category === 'especial';
                        const mult = this.cards.getTypeMultiplier(atk.element, t.element);
                        const dmg = atk.power * ((special ? f.spa : f.atk) / Math.max(1, special ? t.spd : t.def))
                            * ((f.level + t.level) / 50) * mult * (0.85 + Math.random() * 0.15);
                        const score = dmg + (dmg >= t.hp ? 1000 : 0);
                        if (!best || score > best.score) best = { t, dmg, score };
                    }
                }
                if (best) best.t.hp -= Math.round(best.dmg);
            }
            turn = 1 - turn;
        }
        const left = (s) => alive(s).reduce((sum, f) => sum + f.hp / f.maxHp, 0);
        return left(0) >= left(1) ? a : b;
    }

    // ------------------------------------------------------------
    // Interfaz
    // ------------------------------------------------------------
    faceHtml(p, size = 44) {
        return `<canvas class="tour-face" width="${size}" height="${size}" data-sprite="${escapeHtml(p.sprite || '')}"></canvas>`;
    }

    /** Dibuja la cara (fila 10 = caminando hacia abajo) de cada sprite en los <canvas class="tour-face">. */
    paintFaces() {
        this.body.querySelectorAll('canvas.tour-face').forEach(cv => {
            const file = cv.dataset.sprite;
            if (!file) return;
            const draw = (img) => {
                const ctx = cv.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, cv.width, cv.height);
                ctx.drawImage(img, 16, 10 * 64 + 6, 32, 32, 0, 0, cv.width, cv.height);
            };
            let img = this.faces[file];
            if (!img) {
                img = new Image();
                img.onerror = () => {
                    const alt = LPCRenderer.fallbacks[file];
                    if (alt && !img.src.endsWith(alt)) img.src = `assets/characters/${encodeURIComponent(alt)}`;
                };
                img.src = `assets/characters/${encodeURIComponent(file)}`;
                this.faces[file] = img;
            }
            if (img.complete && img.naturalWidth) draw(img);
            else img.addEventListener('load', () => draw(img), { once: true });
        });
    }

    teamIcons(team) {
        return `<span class="tour-team">${team.map(m => {
            const d = this.cards.getDino(m.species);
            const src = d && (d.card || d.image);
            return `<span class="tour-dino" title="${d ? d.name : m.species}" style="${src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : ''}"></span>`;
        }).join('')}</span>`;
    }

    header(subtitle = '') {
        return `
            <div class="tour-header">
                <span class="tour-kicker">🏟️ Pangea · Estadio</span>
                <h2 class="tour-title">GRAN TORNEO <span>MESOZOICO</span></h2>
                ${subtitle ? `<p class="tour-sub">${subtitle}</p>` : ''}
            </div>`;
    }

    renderMenu() {
        const g = this.game;
        const flags = g.story.flags;
        const hasTeam = this.cards.getTeam().length > 0;
        const hero = g.heroes.find(h => g.protagonist && h.id === g.protagonist.id);
        const brother = g.heroes.find(h => h !== hero);
        this.body.innerHTML = `
            ${this.header('8 Tamers · todos los dinos a nivel 50 · eliminación directa')}
            <p class="tour-referee">🎙️ “${escapeHtml(this.lines.welcome)}”</p>
            <div class="tour-modes">
                <button class="tour-mode" data-mode="solo" ${hasTeam ? '' : 'disabled'}>
                    <span class="tour-mode-icon">⚔️</span>
                    <strong>COMBATIR SOLO</strong>
                    <small>Tú, tu hermano ${escapeHtml(brother ? brother.defaultName : '')} y 6 Tamers al azar. Todos los rivales usan IA experta.</small>
                </button>
                <button class="tour-mode duo" data-mode="duo" ${hasTeam ? '' : 'disabled'}>
                    <span class="tour-mode-icon">👥</span>
                    <strong>CON ALGUIEN MÁS</strong>
                    <small>${escapeHtml(g.localPlayer.name)} y ${escapeHtml(brother ? brother.defaultName : 'tu hermano')} los manejan dos personas en esta pantalla, junto a 6 Tamers al azar.</small>
                </button>
            </div>
            ${hasTeam ? '' : '<p class="tour-warning">⚠️ Necesitas al menos un dino en tu equipo para inscribirte.</p>'}
            <div class="tour-stats">
                <span>🏆 Torneos ganados: <strong>${flags.torneoVictorias || 0}</strong></span>
                <span>👑 Último campeón: <strong>${escapeHtml(flags.torneoCampeon || '—')}</strong></span>
            </div>
            <div class="tour-actions"><button class="title-btn ghost small" data-act="close"><span>✖ Salir</span></button></div>`;
        this.body.querySelector('[data-mode="solo"]').addEventListener('click', () => this.startTournament('solo'));
        this.body.querySelector('[data-mode="duo"]').addEventListener('click', () => this.show('partner'));
        this.body.querySelector('[data-act="close"]').addEventListener('click', () => this.close());
    }

    /** Modo con alguien más: elegir el equipo del segundo jugador. */
    renderPartner() {
        const g = this.game;
        const hero = g.heroes.find(h => g.protagonist && h.id === g.protagonist.id);
        const brother = g.heroes.find(h => h !== hero);
        const name = brother ? brother.defaultName : 'Jugador 2';
        const slots = g.saves.listSlots().filter(s => s.slot !== g.saves.currentSlot && s.data
            && ((s.data.cards && s.data.cards.collection) || []).some(c => c.inTeam));
        const slotHtml = slots.map(s => {
            const team = s.data.cards.collection.filter(c => c.inTeam).map(c => ({ species: c.id }));
            return `<button class="tour-option" data-slot="${s.slot}">
                        <strong>💾 Ranura ${s.slot} · ${escapeHtml(s.data.player.name)}</strong>
                        ${this.teamIcons(team)}
                    </button>`;
        }).join('');
        this.body.innerHTML = `
            ${this.header(`¿Con qué equipo jugará ${escapeHtml(name)}?`)}
            <div class="tour-options">
                ${slotHtml}
                <button class="tour-option" data-act="random"><strong>🎲 Equipo al azar</strong><small>3 dinos de ${escapeHtml(name)} (su dino inicial y dos de su elemento)</small></button>
                <button class="tour-option" data-act="pick"><strong>🃏 Elegir 3 dinos</strong><small>Escoge cualquier carta del catálogo</small></button>
            </div>
            <div class="tour-actions"><button class="title-btn ghost small" data-act="back"><span>↩ Volver</span></button></div>`;
        this.body.querySelectorAll('[data-slot]').forEach(btn => btn.addEventListener('click', () => {
            const data = g.saves.read(Number(btn.dataset.slot));
            const species = data.cards.collection.filter(c => c.inTeam).map(c => c.id);
            const move = data.cards.selectedMove && (data.cards.moveCards || {})[data.cards.selectedMove] > 0 ? data.cards.selectedMove : null;
            this.startTournament('duo', { name: data.player.name, team: this.levelTeam(species), move });
        }));
        this.body.querySelector('[data-act="random"]').addEventListener('click', () =>
            this.startTournament('duo', { name, team: this.brotherTeam(brother), move: this.randomMove() }));
        this.body.querySelector('[data-act="pick"]').addEventListener('click', () => {
            this.picked = [];
            this.pickName = name;
            this.show('picker');
        });
        this.body.querySelector('[data-act="back"]').addEventListener('click', () => this.show('menu'));
    }

    renderPicker() {
        const dinos = this.cards.catalog.dinos;
        const { elements } = this.cards.catalog;
        this.body.innerHTML = `
            ${this.header(`${escapeHtml(this.pickName)}: elige 3 dinos (${this.picked.length}/3)`)}
            <div class="tour-picker">${dinos.map(d => {
                const el = elements[d.element];
                return `<button class="tour-pick ${this.picked.includes(d.id) ? 'on' : ''}" data-id="${d.id}" title="${d.name}">
                    <span class="tour-pick-img" style="background-image:url('assets/dinos/${encodeURI(d.card || d.image)}')"></span>
                    <small>${el ? el.icon : ''} ${escapeHtml(d.name)}</small>
                </button>`;
            }).join('')}</div>
            <div class="tour-actions">
                <button class="title-btn ghost small" data-act="back"><span>↩ Volver</span></button>
                <button class="title-btn primary small" data-act="ok" ${this.picked.length === 3 ? '' : 'disabled'}><span>✔ Confirmar equipo</span></button>
            </div>`;
        this.body.querySelectorAll('.tour-pick').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            if (this.picked.includes(id)) this.picked = this.picked.filter(x => x !== id);
            else if (this.picked.length < 3) this.picked.push(id);
            const scroll = this.body.querySelector('.tour-picker').scrollTop;
            this.renderPicker();
            this.body.querySelector('.tour-picker').scrollTop = scroll;
        }));
        this.body.querySelector('[data-act="back"]').addEventListener('click', () => this.show('partner'));
        this.body.querySelector('[data-act="ok"]').addEventListener('click', () =>
            this.startTournament('duo', { name: this.pickName, team: this.levelTeam(this.picked), move: this.randomMove() }));
    }

    playerChip(p, match) {
        if (!p) return '<div class="tour-chip empty">?</div>';
        const state = match && match.winner ? (match.winner === p ? 'win' : 'lose') : '';
        return `<div class="tour-chip ${state} ${p.human ? 'human' : ''}">
                    ${this.faceHtml(p, 34)}
                    <span class="tour-chip-name">${escapeHtml(p.name)}${p.human ? ' 🎮' : ''}</span>
                    ${this.teamIcons(p.team)}
                </div>`;
    }

    renderBracket() {
        const t = this.t;
        const match = t.done ? null : this.currentMatch();
        const cols = ROUND_NAMES.map((name, r) => {
            const matches = t.rounds[r] || Array.from({ length: 4 >> r }, () => null);
            return `<div class="tour-round">
                        <h4>${name}</h4>
                        ${matches.map(m => `<div class="tour-match ${m && m === match ? 'current' : ''}">
                            ${this.playerChip(m && m.a, m)}${this.playerChip(m && m.b, m)}
                        </div>`).join('')}
                    </div>`;
        }).join('');
        const humanNext = match && (match.a.human || match.b.human);
        const nextLabel = !match ? '' : (humanNext ? `⚔️ ¡A combatir! ${escapeHtml(match.a.name)} vs ${escapeHtml(match.b.name)}` : `▶ Siguiente: ${escapeHtml(match.a.name)} vs ${escapeHtml(match.b.name)}`);
        this.body.innerHTML = `
            <div class="tour-header compact"><h2 class="tour-title">GRAN TORNEO <span>MESOZOICO</span></h2>
            <p class="tour-sub">${ROUND_NAMES[t.round]} · ${t.mode === 'duo' ? 'Modo con alguien más' : 'Modo solo'}</p></div>
            <div class="tour-bracket">${cols}</div>
            <div class="tour-message">${escapeHtml(t.message || '').replace(/\n/g, '<br>')}</div>
            <div class="tour-actions">
                <button class="title-btn ghost small" data-act="quit"><span>🏳️ Abandonar torneo</span></button>
                ${match ? `<button class="title-btn primary" data-act="next"><span>${nextLabel}</span></button>` : ''}
            </div>`;
        this.paintFaces();
        const next = this.body.querySelector('[data-act="next"]');
        if (next) next.addEventListener('click', () => this.playNext());
        this.body.querySelector('[data-act="quit"]').addEventListener('click', () => {
            this.t = null;
            this.show('menu');
        });
    }

    renderChampion() {
        const t = this.t;
        const c = t.champion;
        const line = c.lines ? `🗨️ “${escapeHtml(c.lines.ganar)}”` : '';
        this.body.innerHTML = `
            <div class="tour-champion">
                <div class="tour-crown">👑</div>
                <p class="tour-kicker">Campeón del Gran Torneo Mesozoico</p>
                ${this.faceHtml(c, 120)}
                <h2 class="tour-champ-name">${escapeHtml(c.name)}</h2>
                ${this.teamIcons(c.team)}
                <p class="tour-message">${[line, c.local ? `💰 +${CHAMPION_CREDITS} Dino-Créditos · 🏆 Torneos ganados: ${this.game.story.flags.torneoVictorias}` : '', this.t.players.find(p => p.local && p !== c) ? `${escapeHtml(this.game.localPlayer.name)} cayó en el torneo. ¡La próxima vez será!` : ''].filter(Boolean).join('<br>')}</p>
                <div class="tour-actions">
                    <button class="title-btn ghost small" data-act="again"><span>🔁 Otro torneo</span></button>
                    <button class="title-btn primary" data-act="close"><span>✔ Salir del estadio</span></button>
                </div>
            </div>`;
        this.paintFaces();
        this.body.querySelector('[data-act="again"]').addEventListener('click', () => { this.t = null; this.show('menu'); });
        this.body.querySelector('[data-act="close"]').addEventListener('click', () => { this.t = null; this.close(); });
    }
}
