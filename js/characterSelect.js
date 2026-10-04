/**
 * TitleScreen - Pantalla de título de Dino Rey.
 *
 * - Menú: Continuar (partida más reciente), Nueva partida, Cargar partida.
 * - Ranuras de guardado: cargar, borrar, exportar e importar partidas (js/save.js).
 * - Elección de protagonista: solo los dos de assets/characters/protagonistas.json.
 *   El que no elijas será tu rival en la historia.
 */

class TitleScreen {
    constructor(game) {
        this.game = game;
        this.saves = game.saves;
        this.root = document.getElementById('titleScreen');
        this.heroes = [];
        this.heroIndex = 0;
        this.slotMode = 'new';     // 'new' | 'load'
        this.targetSlot = null;
        this.nameEdited = false;
        this.confirm = null;       // { slot, action } esperando confirmación
        this.renderers = [];
        this.animTimer = 0;

        this.initEvents();
        this.loadHeroes();
        this.show('main');
        this.refresh();
        this.saves.syncFromServer().then(changed => { if (changed) this.refresh(); });
        this.startPreviewLoop();
    }

    async loadHeroes() {
        await this.game.heroesReady;
        this.heroes = this.game.heroes;
        if (this.heroes.length === 0) {
            this.heroes = [
                { id: 'fer', title: 'Fer', defaultName: 'Fer', sprite: 'Fer.png', color: '#ff6b35', description: '' },
                { id: 'ander', title: 'Ander', defaultName: 'Ander', sprite: 'Ander.png', color: '#38bdf8', description: '' }
            ];
            this.game.heroes = this.heroes;
        }
        this.renderers = this.heroes.map(h => new LPCRenderer({ src: `assets/characters/${h.sprite}`, scale: 3 }));
        this.renderHeroes();
    }

    // ------------------------------------------------------------
    // Navegación entre vistas
    // ------------------------------------------------------------
    show(view) {
        this.view = view;
        this.root.querySelectorAll('.title-view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
        if (view === 'slots') this.renderSlots();
        if (view === 'hero') {
            this.renderHeroes();
            setTimeout(() => document.getElementById('trainerNameInput').focus(), 50);
        }
    }

    hide() {
        this.root.classList.add('closing');
        setTimeout(() => { this.root.style.display = 'none'; }, 450);
    }

    initEvents() {
        this.root.querySelectorAll('[data-go]').forEach(btn => {
            btn.addEventListener('click', () => {
                const go = btn.dataset.go;
                if (go === 'new' || go === 'load') {
                    this.slotMode = go;
                    this.confirm = null;
                    this.show('slots');
                } else {
                    this.show(go);
                }
            });
        });

        document.getElementById('btnContinue').addEventListener('click', () => {
            const latest = this.saves.latest();
            if (latest) this.loadSlot(latest.slot);
        });

        document.getElementById('titleFullscreenBtn').addEventListener('click', () => this.game.toggleFullscreen());

        const nameInput = document.getElementById('trainerNameInput');
        nameInput.addEventListener('input', () => { this.nameEdited = nameInput.value.trim() !== ''; });
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startNewGame(); });
        document.getElementById('startAdventureBtn').addEventListener('click', () => this.startNewGame());

        document.getElementById('importSaveInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!file || !this.importSlot) return;
            try {
                await this.saves.importFile(file, this.importSlot);
                this.flash(`📂 Partida importada en la ranura ${this.importSlot}.`);
            } catch (err) {
                this.flash(`⚠️ ${err.message || 'No se pudo importar el archivo.'}`);
            }
            this.importSlot = null;
            this.refresh();
            this.renderSlots();
        });

        // Teclado: flechas para elegir protagonista
        window.addEventListener('keydown', (e) => {
            if (this.root.style.display === 'none' || this.view !== 'hero') return;
            if (e.target && e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.selectHero(this.heroIndex === 0 ? 1 : 0);
        });
    }

    flash(msg) {
        const el = document.getElementById('titleToast');
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.classList.remove('visible'), 3000);
    }

    // ------------------------------------------------------------
    // Menú principal
    // ------------------------------------------------------------
    refresh() {
        const latest = this.saves.latest();
        const btn = document.getElementById('btnContinue');
        btn.disabled = !latest;
        document.getElementById('continueInfo').textContent = latest ? this.summary(latest.data) : 'No hay partidas guardadas';
    }

    summary(d) {
        const p = d.player || {};
        const stones = (d.story && d.story.stones || []).length;
        const dinos = (d.cards && d.cards.collection || []).length;
        return `${p.name || '???'} · Nv. ${p.level || 1} · 💎 ${stones}/7 · 🦖 ${dinos} · ⏱ ${SaveManager.formatTime(d.playTime)}`;
    }

    // ------------------------------------------------------------
    // Ranuras
    // ------------------------------------------------------------
    renderSlots() {
        document.getElementById('slotsTitle').textContent = this.slotMode === 'new'
            ? '✦ Nueva partida · elige una ranura'
            : '💾 Cargar partida';
        const list = document.getElementById('slotList');
        list.innerHTML = '';

        for (const { slot, data } of this.saves.listSlots()) {
            const card = document.createElement('div');
            card.className = `slot-card ${data ? '' : 'empty'}`;
            const confirming = this.confirm && this.confirm.slot === slot;

            if (data) {
                const p = data.player || {};
                const story = data.story || {};
                const stones = story.stones || [];
                const team = (data.cards && data.cards.collection || []).filter(c => c.inTeam);
                const elements = this.game.dinoCatalog.elements || {};
                const stoneHtml = STONE_ORDER.map(el => {
                    const e = elements[el];
                    return `<span class="slot-stone ${stones.includes(el) ? 'on' : ''}" title="${e ? e.name : el}">${e ? e.icon : '◆'}</span>`;
                }).join('');
                const teamHtml = team.map(c => {
                    const dino = this.game.cards.getDino(c.id);
                    const src = dino && (dino.card || dino.image);
                    return `<span class="slot-dino" style="${src ? `background-image:url('assets/dinos/${encodeURI(src)}')` : ''}" title="${dino ? dino.name : c.id} Nv. ${c.level}"><b>${c.level}</b></span>`;
                }).join('');
                card.innerHTML = `
                    <div class="slot-num">${slot}</div>
                    <div class="slot-body">
                        <div class="slot-head"><strong>${escapeHtml(p.name || '???')}</strong><span>Nv. ${p.level || 1} · ⏱ ${SaveManager.formatTime(data.playTime)}</span></div>
                        <div class="slot-chapter">${escapeHtml(this.chapterTitle(data))}</div>
                        <div class="slot-row"><div class="slot-stones">${stoneHtml}</div><div class="slot-team">${teamHtml}</div></div>
                        <small class="slot-date">Guardada: ${SaveManager.formatDate(data.savedAt)}</small>
                    </div>`;
            } else {
                card.innerHTML = `
                    <div class="slot-num">${slot}</div>
                    <div class="slot-body"><div class="slot-head"><strong>Ranura vacía</strong></div>
                    <div class="slot-chapter">${this.slotMode === 'new' ? 'Empieza aquí una nueva aventura.' : 'No hay partida guardada.'}</div></div>`;
            }

            const actions = document.createElement('div');
            actions.className = 'slot-actions';
            const addBtn = (label, cls, onClick, disabled = false) => {
                const b = document.createElement('button');
                b.className = `title-btn small ${cls}`;
                b.textContent = label;
                b.disabled = disabled;
                b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
                actions.appendChild(b);
                return b;
            };

            if (confirming) {
                const what = this.confirm.action === 'delete' ? '¿Borrar esta partida?' : '¿Sobrescribir esta partida?';
                actions.innerHTML = `<span class="slot-confirm">${what}</span>`;
                addBtn('Sí', 'danger', () => {
                    const action = this.confirm.action;
                    this.confirm = null;
                    if (action === 'delete') {
                        this.saves.remove(slot);
                        this.refresh();
                        this.renderSlots();
                    } else if (action === 'import') {
                        this.pickImport(slot);
                    } else {
                        this.chooseSlotForNew(slot);
                    }
                });
                addBtn('No', 'ghost', () => { this.confirm = null; this.renderSlots(); });
            } else if (this.slotMode === 'new') {
                addBtn(data ? '✦ Empezar aquí' : '✦ Empezar', 'primary', () => {
                    if (data) { this.confirm = { slot, action: 'overwrite' }; this.renderSlots(); }
                    else this.chooseSlotForNew(slot);
                });
            } else {
                addBtn('▶ Cargar', 'primary', () => this.loadSlot(slot), !data);
                addBtn('📤', 'ghost', () => this.saves.exportSlot(slot), !data).title = 'Exportar a archivo';
                addBtn('📂', 'ghost', () => {
                    if (data) { this.confirm = { slot, action: 'import' }; this.renderSlots(); }
                    else this.pickImport(slot);
                }).title = 'Importar desde archivo';
                addBtn('🗑', 'danger', () => { this.confirm = { slot, action: 'delete' }; this.renderSlots(); }, !data).title = 'Borrar';
            }
            card.appendChild(actions);
            if (data && this.slotMode === 'load' && !confirming) card.addEventListener('click', () => this.loadSlot(slot));
            list.appendChild(card);
        }
    }

    chapterTitle(data) {
        const ch = this.game.story.chapterFor(StorySystem.contextFromSave(data));
        return ch ? ch.title : '';
    }

    pickImport(slot) {
        this.importSlot = slot;
        document.getElementById('importSaveInput').click();
    }

    chooseSlotForNew(slot) {
        this.targetSlot = slot;
        this.show('hero');
    }

    loadSlot(slot) {
        const data = this.saves.read(slot);
        if (!data) return;
        this.hide();
        this.game.loadGame(slot, data);
    }

    // ------------------------------------------------------------
    // Protagonista
    // ------------------------------------------------------------
    renderHeroes() {
        const grid = document.getElementById('heroGrid');
        if (!grid || this.heroes.length === 0) return;
        grid.innerHTML = '';
        this.heroes.forEach((h, i) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = `hero-card ${i === this.heroIndex ? 'selected' : ''}`;
            card.style.setProperty('--hero', h.color || '#ffbe0b');
            card.innerHTML = `
                <span class="hero-tag">${escapeHtml(h.title)}</span>
                <div class="hero-stage"><canvas width="200" height="210" data-hero="${i}"></canvas></div>
                <strong class="hero-name">${escapeHtml(h.defaultName)}</strong>
                <p class="hero-desc">${escapeHtml(h.description || '')}</p>`;
            card.addEventListener('click', () => this.selectHero(i));
            grid.appendChild(card);
        });
        const input = document.getElementById('trainerNameInput');
        if (!this.nameEdited) input.value = this.heroes[this.heroIndex].defaultName;
        const other = this.heroes[1 - this.heroIndex];
        document.getElementById('rivalHint').textContent = other ? `Tu hermano ${other.defaultName} será tu rival.` : '';
    }

    selectHero(i) {
        this.heroIndex = i;
        this.renderHeroes();
    }

    startNewGame() {
        if (!this.targetSlot || this.heroes.length === 0) return;
        const hero = this.heroes[this.heroIndex];
        const rival = this.heroes[1 - this.heroIndex] || hero;
        const name = document.getElementById('trainerNameInput').value.trim() || hero.defaultName;
        this.hide();
        this.game.startNewGame({
            slot: this.targetSlot,
            name,
            protagonist: hero,
            rival: { name: rival.defaultName, sprite: rival.sprite }
        });
    }

    startPreviewLoop() {
        const dirs = ['down', 'left', 'up', 'right'];
        const loop = () => {
            if (this.root.style.display === 'none') return;
            this.animTimer++;
            if (this.view === 'hero') {
                document.querySelectorAll('#heroGrid canvas').forEach(cv => {
                    const i = Number(cv.dataset.hero);
                    const r = this.renderers[i];
                    if (!r) return;
                    const ctx = cv.getContext('2d');
                    ctx.imageSmoothingEnabled = false;
                    ctx.clearRect(0, 0, cv.width, cv.height);
                    const selected = i === this.heroIndex;
                    r.draw(ctx, {
                        x: cv.width / 2,
                        y: cv.height - 20,
                        direction: selected ? dirs[Math.floor(this.animTimer / 90) % 4] : 'down',
                        animState: selected ? 'walk' : 'idle',
                        animTimer: this.animTimer
                    });
                });
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
