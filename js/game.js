/**
 * Game - Controlador principal de Dino Rey.
 * Mundo multijugador en tiempo real: cada jugador tiene su propia cámara y personaje;
 * los mapas, warps y personajes de eventos vienen del editor de mapas.
 * La historia (js/story.js) añade personajes y objetivos; el progreso se guarda en
 * ranuras (js/save.js) desde la pantalla de título (js/characterSelect.js).
 */

// Servidor multijugador en Render (render.yaml, servicio "dino-king-multijugador")
const MULTIPLAYER_URL = 'wss://dino-king-multijugador.onrender.com';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.state = 'title';
        this.playTime = 0;          // segundos jugados (se guarda en la partida)
        this.lastFrameTime = performance.now();
        this.protagonist = null;

        // Mapa (se reemplaza por el mapa guardado del editor al cargar)
        this.tileMap = new TileMap(120, 90, 32);
        this.tileMap.onMapLoaded = () => this.onMapLoaded();

        this.camera = new Camera(this.width, this.height, this.tileMap.width, this.tileMap.height);
        this.miniMap = new MiniMap(this.tileMap);
        this.isMapOpen = false;

        // Personajes de eventos (entrenadores / NPCs / maestro de ataques)
        this.npcs = [];
        this.activeEvent = null;   // { npc, phase: 'spotted'|'approach'|'dialog'|'battle', timer }
        this.dialog = null;        // { speaker, pages: [], page, onClose }
        this.defeatedTrainers = new Set();

        // Catálogo de dinos, elementos y ataques (assets/dinos/dinos.json)
        this.dinoCatalog = { elements: {}, dinos: [], attacks: [] };
        this.catalogReady = fetch('assets/dinos/dinos.json')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) this.dinoCatalog = data;
                this.hudTeamKey = null; // redibujar el equipo con las imágenes
            })
            .catch(() => {});

        this.input = new InputHandler();

        this.myId = null;
        this.localPlayer = new Player(1, 'Fer', 480, 1088, { initialDirection: 'down' });
        this.remotePlayers = {}; // id -> Player

        this.cards = new CardSystem(this);     // dinos, almanaque, objetos (js/cards.js)
        this.battle = new BattleSystem(this);  // combates 3 contra 3 estilo Persona 5 (js/battle.js)
        this.story = new StorySystem(this);    // historia de Dino Rey (js/story.js)
        this.tournament = new TournamentSystem(this); // Gran Torneo Mesozoico (js/tournament.js)
        this.saves = new SaveManager(this);    // partidas guardadas (js/save.js)

        this.camera.follow(this.localPlayer);

        // Cartel con el nombre del mapa al entrar
        this.banner = '';
        this.bannerTimer = 0;
        this.lastSentMove = { x: 0, y: 0, direction: '', state: '' };

        // Warps y fundido entre mapas
        this.fadeAlpha = 0;
        this.fadeState = 'none'; // 'none' | 'out' | 'in'
        this.isTransitioning = false;
        this.pendingWarp = null;
        this.lastWarp = null;

        // Menú (Enter)
        this.isMenuOpen = false;
        this.activeMenuTab = 'status';
        this.hudTeamKey = null;

        this.localPlayer.onExpGain = (data) => {
            if (data.leveledUp) {
                this.notifyStatus(`🎉 ¡Subiste a nivel de entrenador ${data.level}!`);
            } else if (data.reason) {
                this.notifyStatus(`✨ +${data.amount} EXP: ${data.reason}`);
            }
        };

        // Protagonistas (assets/characters/protagonistas.json)
        this.heroes = [];
        this.heroesReady = fetch('assets/characters/protagonistas.json')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                this.heroes = ((data && data.protagonistas) || []).slice(0, 2);
                this.heroes.forEach(h => { if (h.placeholder) LPCRenderer.fallbacks[h.sprite] = h.placeholder; });
            })
            .catch(() => {});

        this.titleScreen = new TitleScreen(this);

        this.initUI();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    onMapLoaded() {
        this.camera.worldWidth = this.tileMap.width;
        this.camera.worldHeight = this.tileMap.height;
        this.miniMap.updateScaleAndPrerender();
        this.spawnNPCs();
        this.cards.spawnGroundItems();
        if (this.tileMap.spawn && !this.isTransitioning && !this.placingFromSave) {
            this.placePlayerAtTile(this.tileMap.spawn.x, this.tileMap.spawn.y);
        }
        this.showBanner(`📍 ${this.mapTitle}`);
        // Al entrar al estadio del torneo, el árbitro ofrece combatir
        if (this.tileMap.currentMapId === 'torneo' && this.state === 'overworld') {
            setTimeout(() => this.tournament.onEnterArena(), 900);
        }
    }

    /** Nombre del mapa para mostrar: "proyecto_actual" -> "Proyecto Actual". */
    get mapTitle() {
        const storyName = this.story.mapName(this.tileMap.currentMapId || 'world_map');
        if (storyName) return storyName;
        const raw = this.tileMap.mapName || this.tileMap.currentMapId || 'Mundo';
        return String(raw).replace(/\.json$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    /** x, y del jugador = sus pies, en el centro de la losa. */
    placePlayerAtTile(col, row) {
        const ts = this.tileMap.tileSize;
        this.localPlayer.x = col * ts + ts / 2;
        this.localPlayer.y = row * ts + ts / 2;
        this.camera.x = this.localPlayer.x - this.camera.viewportWidth / 2;
        this.camera.y = this.localPlayer.y - this.camera.viewportHeight / 2;
        this.camera.clamp();
    }

    showBanner(text) {
        this.banner = text;
        this.bannerTimer = 180;
    }

    // ============================================================
    // NUEVA PARTIDA / CARGAR PARTIDA
    // ============================================================
    /** Nueva partida desde la pantalla de título. */
    async startNewGame({ slot, name, protagonist, rival }) {
        await Promise.all([this.catalogReady, this.story.ready, this.heroesReady]);
        this.saves.currentSlot = slot;
        this.playTime = 0;
        this.protagonist = protagonist;
        this.defeatedTrainers = new Set();
        this.cards.deserialize({});
        this.story.deserialize({ rival: { name: rival.name, sprite: rival.sprite, starter: null } });

        const p = this.localPlayer;
        p.name = name;
        p.level = 1;
        p.exp = 0;
        p.expNext = 100;
        this.setPlayerSprite(protagonist.sprite);

        const start = this.story.data.newGame || { map: 'world_map', x: 15, y: 34, direction: 'down' };
        await this.enterWorld(start.map, start.x, start.y, start.direction);
        this.saves.save(slot, { silent: true });

        // Prólogo y la noticia del temblor
        const prologue = this.story.format(this.story.data.prologue || '');
        const intro = [
            ...(prologue ? [{ speaker: 'Narrador', text: prologue }] : []),
            ...(this.story.data.intro || []).map(i => ({ speaker: this.story.format(i.speaker), text: this.story.format(i.text) }))
        ];
        setTimeout(() => this.showDialogSequence(intro, () => this.notifyStatus(`📜 ${this.story.objective}`)), 700);
    }

    /** Cargar una partida guardada. */
    async loadGame(slot, data) {
        await Promise.all([this.catalogReady, this.story.ready, this.heroesReady]);
        this.saves.currentSlot = slot;
        this.playTime = Number(data.playTime) || 0;
        this.defeatedTrainers = new Set(data.defeatedTrainers || []);
        this.cards.deserialize(data.cards || {});
        this.story.deserialize(data.story || {});

        const sp = data.player || {};
        const p = this.localPlayer;
        p.name = sp.name || 'Fer';
        p.level = sp.level || 1;
        p.exp = sp.exp || 0;
        p.expNext = sp.expNext || 100;
        // El sprite y el rival salen siempre de protagonistas.json (por si cambian los archivos)
        const hero = this.heroes.find(h => h.id === sp.protagonist) || this.heroes[0];
        const brother = this.heroes.find(h => h !== hero);
        this.protagonist = hero || { id: 'fer', sprite: sp.sprite };
        if (brother) {
            this.story.rival.name = brother.defaultName;
            this.story.rival.sprite = brother.sprite;
        }
        this.setPlayerSprite(this.protagonist.sprite);

        const ts = this.tileMap.tileSize;
        await this.enterWorld(sp.map || 'world_map', Math.floor((sp.x || 0) / ts), Math.floor((sp.y || 0) / ts), sp.direction || 'down');
        this.notifyStatus(`💾 ¡Bienvenido de vuelta, ${p.name}! 📜 ${this.story.objective}`);
    }

    /** Dino inicial de un protagonista (o su alternativa si la carta no existe en dinos.json). */
    starterOf(hero) {
        if (!hero) return null;
        if (hero.starter && this.cards.getDino(hero.starter)) return hero.starter;
        if (hero.starterFallback && this.cards.getDino(hero.starterFallback)) return hero.starterFallback;
        return null;
    }

    setPlayerSprite(sprite) {
        this.localPlayer.spriteFile = sprite;
        this.localPlayer.renderer.loadFromUrl(`assets/characters/${sprite}`);
    }

    /** Carga el mapa, coloca al jugador y empieza a jugar. */
    async enterWorld(mapId, col, row, direction = 'down') {
        this.placingFromSave = true;
        await this.tileMap.loadMapById(mapId);
        this.placingFromSave = false;
        this.placePlayerAtTile(col, row);
        this.lastWarp = { x: col, y: row };
        this.localPlayer.direction = direction;
        this.story.lastChapterId = this.story.chapter ? this.story.chapter.id : null;
        this.hudTeamKey = null;

        document.getElementById('hudPlayerName').textContent = this.localPlayer.name;
        this.state = 'overworld';
        document.body.classList.add('playing');
        this.lastFrameTime = performance.now();
        this.connectMultiplayer();
    }

    // ============================================================
    // MULTIJUGADOR
    // ============================================================
    connectMultiplayer() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
        const statusEl = document.getElementById('netStatus');
        statusEl.textContent = '🟡 Conectando...';

        try {
            // En local: server.py (puerto 8001). En la nube: el servidor multijugador de Render
            const host = window.location.hostname || 'localhost';
            const local = host === 'localhost' || host === '127.0.0.1' || /^192\.168\.|^10\./.test(host);
            this.ws = new WebSocket(local ? `ws://${host}:8001` : MULTIPLAYER_URL);

            this.ws.onopen = () => {
                statusEl.textContent = '🟢 En línea';
                statusEl.className = 'net-status online';
                this.ws.send(JSON.stringify({
                    type: 'join',
                    name: this.localPlayer.name,
                    sprite: this.localPlayer.spriteFile || 'Fer.png',
                    x: this.localPlayer.x,
                    y: this.localPlayer.y,
                    direction: this.localPlayer.direction,
                    map: this.tileMap.currentMapId || 'world_map'
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    this.handleNetworkMessage(JSON.parse(event.data));
                } catch (e) {
                    console.error('Error parseando mensaje WebSocket:', e);
                }
            };

            this.ws.onclose = () => {
                statusEl.textContent = '🔴 Sin conexión';
                statusEl.className = 'net-status offline';
                setTimeout(() => {
                    if (this.state === 'overworld') this.connectMultiplayer();
                }, 4000);
            };

            this.ws.onerror = () => {
                statusEl.textContent = '⚪ Modo local';
                statusEl.className = 'net-status offline';
            };
        } catch (e) {
            console.warn('WebSocket no disponible:', e);
        }
    }

    handleNetworkMessage(msg) {
        const currentMap = this.tileMap.currentMapId || 'world_map';
        if (msg.type === 'welcome') {
            this.myId = msg.yourId;
            for (const pid in msg.players) {
                if (pid !== this.myId) this.addRemotePlayer(msg.players[pid]);
            }
        } else if (msg.type === 'player_joined') {
            if (msg.player.id !== this.myId) {
                this.addRemotePlayer(msg.player);
                if ((msg.player.map || 'world_map') === currentMap) {
                    this.notifyStatus(`👋 ¡${msg.player.name} entró al mapa!`);
                }
            }
        } else if (msg.type === 'player_moved') {
            const rp = this.remotePlayers[msg.id];
            if (rp) {
                rp.updateRemote(msg);
                if (msg.map) rp.map = msg.map;
            }
        } else if (msg.type === 'player_changed_map') {
            const rp = this.remotePlayers[msg.id];
            if (rp) {
                rp.map = msg.map;
                rp.x = rp.targetX = msg.x;
                rp.y = rp.targetY = msg.y;
                if (msg.map === currentMap) this.notifyStatus(`🚪 ¡${rp.name} llegó a este mapa!`);
            } else if (msg.player) {
                this.addRemotePlayer(msg.player);
            }
        } else if (msg.type === 'player_left') {
            const rp = this.remotePlayers[msg.id];
            if (rp) {
                delete this.remotePlayers[msg.id];
                this.notifyStatus(`🚶 ${rp.name} salió del mundo.`);
            }
        } else if (msg.type === 'player_sprite_changed') {
            const rp = this.remotePlayers[msg.id];
            if (rp) {
                rp.spriteFile = msg.sprite;
                rp.renderer.loadFromUrl(`assets/characters/${msg.sprite}`);
            }
        }
    }

    addRemotePlayer(data) {
        const rp = new Player(data.id, data.name, data.x, data.y, {
            initialDirection: data.direction || 'down',
            spriteUrl: data.sprite ? `assets/characters/${data.sprite}` : null,
            fallbackColor: '#e03b24',
            accentColor: '#ffbe0b'
        });
        rp.map = data.map || 'world_map';
        this.remotePlayers[data.id] = rp;
    }

    sendPosition() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const p = this.localPlayer;
        const last = this.lastSentMove;
        const changed = Math.abs(p.x - last.x) > 0.5 || Math.abs(p.y - last.y) > 0.5 ||
            p.direction !== last.direction || p.state !== last.state;
        if (!changed) return;
        this.ws.send(JSON.stringify({
            type: 'move',
            x: Math.round(p.x),
            y: Math.round(p.y),
            direction: p.direction,
            state: p.state,
            isRunning: p.isRunning,
            map: this.tileMap.currentMapId || 'world_map'
        }));
        this.lastSentMove = { x: p.x, y: p.y, direction: p.direction, state: p.state };
    }

    // ============================================================
    // WARPS ENTRE MAPAS
    // ============================================================
    triggerWarpTransition(warp) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        this.fadeState = 'out';
        this.pendingWarp = warp;
    }

    async executeWarp(warp) {
        const targetMap = (warp.targetMap || 'world_map').replace('.json', '');
        await this.tileMap.loadMapById(targetMap);

        const tx = Number(warp.targetX ?? 0);
        const ty = Number(warp.targetY ?? 0);
        this.placePlayerAtTile(tx, ty);
        // Evitar volver a entrar al warp de destino inmediatamente
        this.lastWarp = { x: tx, y: ty };
        if (warp.desc) this.showBanner(`🚪 ${warp.desc}`);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'change_map',
                map: targetMap,
                x: Math.round(this.localPlayer.x),
                y: Math.round(this.localPlayer.y),
                direction: this.localPlayer.direction
            }));
        }
        this.fadeState = 'in';
    }

    updateFade() {
        if (this.fadeState === 'out') {
            this.fadeAlpha = Math.min(1, this.fadeAlpha + 0.08);
            if (this.fadeAlpha >= 1 && this.pendingWarp) {
                const warp = this.pendingWarp;
                this.pendingWarp = null;
                this.executeWarp(warp);
            }
        } else if (this.fadeState === 'in') {
            this.fadeAlpha = Math.max(0, this.fadeAlpha - 0.08);
            if (this.fadeAlpha <= 0) {
                this.fadeState = 'none';
                this.isTransitioning = false;
            }
        }
    }

    // ============================================================
    // BUCLE PRINCIPAL
    // ============================================================
    update() {
        const now = performance.now();
        const dt = Math.min(0.25, (now - this.lastFrameTime) / 1000);
        this.lastFrameTime = now;
        if (this.state !== 'overworld') return;
        this.playTime += dt;

        this.updateFade();
        if (this.bannerTimer > 0) this.bannerTimer--;

        const frozen = this.isTransitioning || this.activeEvent || this.dialog ||
            this.cards.isEncounterActive || this.isMenuOpen || this.isMapOpen || this.endingOpen;
        if (frozen) {
            this.localPlayer.state = 'idle';
            if (this.activeEvent) this.updateActiveEvent();
            this.camera.update();
            this.updateHUD();
            return;
        }

        this.localPlayer.update(this.input.getMoveInput(), this.tileMap);

        // Warps / puertas
        const { col, row } = this.getPlayerTile();

        // Eventos de historia al pisarlos (la carta del dino inicial)
        const ev = this.story.eventAt(this.tileMap.currentMapId || 'world_map', col, row);
        if (ev && !this.isTransitioning) {
            this.localPlayer.state = 'idle';
            this.story.runEvent(ev);
            return;
        }
        const warp = this.tileMap.getWarpAt(col, row);
        if (warp) {
            if (!this.lastWarp || this.lastWarp.x !== col || this.lastWarp.y !== row) {
                this.triggerWarpTransition(warp);
            }
        } else {
            this.lastWarp = null;
        }

        // Hierba alta: objetos y dinos salvajes cada 20-100 pasos
        if (!this.isTransitioning && this.cards.onPlayerUpdate()) {
            this.localPlayer.state = 'idle';
            this.localPlayer.animTimer = 0;
        }

        this.sendPosition();

        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            rp.bubbleAlert = Math.hypot(this.localPlayer.x - rp.x, this.localPlayer.y - rp.y) < 80;
        }

        this.checkTrainerSight();
        this.camera.update();
        this.updateHUD();
    }

    draw() {
        if (this.state !== 'overworld') return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Mundo (con cámara)
        this.camera.apply(ctx);
        this.tileMap.draw(ctx, this.camera);
        this.cards.drawGroundItems(ctx);
        this.story.drawEvents(ctx, this.tileMap.currentMapId || 'world_map', this.tileMap.tileSize);

        const currentMap = this.tileMap.currentMapId || 'world_map';
        const visibleRemotePlayers = Object.values(this.remotePlayers).filter(p => (p.map || 'world_map') === currentMap);
        const entities = [this.localPlayer, ...visibleRemotePlayers, ...this.npcs];
        entities.sort((a, b) => a.y - b.y);
        entities.forEach(e => e.draw(ctx));
        this.camera.restore(ctx);

        // Interfaz fija
        if (this.dialog) this.drawDialogBox();
        if (this.bannerTimer > 0) this.drawBanner();

        if (this.isMapOpen) {
            const npcMarkers = this.npcs.map(n => ({
                x: n.x,
                y: n.y,
                isTrainer: n.isTrainer,
                defeated: this.defeatedTrainers.has(n.eventKey)
            }));
            const title = this.mapTitle;
            this.miniMap.draw(ctx, this.camera, this.localPlayer, visibleRemotePlayers, npcMarkers, title);
        }

        if (this.fadeAlpha > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }
    }

    drawBanner() {
        const ctx = this.ctx;
        const alpha = Math.min(1, this.bannerTimer / 30);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 15px sans-serif';
        const w = ctx.measureText(this.banner).width + 40;
        const x = (this.width - w) / 2;
        ctx.fillStyle = 'rgba(12, 17, 30, 0.88)';
        ctx.strokeStyle = '#ffbe0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, 18, w, 38, 19);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffe08a';
        ctx.textAlign = 'center';
        ctx.fillText(this.banner, this.width / 2, 42);
        ctx.restore();
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }

    toggleWorldMap() {
        if (this.state !== 'overworld' || this.isMenuOpen || this.activeEvent || this.dialog || this.cards.isEncounterActive) return;
        this.isMapOpen = !this.isMapOpen;
    }

    // ============================================================
    // PERSONAJES DE EVENTOS
    // ============================================================
    spawnNPCs() {
        const mapId = this.tileMap.currentMapId || 'world_map';
        const data = [...(this.tileMap.npcs || []), ...this.story.getMapNpcs(mapId)];
        this.npcs = data.map(d => new NPC(d, this.tileMap.tileSize, mapId));
        this.activeEvent = null;
        this.dialog = null;
        this.escapeCooldownNpc = null;
        this.refreshNpcBlockers();
    }

    refreshNpcBlockers() {
        this.tileMap.npcBlockers = new Set(this.npcs.map(n => `${n.col},${n.row}`));
    }

    getPlayerTile() {
        const ts = this.tileMap.tileSize;
        return {
            col: Math.floor(this.localPlayer.x / ts),
            row: Math.floor(this.localPlayer.y / ts)
        };
    }

    checkTrainerSight() {
        const { col, row } = this.getPlayerTile();
        for (const npc of this.npcs) {
            if (!npc.isTrainer || this.defeatedTrainers.has(npc.eventKey)) continue;
            const sees = npc.canSee(col, row, this.tileMap);
            // Tras huir o perder, no vuelve a desafiarte hasta que salgas de su visión
            if (npc === this.escapeCooldownNpc) {
                if (!sees) this.escapeCooldownNpc = null;
                continue;
            }
            if (sees) {
                npc.bubbleAlert = true;
                this.localPlayer.state = 'idle';
                this.localPlayer.animTimer = 0;
                this.activeEvent = { npc, phase: 'spotted', timer: 45 };
                return;
            }
        }
    }

    updateActiveEvent() {
        const ev = this.activeEvent;
        const npc = ev.npc;
        if (ev.phase === 'spotted') {
            if (--ev.timer <= 0) {
                npc.bubbleAlert = false;
                const { col, row } = this.getPlayerTile();
                npc.walkTowardsPlayer(col, row);
                ev.phase = 'approach';
            }
        } else if (ev.phase === 'approach') {
            if (npc.updateMovement()) {
                this.refreshNpcBlockers();
                this.faceEachOther(npc);
                ev.phase = 'dialog';
                this.openTrainerChallenge(npc);
            }
        }
    }

    faceEachOther(npc) {
        npc.facePoint(this.localPlayer.x, this.localPlayer.y);
        const dx = npc.x - this.localPlayer.x;
        const dy = npc.y - this.localPlayer.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            this.localPlayer.direction = dx > 0 ? 'right' : 'left';
        } else {
            this.localPlayer.direction = dy > 0 ? 'down' : 'up';
        }
    }

    openTrainerChallenge(npc) {
        const text = npc.dialog || '¡Eh, tú! ¡Nuestras miradas se cruzaron, eso significa combate!';
        this.showDialog(npc.name, text, () => this.startBattle(npc));
    }

    /** Espacio / E: hablar con el personaje que tienes enfrente. */
    tryInteractWithNPC() {
        if (this.state !== 'overworld' || this.isMenuOpen || this.isMapOpen || this.activeEvent || this.cards.isEncounterActive) return;
        const { col, row } = this.getPlayerTile();
        const d = NPC_DIRS[this.localPlayer.direction] || NPC_DIRS.down;
        const ev = this.story.eventAt(this.tileMap.currentMapId || 'world_map', col + d.dx, row + d.dy);
        if (ev) {
            this.story.runEvent(ev);
            return;
        }
        const npc = this.npcs.find(n => n.occupiesTile(col + d.dx, row + d.dy));
        if (!npc) return;

        this.faceEachOther(npc);
        if (npc.data.tournament) {
            this.tournament.greet(npc);
            return;
        }
        if (!npc.isTrainer && this.story.onTalk(npc)) return;
        if (npc.isTutor) {
            const text = npc.dialog || '¡Hola! Puedo enseñarles ataques nuevos a tus dinos.';
            this.showDialog(npc.name, text, () => this.cards.openTutor(npc.name));
        } else if (npc.isTrainer && !this.defeatedTrainers.has(npc.eventKey)) {
            this.activeEvent = { npc, phase: 'dialog', timer: 0 };
            this.openTrainerChallenge(npc);
        } else if (npc.isTrainer) {
            this.showDialog(npc.name, npc.defeatDialog || 'Ya me ganaste... ¡entrenaré más duro!');
        } else {
            this.showDialog(npc.name, npc.dialog || '...');
        }
    }

    /** Varios diálogos seguidos: [{ speaker, text }]. */
    showDialogSequence(list, onDone = null, i = 0) {
        if (i >= list.length) {
            if (onDone) onDone();
            return;
        }
        this.showDialog(list[i].speaker, list[i].text, () => this.showDialogSequence(list, onDone, i + 1));
    }

    showDialog(speaker, text, onClose = null) {
        const pages = String(text).split('\n').map(t => t.trim()).filter(Boolean);
        this.dialog = { speaker, pages: pages.length ? pages : ['...'], page: 0, onClose };
    }

    advanceDialog() {
        if (!this.dialog) return false;
        this.dialog.page++;
        if (this.dialog.page >= this.dialog.pages.length) {
            const cb = this.dialog.onClose;
            this.dialog = null;
            if (cb) cb();
        }
        return true;
    }

    drawDialogBox() {
        const ctx = this.ctx;
        const boxH = 110;
        const x = 30;
        const y = this.height - boxH - 20;
        const w = this.width - 60;

        ctx.save();
        ctx.fillStyle = 'rgba(12, 17, 30, 0.95)';
        ctx.strokeStyle = '#ffbe0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x, y, w, boxH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffbe0b';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(this.dialog.speaker, x + 18, y + 26);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '15px sans-serif';
        const text = this.dialog.pages[this.dialog.page] || '';
        const maxW = w - 36;
        let line = '';
        let ly = y + 54;
        for (const word of text.split(' ')) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
                ctx.fillText(line, x + 18, ly);
                line = word;
                ly += 22;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x + 18, ly);

        if (Math.floor(Date.now() / 400) % 2 === 0) {
            ctx.fillStyle = '#ffbe0b';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText('▼ Espacio', x + w - 16, y + boxH - 14);
        }
        ctx.restore();
    }

    // ============================================================
    // COMBATES CONTRA ENTRENADORES
    // ============================================================
    startBattle(npc) {
        this.activeEvent = { npc, phase: 'battle', timer: 0 };
        this.battle.start({ kind: 'trainer', npc });
    }

    /**
     * result: 'won' | 'lost' | 'fled'
     * info.defeated: dinos rivales derrotados (+20% de nivel para tu equipo por cada uno si ganas)
     */
    endBattle(result, info = {}) {
        const ev = this.activeEvent;
        if (!ev) return;
        const npc = ev.npc;
        this.activeEvent = null;

        if (result === 'won') {
            this.defeatedTrainers.add(npc.eventKey);
            if (npc.rewardExp > 0) {
                this.localPlayer.gainExp(npc.rewardExp, `¡Derrotaste a ${npc.name}!`);
            }
            const percent = XP_PER_TRAINER_DINO * (info.defeated || npc.team.length || 1);
            const leveled = this.cards.gainTeamXp(percent);
            const avgLevel = npc.team.length ? npc.team.reduce((s, m) => s + (Number(m.level) || 1), 0) / npc.team.length : 5;
            const credits = Math.round(avgLevel * CREDITS_PER_TRAINER_LEVEL);
            this.cards.credits += credits;
            setTimeout(() => this.notifyStatus(`${this.cards.describeXpGain(percent, leveled)} 💰 +${credits} Dino-Créditos.`), 1500);
            const storyActions = this.story.onTrainerDefeated(npc);
            this.showDialog(npc.name, npc.defeatDialog || '¡Increíble! Me has vencido.', () => this.story.runActions(storyActions));
            return;
        }

        if (result === 'lost') {
            this.showDialog(npc.name, npc.data.winDialog || '¡Gané! Entrena a tus dinos y vuelve a intentarlo.');
        } else {
            this.notifyStatus(`💨 Escapaste del combate contra ${npc.name}.`);
            this.dialog = null;
        }
        // Retroceder una losa para no volver a entrar en su visión inmediatamente
        const d = NPC_DIRS[npc.direction];
        const ts = this.tileMap.tileSize;
        const bx = this.localPlayer.x + d.dx * ts;
        const by = this.localPlayer.y + d.dy * ts;
        if (!this.tileMap.isSolid(bx, by)) {
            this.localPlayer.x = bx;
            this.localPlayer.y = by;
        }
        this.escapeCooldownNpc = npc;
    }

    // ============================================================
    // HUD
    // ============================================================
    updateHUD() {
        const p = this.localPlayer;
        const lvl = document.getElementById('hudLevelBadge');
        const lvlText = `Nv. ${p.level}`;
        if (lvl.textContent !== lvlText) lvl.textContent = lvlText;
        document.getElementById('hudExpFill').style.width = `${Math.min(100, (p.exp / p.expNext) * 100)}%`;

        const mapName = this.mapTitle;
        const mapEl = document.getElementById('hudMapName');
        if (mapEl.textContent !== mapName) mapEl.textContent = mapName;

        const objective = this.story.objective;
        const objEl = document.getElementById('hudObjective');
        if (objEl.textContent !== objective) {
            objEl.textContent = objective;
            objEl.parentElement.title = `${this.story.chapter ? this.story.chapter.title : ''}\n${objective}`;
        }
        const stonesText = `${this.story.stones.length}/7`;
        const stEl = document.getElementById('hudStones');
        if (stEl.textContent !== stonesText) stEl.textContent = stonesText;

        // Equipo: solo se redibuja si cambió
        const team = this.cards.getTeam();
        const key = team.map(c => `${c.id}:${c.level}:${c.xp}`).join('|') + `#${this.dinoCatalog.dinos.length}`;
        if (key !== this.hudTeamKey) {
            this.hudTeamKey = key;
            const el = document.getElementById('hudTeam');
            el.innerHTML = [0, 1, 2].map(i => {
                const c = team[i];
                if (!c) return '<div class="hud-dino empty" title="Hueco libre"></div>';
                const d = this.cards.getDino(c.id);
                const src = d && (d.card || d.image);
                const style = src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : '';
                return `<div class="hud-dino" style="${style}" title="${d ? d.name : c.id} · Nv. ${c.level} (${c.xp}%)">
                            <span class="hud-dino-lvl">${c.level}</span>
                            <span class="hud-dino-xp" style="width:${c.xp}%"></span>
                        </div>`;
            }).join('');
        }
    }

    notifyStatus(msg) {
        const statusEl = document.getElementById('gameStatus');
        statusEl.textContent = msg;
        statusEl.classList.add('visible');
        clearTimeout(this.statusTimer);
        this.statusTimer = setTimeout(() => statusEl.classList.remove('visible'), 4000);
    }

    // ============================================================
    // CONTROLES Y MENÚ
    // ============================================================
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    initUI() {
        document.getElementById('inGameFullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btnOpenMap').addEventListener('click', (e) => { e.currentTarget.blur(); this.toggleWorldMap(); });
        document.getElementById('btnOpenMenu').addEventListener('click', (e) => {
            e.currentTarget.blur();
            if (this.canOpenMenu()) this.toggleMenu();
        });
        document.getElementById('menuCloseBtn').addEventListener('click', () => this.toggleMenu());
        document.querySelectorAll('.menu-tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => this.setMenuTab(btn.dataset.tab));
        });
        document.getElementById('tutorCloseBtn').addEventListener('click', () => this.cards.closeTutor());
        document.getElementById('shopCloseBtn').addEventListener('click', () => this.cards.closeShop());
        document.getElementById('btnQuickSave').addEventListener('click', (e) => {
            e.currentTarget.blur();
            if (this.canOpenMenu()) this.saves.save();
        });
        document.getElementById('endingCloseBtn').addEventListener('click', () => this.closeEnding());

        this.input.onEnterPress = () => {
            if (this.dialog) {
                this.advanceDialog();
            } else if (this.endingOpen) {
                this.closeEnding();
            } else if (this.state === 'overworld' && !this.activeEvent && !this.isMapOpen && !this.cards.isEncounterActive) {
                this.toggleMenu();
            }
        };
        this.input.onEscapePress = () => {
            if (this.tournament.isOpen) this.tournament.onEscape();
            else if (this.cards.shopOpen) this.cards.closeShop();
            else if (this.cards.tutorOpen) this.cards.closeTutor();
            else if (this.isMapOpen) this.isMapOpen = false;
            else if (this.isMenuOpen) this.toggleMenu();
        };
        this.input.onMapPress = () => this.toggleWorldMap();
        this.input.onInteractPress = () => {
            if (this.state !== 'overworld') return;
            if (this.dialog) this.advanceDialog();
            else this.tryInteractWithNPC();
        };
    }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        document.getElementById('gameMenuOverlay').style.display = this.isMenuOpen ? 'flex' : 'none';
        if (this.isMenuOpen) this.setMenuTab(this.activeMenuTab);
        else {
            if (document.activeElement) document.activeElement.blur();
            // Diálogo pendiente al cerrar el Almanaque (p. ej. el Dr. Cretácico)
            if (this.afterMenuDialog) {
                const d = this.afterMenuDialog;
                this.afterMenuDialog = null;
                this.showDialog(d.speaker, d.text);
            }
        }
    }

    setMenuTab(tab) {
        this.activeMenuTab = tab;
        document.querySelectorAll('.menu-tab-btn[data-tab]').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        this.renderMenuPanel(tab);
    }

    renderMenuPanel(tab) {
        const panel = document.getElementById('menuPanel');
        if (tab === 'status') {
            this.renderStatusPanel(panel);
        } else if (tab === 'cards') {
            this.cards.renderCardsPanel(panel);
        } else if (tab === 'bag') {
            this.cards.renderBagPanel(panel);
        } else if (tab === 'trainer') {
            this.renderTrainerPanel(panel);
        } else if (tab === 'story') {
            this.renderStoryPanel(panel);
        } else if (tab === 'save') {
            this.renderSavePanel(panel);
        } else if (tab === 'settings') {
            this.renderSettingsPanel(panel);
        }
    }

    canOpenMenu() {
        return this.state === 'overworld' && !this.activeEvent && !this.dialog && !this.cards.isEncounterActive && !this.endingOpen;
    }

    /** Piedras Elementales como insignias. */
    renderStonesHtml() {
        const { elements } = this.dinoCatalog;
        return `<div class="stone-row">${STONE_ORDER.map(el => {
            const e = elements[el];
            const has = this.story.hasStone(el);
            return `<div class="stone-badge ${has ? 'on' : ''}" style="--stone:${e ? e.color : '#94a3b8'}" title="${this.story.stoneName(el)}${has ? '' : ' (sin conseguir)'}">
                        <span>${e ? e.icon : '◆'}</span><small>${e ? e.name : el}</small>
                    </div>`;
        }).join('')}</div>`;
    }

    renderStoryPanel(panel) {
        const chapters = this.story.data.chapters || [];
        const current = this.story.chapter;
        const currentIdx = chapters.indexOf(current);
        const list = chapters.map((c, i) => {
            const state = i < currentIdx ? 'done' : (i === currentIdx ? 'current' : 'locked');
            const icon = state === 'done' ? '✔' : (state === 'current' ? '▶' : '🔒');
            return `<li class="chapter-item ${state}"><span class="chapter-icon">${icon}</span>
                        <div><strong>${escapeHtml(state === 'locked' ? '???' : c.title)}</strong>
                        ${state === 'current' ? `<p>${escapeHtml(this.story.format(c.objective))}</p>` : ''}</div></li>`;
        }).join('');
        panel.innerHTML = `
            <h3 class="panel-title">📜 Historia · Dino Rey</h3>
            <p class="panel-sub">Reúne las siete Piedras Elementales venciendo a los Guardianes y detén a la Banda Meteoro.</p>
            <h4 class="almanac-title">💎 Piedras Elementales (${this.story.stones.length}/7)</h4>
            ${this.renderStonesHtml()}
            <h4 class="almanac-title">📖 Capítulos</h4>
            <ol class="chapter-list">${list}</ol>
            <h4 class="almanac-title">⚔️ Combate estilo Persona 5</h4>
            <ul class="rules-list">
                <li><strong>¡Una más!</strong> Si atacas la debilidad de un rival (o haces un crítico) lo derribas y tu dino actúa otra vez.</li>
                <li><strong>Relevo:</strong> durante "¡Una más!" pasa la acción a otro dino: +50% de daño (x2 si encadenas).</li>
                <li><strong>Ataque total:</strong> con todos los rivales derribados, todo tu equipo ataca a la vez.</li>
                <li><strong>Derribado:</strong> un dino derribado pierde su siguiente acción. <strong>Defender</strong> evita ser derribado.</li>
                <li><strong>Niveles:</strong> tus dinos no evolucionan; se hacen más fuertes subiendo de nivel (máx. 50) y aprenden ataques nuevos con el Maestro Eldon.</li>
            </ul>`;
    }

    renderSavePanel(panel) {
        const slot = this.saves.currentSlot;
        const data = slot ? this.saves.read(slot) : null;
        panel.innerHTML = `
            <h3 class="panel-title">💾 Guardar partida</h3>
            <p class="panel-sub">Ranura ${slot || '—'} · Tiempo de juego ${SaveManager.formatTime(this.playTime)}
                ${data ? ` · Último guardado: ${SaveManager.formatDate(data.savedAt)}` : ''}</p>
            <div class="save-actions">
                <button id="menuSaveBtn" class="battle-btn win">💾 Guardar ahora</button>
                <button id="menuExportBtn" class="battle-btn swap">📤 Exportar a archivo</button>
                <button id="menuTitleBtn" class="battle-btn flee">🏠 Guardar y volver al título</button>
            </div>
            <div class="settings-list">
                <div class="settings-row"><span>Autoguardado (tras combates, capturas e historia)</span>
                    <label class="switch"><input type="checkbox" id="menuAutoSave" ${this.saves.settings.autoSave ? 'checked' : ''}><span></span></label></div>
            </div>
            <p class="panel-sub" style="margin-top:10px;">Las partidas se guardan en este navegador y en la nube (Google Sheets), así puedes seguir jugando desde otro dispositivo.</p>`;
        document.getElementById('menuSaveBtn').addEventListener('click', () => {
            this.saves.save();
            this.renderSavePanel(panel);
        });
        document.getElementById('menuExportBtn').addEventListener('click', () => {
            this.saves.save(slot, { silent: true });
            this.saves.exportSlot(slot);
        });
        document.getElementById('menuTitleBtn').addEventListener('click', () => {
            this.saves.save(slot, { silent: true });
            setTimeout(() => window.location.reload(), 300);
        });
        document.getElementById('menuAutoSave').addEventListener('change', (e) => {
            this.saves.setSetting('autoSave', e.target.checked);
        });
    }

    /** Icono de guardado en la barra superior. */
    flashSaveIcon() {
        const el = document.getElementById('btnQuickSave');
        el.classList.remove('saved');
        void el.offsetWidth;
        el.classList.add('saved');
    }

    // ============================================================
    // FINAL DE LA HISTORIA
    // ============================================================
    showEnding(text) {
        this.endingOpen = true;
        const pages = text.split('\n').filter(Boolean);
        document.getElementById('endingText').innerHTML = pages.map((t, i) => `<p style="animation-delay:${0.4 + i * 1.1}s">${escapeHtml(t)}</p>`).join('');
        document.getElementById('endingTeam').innerHTML = this.cards.getTeam().map(c => this.cards.renderCardHtml(c)).join('');
        document.getElementById('endingOverlay').style.display = 'flex';
    }

    closeEnding() {
        this.endingOpen = false;
        document.getElementById('endingOverlay').style.display = 'none';
        this.notifyStatus('👑 ¡Eres el Dino Rey! La aventura continúa...');
        this.saves.autoSave();
    }

    renderTrainerPanel(panel) {
        const p = this.localPlayer;
        const expPct = Math.min(100, Math.round((p.exp / p.expNext) * 100));
        const tile = (label, value) => `<div class="info-tile"><span>${label}</span><strong>${value}</strong></div>`;
        panel.innerHTML = `
            <div class="trainer-card">
                <canvas id="trainerPortrait" width="128" height="128"></canvas>
                <div>
                    <h3 class="panel-title">👤 ${escapeHtml(p.name)}${this.story.flags.dinoRey ? ' 👑' : ''}</h3>
                    <p class="panel-sub">Nivel de entrenador ${p.level} · ${p.exp}/${p.expNext} EXP (${expPct}%)</p>
                    <p class="panel-sub">${escapeHtml(this.story.chapter ? this.story.chapter.title : '')}</p>
                </div>
            </div>
            <div class="info-grid">
                ${tile('Nivel', p.level)}
                ${tile('Dinos en el almanaque', this.cards.collection.length)}
                ${tile('Entrenadores vencidos', this.defeatedTrainers.size)}
                ${tile('Piedras Elementales', `${this.story.stones.length}/7`)}
                ${tile('Cartas de movimiento', Object.values(this.cards.moveCards).reduce((a, b) => a + b, 0))}
                ${tile('Tiempo de juego', SaveManager.formatTime(this.playTime))}
                ${tile('Dino-Créditos', `💰 ${this.cards.credits}`)}
                ${tile('Torneos ganados', `🏆 ${this.story.flags.torneoVictorias || 0}`)}
            </div>
            <h4 class="almanac-title">💎 Piedras Elementales</h4>
            ${this.renderStonesHtml()}
        `;
        const cv = document.getElementById('trainerPortrait');
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        const img = p.renderer.image;
        if (img) ctx.drawImage(img, 0, 10 * 64, 64, 64, 0, 0, 128, 128);
    }

    /** Pestaña Estado (Enter): lo que antes mostraba la barra superior y la ayuda de controles. */
    renderStatusPanel(panel) {
        const p = this.localPlayer;
        const ch = this.story.chapter;
        const expPct = Math.min(100, Math.round((p.exp / p.expNext) * 100));
        const net = document.getElementById('netStatus');
        const team = this.cards.getTeam();
        const slot = this.saves.currentSlot;
        const saved = slot ? this.saves.read(slot) : null;
        const teamHtml = team.length ? team.map(c => {
            const d = this.cards.getDino(c.id);
            const el = d && this.dinoCatalog.elements[d.element];
            const src = d && (d.card || d.image);
            return `<div class="status-dino">
                        <span class="status-dino-img" style="${src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : ''}"></span>
                        <div><strong>${escapeHtml(d ? d.name : c.id)}</strong>
                        <small style="color:${el ? el.color : '#94a3b8'}">${el ? el.icon + ' ' + el.name : ''} · Nv. ${c.level}</small>
                        <div class="status-xp"><span style="width:${c.xp}%"></span></div></div>
                    </div>`;
        }).join('') : '<p class="muted">Aún no tienes dinos en tu equipo.</p>';
        const keys = [
            ['Moverse', '<kbd>WASD</kbd> / <kbd>Flechas</kbd>'], ['Correr', '<kbd>Shift</kbd>'],
            ['Hablar / avanzar', '<kbd>Espacio</kbd> / <kbd>E</kbd>'], ['Mapa', '<kbd>M</kbd>'],
            ['Menú', '<kbd>Enter</kbd>'], ['Combate', '<kbd>1</kbd>-<kbd>4</kbd> ataques · <kbd>D</kbd> defender · <kbd>T</kbd> ataque total']
        ];
        panel.innerHTML = `
            <div class="status-head">
                <div>
                    <h3 class="panel-title">👤 ${escapeHtml(p.name)} <span class="hud-level">Nv. ${p.level}</span></h3>
                    <div class="hud-exp status-exp"><div class="hud-exp-fill" style="width:${expPct}%"></div></div>
                </div>
                <div class="status-chips">
                    <span>📍 ${escapeHtml(this.mapTitle)}</span>
                    <span>💰 ${this.cards.credits}</span>
                    <span>⏱ ${SaveManager.formatTime(this.playTime)}</span>
                    <span>${net ? escapeHtml(net.textContent) : ''}</span>
                </div>
            </div>
            <div class="status-objective">
                <small>${escapeHtml(ch ? ch.title : 'Objetivo')}</small>
                <strong>📜 ${escapeHtml(this.story.objective)}</strong>
            </div>
            <h4 class="almanac-title">💎 Piedras Elementales (${this.story.stones.length}/7)</h4>
            ${this.renderStonesHtml()}
            <h4 class="almanac-title">⚔️ Tu equipo</h4>
            <div class="status-team">${teamHtml}</div>
            <div class="save-actions">
                <button id="statusSaveBtn" class="battle-btn win">💾 Guardar partida</button>
                <button id="statusMapBtn" class="battle-btn swap">🗺️ Ver mapa</button>
                <button id="statusFsBtn" class="battle-btn flee">⛶ Pantalla completa</button>
            </div>
            <p class="panel-sub">${slot ? `Ranura ${slot}` : ''}${saved ? ` · Último guardado: ${SaveManager.formatDate(saved.savedAt)}` : ''}</p>
            <h4 class="almanac-title">🎮 Controles</h4>
            <div class="status-keys">${keys.map(([a, k]) => `<span><b>${a}</b> ${k}</span>`).join('')}</div>`;
        document.getElementById('statusSaveBtn').addEventListener('click', () => {
            this.saves.save();
            this.renderStatusPanel(panel);
        });
        document.getElementById('statusMapBtn').addEventListener('click', () => {
            this.toggleMenu();
            this.toggleWorldMap();
        });
        document.getElementById('statusFsBtn').addEventListener('click', () => this.toggleFullscreen());
    }

    renderSettingsPanel(panel) {
        const row = (label, value) => `<div class="settings-row"><span>${label}</span>${value}</div>`;
        panel.innerHTML = `
            <h3 class="panel-title">⚙️ Opciones</h3>
            <div class="settings-list">
                ${row('Pantalla completa', '<button id="menuFullscreenBtn" class="btn-ghost">Alternar</button>')}
                ${row('Moverse', '<span><kbd>WASD</kbd> / <kbd>Flechas</kbd></span>')}
                ${row('Correr', '<kbd>Shift</kbd>')}
                ${row('Hablar / avanzar diálogo', '<span><kbd>Espacio</kbd> / <kbd>E</kbd></span>')}
                ${row('Mapa del mundo', '<kbd>M</kbd>')}
                ${row('Menú', '<kbd>Enter</kbd>')}
            </div>
        `;
        document.getElementById('menuFullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.dinoGame = new Game();
});
