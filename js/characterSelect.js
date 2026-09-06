/**
 * CharacterSelect - Administrador de la pantalla de creación / selección de personaje
 * Carga dinámicamente los spritesheets generados en assets/characters/
 */

class CharacterSelect {
    constructor(onComplete) {
        this.onComplete = onComplete;
        this.charactersList = [];
        this.selectedSprite = null;
        this.customImageFile = null;
        this.previewDirection = 'down';
        this.previewTimer = 0;
        this.previewDirections = ['down', 'left', 'up', 'right'];
        this.dirIndex = 0;

        this.previewCanvas = document.getElementById('previewCanvas');
        if (this.previewCanvas) {
            this.previewCtx = this.previewCanvas.getContext('2d');
            this.previewCtx.imageSmoothingEnabled = false;
        }

        this.previewRenderer = new LPCRenderer({
            src: null,
            fallbackColor: '#2b78e4',
            accentColor: '#00e5ff',
            scale: 2.6
        });

        this.init();
    }

    async init() {
        // Cargar lista de personajes disponibles desde el backend
        try {
            const res = await fetch('/api/characters');
            if (res.ok) {
                this.charactersList = await res.json();
            }
        } catch (e) {
            console.warn('No se pudo obtener lista desde /api/characters, usando lista local');
        }

        // Si hay personajes en la carpeta, seleccionar el primero
        if (this.charactersList.length > 0) {
            this.selectedSprite = this.charactersList[0];
            this.previewRenderer.loadFromUrl(`assets/characters/${this.selectedSprite}`);
        }

        this.renderCards();
        this.initEvents();
        this.startPreviewLoop();
    }

    renderCards() {
        const container = document.getElementById('archetypeCards');
        if (!container) return;

        container.innerHTML = '';

        // Si hay personajes generados por Martín
        if (this.charactersList.length > 0) {
            this.charactersList.forEach((filename, idx) => {
                const card = document.createElement('div');
                card.className = `archetype-card ${idx === 0 ? 'selected' : ''}`;
                card.dataset.file = filename;
                
                // Nombre legible
                let displayName = filename.replace('.png', '').replace('character_', 'Guerrero #');
                if (filename === 'test_character.png') displayName = 'Entrenador Dino Alfa';
                if (filename === 'character_3.png') displayName = 'Cazador Jurásico #3';

                card.innerHTML = `
                    <div class="card-icon" style="background:#2ec4b6"></div>
                    <div class="card-info">
                        <h4>${displayName}</h4>
                        <p>Sprite LPC descargado (64x64)</p>
                    </div>
                `;

                card.addEventListener('click', () => {
                    document.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    this.selectedSprite = filename;
                    this.customImageFile = null;
                    this.previewRenderer.loadFromUrl(`assets/characters/${filename}`);
                });

                container.appendChild(card);
            });
        } else {
            // Fallback por defecto si no hay archivos
            const defaultCard = document.createElement('div');
            defaultCard.className = 'archetype-card selected';
            defaultCard.innerHTML = `
                <div class="card-icon" style="background:#2b78e4"></div>
                <div class="card-info">
                    <h4>Guerrero Rex</h4>
                    <p>Modelo procedural base</p>
                </div>
            `;
            container.appendChild(defaultCard);
        }
    }

    initEvents() {
        // Carga de archivo personalizado desde la máquina
        const upload = document.getElementById('customSpriteInput');
        if (upload) {
            upload.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.customImageFile = e.target.files[0];
                    this.selectedSprite = this.customImageFile.name;
                    this.previewRenderer.loadFromFile(this.customImageFile).then(() => {
                        document.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
                        const label = document.getElementById('customSpriteLabel');
                        if (label) label.textContent = `✓ Archivo cargado: ${this.customImageFile.name}`;
                    });
                }
            });
        }

        // Botón Entrar al Mundo
        const startBtn = document.getElementById('startAdventureBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const nameInput = document.getElementById('trainerNameInput');
                const trainerName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Martín';

                const screen = document.getElementById('characterSelectScreen');
                if (screen) screen.style.display = 'none';

                if (this.onComplete) {
                    this.onComplete({
                        name: trainerName,
                        sprite: this.selectedSprite || 'character_3.png',
                        renderer: this.previewRenderer
                    });
                }
            });
        }

        // Botón de pantalla completa
        const fsBtn = document.getElementById('fullscreenToggleBtn');
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

    startPreviewLoop() {
        const loop = () => {
            this.previewTimer++;

            if (this.previewTimer % 90 === 0) {
                this.dirIndex = (this.dirIndex + 1) % this.previewDirections.length;
                this.previewDirection = this.previewDirections[this.dirIndex];
            }

            if (this.previewCtx && this.previewCanvas) {
                this.previewCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
                this.previewRenderer.draw(this.previewCtx, {
                    x: this.previewCanvas.width / 2,
                    y: this.previewCanvas.height - 18,
                    direction: this.previewDirection,
                    animState: 'walk',
                    animTimer: this.previewTimer
                });
            }

            const screen = document.getElementById('characterSelectScreen');
            if (screen && screen.style.display !== 'none') {
                requestAnimationFrame(loop);
            }
        };
        requestAnimationFrame(loop);
    }
}
