/**
 * Game - Controlador Principal de Dino King
 * Modo Multijugador en tiempo real con Mapa Real (GRASS+.png)
 * Cada jugador que entra tiene su propia sesión, cámara y personaje independiente.
 */

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.state = 'character_select';

        // 1. Mapa Real ampliado con tileset GRASS+.png (120 cols x 90 rows, 32px por tile = 3840x2880 px)
        this.tileMap = new TileMap(120, 90, 32);

        // 2. Cámara 2D suave
        this.camera = new Camera(this.width, this.height, this.tileMap.width, this.tileMap.height);

        // 3. Minimapa / Radar adaptativo
        this.miniMap = new MiniMap(this.tileMap, { width: 200, height: 150 });

        this.input = new InputHandler();

        // 4. Jugador Local (Aparece en la Plaza Central de Pueblo Raíz: X=1920, Y=1472)
        this.myId = null;
        this.localPlayer = new Player(1, 'Martín', 1920, 1472, {
            initialDirection: 'down'
        });

        // 5. Jugadores Remotos (Multijugador en vivo)
        this.remotePlayers = {}; // id -> Player

        this.camera.follow(this.localPlayer);

        // Notificaciones y Zonas
        this.currentZoneId = 'town';
        this.zoneBanner = '🏡 PUEBLO RAÍZ (PLAZA CENTRAL)';
        this.zoneTimer = 180;
        this.lastSentMove = { x: 0, y: 0, direction: '', state: '' };

        // Menú de Aventura (Tecla ENTER)
        this.isMenuOpen = false;
        this.activeMenuTab = 'stats';

        // Escuchar subida de nivel y EXP del jugador local estilo Stardew Valley
        this.localPlayer.onExpGain = (data) => {
            if (data.leveledUp) {
                this.notifyStatus(`🎉 ¡NIVEL ${data.level}! Tus atributos y energía aumentaron.`);
            } else if (data.reason) {
                this.notifyStatus(`✨ +${data.amount} EXP: ${data.reason}`);
            }
            this.updateHUD();
        };

        // Pantalla de selección de personaje
        this.characterSelect = new CharacterSelect((charData) => {
            this.onCharacterSelected(charData);
        });

        this.initUI();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    onCharacterSelected(charData) {
        this.localPlayer.name = charData.name;
        this.localPlayer.spriteFile = charData.sprite;

        // Asignar renderer con sprite elegido
        if (charData.renderer && charData.renderer.loaded && charData.renderer.image) {
            this.localPlayer.renderer.image = charData.renderer.image;
            this.localPlayer.renderer.loaded = true;
        } else if (charData.sprite) {
            this.localPlayer.renderer.loadFromUrl(`assets/characters/${charData.sprite}`);
        }

        const nameDisplay = document.getElementById('hudPlayerName');
        if (nameDisplay) nameDisplay.textContent = this.localPlayer.name;

        this.state = 'overworld';
        this.zoneTimer = 180;

        // Conectar al servidor multijugador WebSocket
        this.connectMultiplayer();
        this.notifyStatus(`¡Bienvenido al mundo Dino King, ${this.localPlayer.name}!`);
    }

    connectMultiplayer() {
        const wsHost = window.location.hostname || 'localhost';
        const wsUrl = `ws://${wsHost}:8001`;

        const statusEl = document.getElementById('netStatus');
        if (statusEl) statusEl.textContent = '🟡 Conectando...';

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                if (statusEl) {
                    statusEl.textContent = '🟢 En línea (Multijugador)';
                    statusEl.style.color = '#00ffcc';
                }

                // Enviar datos de entrada
                this.ws.send(JSON.stringify({
                    type: 'join',
                    name: this.localPlayer.name,
                    sprite: this.localPlayer.spriteFile || 'character_3.png',
                    x: this.localPlayer.x,
                    y: this.localPlayer.y,
                    direction: this.localPlayer.direction
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    this.handleNetworkMessage(msg);
                } catch (e) {
                    console.error('Error parseando mensaje WebSocket:', e);
                }
            };

            this.ws.onclose = () => {
                if (statusEl) {
                    statusEl.textContent = '🔴 Desconectado (Modo Local)';
                    statusEl.style.color = '#ff6b6b';
                }
                // Reintentar en 4 segundos
                setTimeout(() => {
                    if (this.state === 'overworld') this.connectMultiplayer();
                }, 4000);
            };

            this.ws.onerror = () => {
                if (statusEl) {
                    statusEl.textContent = '⚪ Modo Local (Sin servidor WS)';
                    statusEl.style.color = '#8892b0';
                }
            };

        } catch (e) {
            console.warn('WebSocket no disponible:', e);
        }
    }

    handleNetworkMessage(msg) {
        if (msg.type === 'welcome') {
            this.myId = msg.yourId;
            // Registrar jugadores existentes en el servidor
            for (const pid in msg.players) {
                if (pid !== this.myId) {
                    this.addRemotePlayer(msg.players[pid]);
                }
            }
        } else if (msg.type === 'player_joined') {
            if (msg.player.id !== this.myId) {
                this.addRemotePlayer(msg.player);
                this.notifyStatus(`👋 ¡${msg.player.name} entró al mundo!`);
            }
        } else if (msg.type === 'player_moved') {
            if (this.remotePlayers[msg.id]) {
                this.remotePlayers[msg.id].updateRemote(msg);
            }
        } else if (msg.type === 'player_left') {
            if (this.remotePlayers[msg.id]) {
                const leftName = this.remotePlayers[msg.id].name;
                delete this.remotePlayers[msg.id];
                this.notifyStatus(`🚶 ${leftName} salió del mundo.`);
            }
        } else if (msg.type === 'player_sprite_changed') {
            if (this.remotePlayers[msg.id]) {
                this.remotePlayers[msg.id].spriteFile = msg.sprite;
                this.remotePlayers[msg.id].renderer.loadFromUrl(`assets/characters/${msg.sprite}`);
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
        this.remotePlayers[data.id] = rp;
    }

    update() {
        if (this.state !== 'overworld') return;

        // Si el menú de pausa/aventura está abierto, congelar movimiento
        if (this.isMenuOpen) {
            this.camera.update();
            this.updateHUD();
            return;
        }

        const p1In = this.input.getP1Input();

        // 1. Actualizar jugador local
        const moved = this.localPlayer.update(p1In, this.tileMap);

        // 2. Enviar actualización al servidor si cambió de posición o animación
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const hasChanged = (
                Math.abs(this.localPlayer.x - this.lastSentMove.x) > 0.5 ||
                Math.abs(this.localPlayer.y - this.lastSentMove.y) > 0.5 ||
                this.localPlayer.direction !== this.lastSentMove.direction ||
                this.localPlayer.state !== this.lastSentMove.state
            );

            if (hasChanged) {
                this.ws.send(JSON.stringify({
                    type: 'move',
                    x: Math.round(this.localPlayer.x),
                    y: Math.round(this.localPlayer.y),
                    direction: this.localPlayer.direction,
                    state: this.localPlayer.state,
                    isRunning: this.localPlayer.isRunning
                }));

                this.lastSentMove = {
                    x: this.localPlayer.x,
                    y: this.localPlayer.y,
                    direction: this.localPlayer.direction,
                    state: this.localPlayer.state
                };
            }
        }

        // 3. Suavizar movimiento de jugadores remotos
        for (const id in this.remotePlayers) {
            const rp = this.remotePlayers[id];
            // Si está muy cerca de mí, activar alerta '!'
            const dist = Math.hypot(this.localPlayer.x - rp.x, this.localPlayer.y - rp.y);
            rp.bubbleAlert = (dist < 80);
        }

        // 4. Actualizar cámara suave
        this.camera.update();

        // 5. Detectar cambio de zona geográfica en el mapa ampliado
        const currentZone = this.tileMap.getZoneAt(this.localPlayer.x, this.localPlayer.y);
        if (currentZone && currentZone.id !== this.currentZoneId) {
            this.currentZoneId = currentZone.id;
            this.zoneBanner = currentZone.banner;
            this.zoneTimer = 180;
            const zoneEl = document.getElementById('currentZone');
            if (zoneEl) zoneEl.textContent = currentZone.name;

            // Registrar zona visitada y avanzar misiones estilo Stardew Valley
            if (!this.localPlayer.visitedZones.has(currentZone.id)) {
                this.localPlayer.visitedZones.add(currentZone.id);
                const mExplore = this.localPlayer.missions.find(m => m.id === 'm_explore');
                if (mExplore) {
                    mExplore.current = this.localPlayer.visitedZones.size;
                    if (mExplore.current >= mExplore.target && !mExplore.done) {
                        mExplore.done = true;
                        this.localPlayer.gainExp(mExplore.expReward, `Misión Cumplida: "${mExplore.title}"`);
                    }
                }
            }
            if (currentZone.id === 'lake') {
                this.localPlayer.advanceMission('m_lake', 1);
                this.localPlayer.gainSkillExp('fishing', 15);
            } else if (currentZone.id === 'sanctuary') {
                this.localPlayer.advanceMission('m_sanctuary', 1);
                this.localPlayer.gainSkillExp('foraging', 15);
            } else if (currentZone.id === 'canyon') {
                this.localPlayer.gainSkillExp('mining', 15);
            }
        }

        if (this.zoneTimer > 0) this.zoneTimer--;
        this.updateHUD();
    }

    draw() {
        if (this.state !== 'overworld') return;

        this.ctx.clearRect(0, 0, this.width, this.height);

        // 1. Capa de Mundo (con cámara aplicada)
        this.camera.apply(this.ctx);

        // 1.1 Suelo y elementos del tileset GRASS+.png
        this.tileMap.draw(this.ctx, this.camera);

        // 1.2 Todos los jugadores (local + remotos) ordenados por Y para profundidad 2.5D
        const allEntities = [this.localPlayer, ...Object.values(this.remotePlayers)];
        allEntities.sort((a, b) => a.y - b.y);
        allEntities.forEach(p => p.draw(this.ctx));

        this.camera.restore(this.ctx);

        // 2. Capa de Interfaz Fija (HUD + Minimapa)
        this.miniMap.draw(this.ctx, this.camera, this.localPlayer, this.remotePlayers);

        // 2.1 Banner de Zona
        if (this.zoneTimer > 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
            this.ctx.strokeStyle = '#fca311';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.roundRect(20, 20, 290, 42, 8);
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillStyle = '#ffbe0b';
            this.ctx.font = 'bold 12px monospace';
            this.ctx.fillText(this.zoneBanner, 32, 46);
            this.ctx.restore();
        }
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }

    updateHUD() {
        const coordEl = document.getElementById('playerCoords');
        if (coordEl) {
            const tileX = Math.floor(this.localPlayer.x / this.tileMap.tileSize);
            const tileY = Math.floor(this.localPlayer.y / this.tileMap.tileSize);
            coordEl.textContent = `X: ${tileX}, Y: ${tileY} (Px: ${Math.round(this.localPlayer.x)}, ${Math.round(this.localPlayer.y)})`;
        }

        const terrainEl = document.getElementById('currentTerrain');
        if (terrainEl) {
            if (this.localPlayer.inTallGrass) {
                terrainEl.textContent = '🌿 Pasto Silvestre (Hierba Alta)';
                terrainEl.style.color = '#70e000';
            } else {
                terrainEl.textContent = 'Pasto despejado';
                terrainEl.style.color = '#cbd5e1';
            }
        }

        // Actualizar datos Stardew Valley en el HUD
        const lvlBadge = document.getElementById('hudLevelBadge');
        if (lvlBadge) lvlBadge.textContent = `Nv. ${this.localPlayer.level}`;

        const hpFill = document.getElementById('hudHpFill');
        const hpText = document.getElementById('hudHpText');
        if (hpFill && hpText) {
            const hpPct = Math.max(0, Math.min(100, (this.localPlayer.hp / this.localPlayer.maxHp) * 100));
            hpFill.style.width = `${hpPct}%`;
            hpText.textContent = `${Math.round(this.localPlayer.hp)}/${this.localPlayer.maxHp}`;
        }

        const energyFill = document.getElementById('hudEnergyFill');
        const energyText = document.getElementById('hudEnergyText');
        if (energyFill && energyText) {
            const energyPct = Math.max(0, Math.min(100, (this.localPlayer.energy / this.localPlayer.maxEnergy) * 100));
            energyFill.style.width = `${energyPct}%`;
            energyText.textContent = `${Math.round(this.localPlayer.energy)}/${this.localPlayer.maxEnergy}`;
        }

        const expFill = document.getElementById('hudExpFill');
        const expText = document.getElementById('hudExpText');
        if (expFill && expText) {
            const expPct = Math.max(0, Math.min(100, (this.localPlayer.exp / this.localPlayer.expNext) * 100));
            expFill.style.width = `${expPct}%`;
            expText.textContent = `${Math.round(this.localPlayer.exp)}/${this.localPlayer.expNext}`;
        }
    }

    initUI() {
        const fsBtn = document.getElementById('inGameFullscreenBtn');
        if (fsBtn) {
            fsBtn.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(() => {});
                } else {
                    document.exitFullscreen().catch(() => {});
                }
            });
        }

        this.initMenu();
    }

    initMenu() {
        const overlay = document.getElementById('gameMenuOverlay');
        const closeBtn = document.getElementById('menuCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleMenu());
        }

        const tabBtns = document.querySelectorAll('.menu-tab-btn[data-tab]');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMenuTab(btn.dataset.tab);
            });
        });

        // Configurar listener para abrir/cerrar con ENTER y ESCAPE
        this.input.onEnterPress = () => {
            if (this.state === 'overworld') {
                this.toggleMenu();
            }
        };

        this.input.onEscapePress = () => {
            if (this.isMenuOpen) {
                this.toggleMenu();
            }
        };
    }

    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        const overlay = document.getElementById('gameMenuOverlay');
        if (overlay) {
            overlay.style.display = this.isMenuOpen ? 'flex' : 'none';
        }
        if (this.isMenuOpen) {
            this.setMenuTab(this.activeMenuTab || 'stats');
        }
    }

    setMenuTab(tab) {
        this.activeMenuTab = tab;
        document.querySelectorAll('.menu-tab-btn[data-tab]').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        this.renderMenuPanel(tab);
    }

    async renderMenuPanel(tab) {
        const panel = document.getElementById('menuPanel');
        if (!panel) return;

        if (tab === 'stats') {
            const curClass = PLAYER_CLASSES[this.localPlayer.playerClassKey] || PLAYER_CLASSES.guerrero;
            const expPct = Math.min(100, Math.round((this.localPlayer.exp / this.localPlayer.expNext) * 100));

            // Generar tarjetas de clase para selección
            let classesHtml = '';
            for (const key in PLAYER_CLASSES) {
                const c = PLAYER_CLASSES[key];
                const isActive = (this.localPlayer.playerClassKey === key);
                classesHtml += `
                    <div class="menu-class-card ${isActive ? 'active' : ''}" data-class="${key}">
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span style="font-size:1.3rem;">${c.icon}</span>
                            <strong style="color:${isActive ? '#ffbe0b' : '#fff'}; font-size:0.88rem;">${c.name}</strong>
                        </div>
                        <p style="color:#94a3b8; font-size:0.75rem; line-height:1.3;">${c.desc}</p>
                        <div style="margin-top:6px; font-size:0.72rem; color:#2ec4b6;">
                            HP: ${c.baseHp} | EN: ${c.baseEnergy} | ATK: ${c.attack}
                        </div>
                    </div>
                `;
            }

            // Generar tarjetas de las 5 habilidades Stardew Valley
            let skillsHtml = '';
            for (const key in this.localPlayer.skills) {
                const sk = this.localPlayer.skills[key];
                const skPct = Math.min(100, Math.round((sk.exp / sk.next) * 100));
                skillsHtml += `
                    <div class="menu-skill-card">
                        <div class="menu-skill-header">
                            <span>${sk.icon} ${sk.name}</span>
                            <span style="color:#ffbe0b;">Nv. ${sk.level}</span>
                        </div>
                        <div class="menu-skill-bar-bg">
                            <div class="menu-skill-bar-fill" style="width: ${skPct}%;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#8892b0; margin-top:4px;">
                            <span>EXP: ${sk.exp}/${sk.next}</span>
                            <span>${skPct}%</span>
                        </div>
                    </div>
                `;
            }

            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; background:#161f33; padding:12px; border-radius:8px; border:1px solid #2d3b59;">
                    <div>
                        <h3 style="color:#ffbe0b; font-size:1.15rem; margin-bottom:4px;">
                            ${curClass.icon} ${this.localPlayer.name} - <span style="color:#00e5ff;">${curClass.name}</span>
                        </h3>
                        <p style="color:#94a3b8; font-size:0.8rem;">Progresión de Personaje estilo Stardew Valley</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="background:#ffbe0b; color:#0b0f19; font-weight:bold; padding:4px 10px; border-radius:4px; font-size:0.85rem;">NIVEL ${this.localPlayer.level}</span>
                        <div style="font-size:0.75rem; color:#8892b0; margin-top:4px;">EXP: ${this.localPlayer.exp} / ${this.localPlayer.expNext} (${expPct}%)</div>
                    </div>
                </div>

                <h4 style="color:#ffbe0b; margin-bottom:8px; font-size:0.9rem;">⚡ Seleccionar Clase:</h4>
                <div class="menu-class-grid">
                    ${classesHtml}
                </div>

                <h4 style="color:#ffbe0b; margin:12px 0 8px 0; font-size:0.9rem;">📊 Atributos Principales:</h4>
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin-bottom:14px;">
                    <div style="background:#182033; border:1px solid #2f3e61; padding:8px; border-radius:6px; text-align:center;">
                        <span style="font-size:0.75rem; color:#8892b0;">Salud Máx.</span><br>
                        <strong style="color:#ff4d6d; font-size:1rem;">❤️ ${this.localPlayer.maxHp}</strong>
                    </div>
                    <div style="background:#182033; border:1px solid #2f3e61; padding:8px; border-radius:6px; text-align:center;">
                        <span style="font-size:0.75rem; color:#8892b0;">Energía</span><br>
                        <strong style="color:#2ec4b6; font-size:1rem;">⚡ ${Math.round(this.localPlayer.energy)}/${this.localPlayer.maxEnergy}</strong>
                    </div>
                    <div style="background:#182033; border:1px solid #2f3e61; padding:8px; border-radius:6px; text-align:center;">
                        <span style="font-size:0.75rem; color:#8892b0;">Ataque</span><br>
                        <strong style="color:#ffbe0b; font-size:1rem;">⚔️ ${this.localPlayer.attack}</strong>
                    </div>
                    <div style="background:#182033; border:1px solid #2f3e61; padding:8px; border-radius:6px; text-align:center;">
                        <span style="font-size:0.75rem; color:#8892b0;">Defensa</span><br>
                        <strong style="color:#00e5ff; font-size:1rem;">🛡️ ${this.localPlayer.defense}</strong>
                    </div>
                </div>

                <h4 style="color:#ffbe0b; margin-bottom:8px; font-size:0.9rem;">🌱 Habilidades Stardew Valley (Aumentan trabajando y explorando):</h4>
                <div class="menu-skills-grid">
                    ${skillsHtml}
                </div>
            `;

            // Event listeners para cambiar de clase al hacer clic
            panel.querySelectorAll('.menu-class-card[data-class]').forEach(card => {
                card.addEventListener('click', () => {
                    const classKey = card.dataset.class;
                    this.localPlayer.setPlayerClass(classKey);
                    this.notifyStatus(`¡Clase cambiada a: ${PLAYER_CLASSES[classKey].name}!`);
                    this.renderMenuPanel('stats');
                    this.updateHUD();
                });
            });
        } else if (tab === 'missions') {
            let missionsHtml = '';
            this.localPlayer.missions.forEach(m => {
                const pct = Math.min(100, Math.round((m.current / m.target) * 100));
                missionsHtml += `
                    <div class="menu-mission-card ${m.done ? 'done' : ''}">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <strong style="color:${m.done ? '#ffbe0b' : '#fff'}; font-size:0.92rem;">${m.title}</strong>
                                <span style="background:${m.done ? '#2ec4b6' : '#2b3856'}; color:${m.done ? '#061a14' : '#00e5ff'}; font-weight:bold; font-size:0.7rem; padding:2px 8px; border-radius:10px;">
                                    ${m.done ? 'COMPLETADA ✓' : `${m.current} / ${m.target}`}
                                </span>
                            </div>
                            <p style="color:#94a3b8; font-size:0.78rem; margin:4px 0 8px 0;">${m.desc}</p>
                            <div class="menu-skill-bar-bg" style="width:240px; height:5px;">
                                <div class="menu-skill-bar-fill" style="width:${pct}%; background:${m.done ? '#ffbe0b' : '#2ec4b6'};"></div>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="color:#ffbe0b; font-weight:bold; font-size:0.85rem;">+${m.expReward} EXP</span>
                        </div>
                    </div>
                `;
            });

            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                    <div>
                        <h3 style="color:#ffbe0b; margin-bottom:4px;">📜 Tablón de Misiones del Valle</h3>
                        <p style="color:#8892b0; font-size:0.8rem;">Completa misiones explorando el mundo para subir de nivel y obtener EXP.</p>
                    </div>
                    <span style="background:#1f283d; border:1px solid #3c486e; padding:4px 10px; border-radius:6px; font-size:0.78rem; color:#ffbe0b;">
                        Misiones Activas: ${this.localPlayer.missions.filter(m => !m.done).length}
                    </span>
                </div>
                <div class="menu-missions-list">
                    ${missionsHtml}
                </div>
            `;
        } else if (tab === 'bag') {
            panel.innerHTML = `
                <h3 style="color:#ffbe0b; margin-bottom:12px;">🎒 Mochila de Aventuras</h3>
                <div class="menu-items-grid">
                    <div class="menu-item-slot">
                        <span class="menu-item-icon">🔴</span>
                        <div><strong>Dino Ball Alfa</strong><br><span style="color:#8892b0; font-size:0.78rem;">x 15 Unidades</span></div>
                    </div>
                    <div class="menu-item-slot">
                        <span class="menu-item-icon">🥩</span>
                        <div><strong>Carne Prehistórica</strong><br><span style="color:#8892b0; font-size:0.78rem;">Restaura 20 PS (x 8)</span></div>
                    </div>
                    <div class="menu-item-slot">
                        <span class="menu-item-icon">👟</span>
                        <div><strong>Zapatillas Deportivas</strong><br><span style="color:#00e5ff; font-size:0.78rem;">Equipado (Shift)</span></div>
                    </div>
                    <div class="menu-item-slot">
                        <span class="menu-item-icon">🧭</span>
                        <div><strong>Brújula Radar</strong><br><span style="color:#2ec4b6; font-size:0.78rem;">Activa en pantalla</span></div>
                    </div>
                </div>
            `;
        } else if (tab === 'map') {
            const currentZone = this.tileMap.getZoneAt(this.localPlayer.x, this.localPlayer.y);
            panel.innerHTML = `
                <h3 style="color:#ffbe0b; margin-bottom:6px;">🗺️ Región de la Ruta 1 (6 Grandes Zonas)</h3>
                <p style="color:#8892b0; margin-bottom:12px; font-size:0.82rem;">Zona actual: <strong style="color:#00e5ff;">${currentZone ? currentZone.name : 'Ruta 1'}</strong></p>
                <div class="menu-zones-list">
                    <div class="menu-zone-card">
                        <div><strong>🏡 Pueblo Raíz (Centro)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Plaza central, fuente de agua, jardines florales y encrucijada principal.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 60, Y: 45</span>
                    </div>
                    <div class="menu-zone-card">
                        <div><strong>🌊 Lago Espejo & Bahía Jurásica (Noroeste)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Gran lago de agua dulce con un islote secreto en el centro y muelle.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 26, Y: 22</span>
                    </div>
                    <div class="menu-zone-card">
                        <div><strong>🌿 Selva Jurásica & Bosque Sombrío (Nordeste)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Espesos campos de hierba alta y caminos sinuosos con dinos salvajes.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 95, Y: 22</span>
                    </div>
                    <div class="menu-zone-card">
                        <div><strong>🦕 Santuario Jurásico & Corrales (Suroeste)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Gran corral cercado de madera con abrevadero para cuidar dinosaurios.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 26, Y: 70</span>
                    </div>
                    <div class="menu-zone-card">
                        <div><strong>🪨 Cañón Prehistórico & Cantera Rocosa (Sureste)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Senderos rocosos de montaña, pilares de piedra y acantilados escarpados.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 95, Y: 70</span>
                    </div>
                    <div class="menu-zone-card">
                        <div><strong>🌺 Pradera Floral (Norte) & Sendero del Valle (Sur)</strong><br><span style="color:#94a3b8; font-size:0.78rem;">Caminos con flores silvestres y pasturas que extienden el valle.</span></div>
                        <span style="color:#ffbe0b; font-size:0.78rem;">X: 60, Y: 20 / 75</span>
                    </div>
                </div>
            `;
        } else if (tab === 'trainer') {
            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div>
                        <h3 style="color:#ffbe0b;">👤 Ficha de Entrenador: ${this.localPlayer.name}</h3>
                        <p style="color:#8892b0; font-size:0.8rem;">Sprite actual: <code>${this.localPlayer.spriteFile || 'character_3.png'}</code></p>
                    </div>
                    <span style="background:#1f293d; border:1px solid #3c486e; padding:4px 10px; border-radius:6px; font-size:0.75rem; color:#00e5ff;">
                        ¡Haz clic en cualquier sprite para cambiarlo en tiempo real!:
                    </span>
                </div>
                <div class="menu-sprites-grid" id="menuSpritesGrid">
                    <p style="color:#8892b0;">Cargando personajes disponibles...</p>
                </div>
            `;

            try {
                const res = await fetch('/api/characters');
                if (res.ok) {
                    const list = await res.json();
                    const grid = document.getElementById('menuSpritesGrid');
                    if (grid) {
                        grid.innerHTML = '';
                        list.forEach((file) => {
                            const isCurrent = (this.localPlayer.spriteFile === file);
                            const item = document.createElement('div');
                            item.className = `menu-sprite-item ${isCurrent ? 'active' : ''}`;
                            let label = file.replace('.png', '').replace('character_', '#');
                            item.innerHTML = `
                                <div style="font-size:1.3rem; margin-bottom:4px;">🧑</div>
                                <strong>${label}</strong>
                            `;
                            item.addEventListener('click', () => {
                                this.changeSprite(file);
                                document.querySelectorAll('.menu-sprite-item').forEach(el => el.classList.remove('active'));
                                item.classList.add('active');
                            });
                            grid.appendChild(item);
                        });
                    }
                }
            } catch (e) {
                console.warn('Error al cargar lista de personajes en menú:', e);
            }
        } else if (tab === 'settings') {
            panel.innerHTML = `
                <h3 style="color:#ffbe0b; margin-bottom:16px;">⚙️ Opciones del Juego</h3>
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#192033; padding:12px; border-radius:6px;">
                        <span>⛶ Pantalla Completa:</span>
                        <button id="menuFullscreenBtn" style="background:#252e48; border:1px solid #3c486e; color:#fff; padding:6px 14px; border-radius:4px; cursor:pointer;">
                            Alternar
                        </button>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#192033; padding:12px; border-radius:6px;">
                        <span>🧭 Radar / Minimapa:</span>
                        <span style="color:#00e5ff; font-weight:bold;">Activado (Arriba a la derecha)</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#192033; padding:12px; border-radius:6px;">
                        <span>👟 Velocidad de Carrera (Shift):</span>
                        <span style="color:#ffbe0b; font-weight:bold;">2x (Zapatillas deportivas)</span>
                    </div>
                </div>
            `;
            const fsBtn = document.getElementById('menuFullscreenBtn');
            if (fsBtn) {
                fsBtn.addEventListener('click', () => {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(() => {});
                    } else {
                        document.exitFullscreen().catch(() => {});
                    }
                });
            }
        }
    }

    changeSprite(filename) {
        this.localPlayer.spriteFile = filename;
        this.localPlayer.renderer.loadFromUrl(`assets/characters/${filename}`);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'change_sprite',
                sprite: filename
            }));
        }
        this.notifyStatus(`¡Apariencia actualizada a: ${filename}!`);
    }

    notifyStatus(msg) {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.textContent = msg;
            setTimeout(() => {
                if (statusEl.textContent === msg) statusEl.textContent = '';
            }, 4000);
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.dinoGame = new Game();
});
