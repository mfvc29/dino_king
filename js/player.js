/**
 * Player - Entidad de personaje para Dino King
 * Soporta control local, clases y stats estilo Stardew Valley,
 * habilidades, niveles, misiones y multijugador en tiempo real.
 */

const PLAYER_CLASSES = {
    guerrero: {
        id: 'guerrero',
        name: 'Guerrero Jurásico',
        icon: '⚔️',
        desc: 'Especialista en combate cuerpo a cuerpo y resistencia física.',
        baseHp: 120,
        baseEnergy: 240,
        attack: 16,
        defense: 12,
        speedBonus: 0,
        favSkill: 'combat'
    },
    explorador: {
        id: 'explorador',
        name: 'Explorador Guardabosques',
        icon: '🏹',
        desc: 'Ágil y veloz, rastreador de zonas y recolector de hierbas.',
        baseHp: 95,
        baseEnergy: 280,
        attack: 12,
        defense: 8,
        speedBonus: 0.5,
        favSkill: 'foraging'
    },
    granjero: {
        id: 'granjero',
        name: 'Criador & Granjero',
        icon: '🌾',
        desc: 'Conexión con la tierra, gran energía de trabajo y vitalidad.',
        baseHp: 100,
        baseEnergy: 320,
        attack: 10,
        defense: 9,
        speedBonus: 0,
        favSkill: 'farming'
    },
    pescador: {
        id: 'pescador',
        name: 'Pescador del Lago',
        icon: '🎣',
        desc: 'Paciencia y destreza en cuerpos de agua, reflejos acuáticos.',
        baseHp: 100,
        baseEnergy: 260,
        attack: 11,
        defense: 10,
        speedBonus: 0.2,
        favSkill: 'fishing'
    },
    minero: {
        id: 'minero',
        name: 'Minero Fosilista',
        icon: '⛏️',
        desc: 'Fuerza bruta para picar rocas, desenterrar gemas y fósiles.',
        baseHp: 110,
        baseEnergy: 250,
        attack: 14,
        defense: 14,
        speedBonus: -0.2,
        favSkill: 'mining'
    }
};

class Player {
    constructor(id, name, x, y, options = {}) {
        this.id = id;
        this.name = name;
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.spriteFile = options.spriteFile || null;

        // ============================================================
        // SISTEMA DE CLASE Y STATS ESTILO STARDEW VALLEY
        // ============================================================
        this.playerClassKey = options.playerClass || 'guerrero';
        this.level = options.level || 1;
        this.exp = options.exp || 0;
        this.expNext = 100;

        const classInfo = PLAYER_CLASSES[this.playerClassKey] || PLAYER_CLASSES.guerrero;
        this.maxHp = classInfo.baseHp;
        this.hp = this.maxHp;
        this.maxEnergy = classInfo.baseEnergy;
        this.energy = this.maxEnergy;

        // 5 Habilidades Principales de Stardew Valley
        this.skills = {
            combat: { name: 'Combate', icon: '⚔️', level: 1, exp: 0, next: 60 },
            farming: { name: 'Agricultura', icon: '🌾', level: 1, exp: 0, next: 60 },
            mining: { name: 'Minería', icon: '⛏️', level: 1, exp: 0, next: 60 },
            foraging: { name: 'Recolección', icon: '🌲', level: 1, exp: 0, next: 60 },
            fishing: { name: 'Pesca', icon: '🎣', level: 1, exp: 0, next: 60 }
        };

        this.attack = classInfo.attack;
        this.defense = classInfo.defense;
        this.luck = 2;

        // Misiones de inicio para ganar EXP y subir de nivel
        this.missions = [
            { id: 'm_explore', title: 'Explorador de la Ruta 1', desc: 'Descubre las 6 zonas del mapa.', current: 1, target: 6, expReward: 100, done: false },
            { id: 'm_grass', title: 'Recolección en Hierba Alta', desc: 'Camina 20 pasos por la hierba silvestre.', current: 0, target: 20, expReward: 60, done: false },
            { id: 'm_lake', title: 'Aguas del Lago Espejo', desc: 'Visita los lotos y orillas del lago.', current: 0, target: 1, expReward: 50, done: false },
            { id: 'm_attack', title: 'Práctica de Ataque', desc: 'Realiza 10 ataques con [ESPACIO].', current: 0, target: 10, expReward: 70, done: false },
            { id: 'm_sanctuary', title: 'Inspección del Santuario', desc: 'Visita los corrales de dinosaurios.', current: 0, target: 1, expReward: 50, done: false }
        ];
        this.visitedZones = new Set();
        this.onExpGain = null; // Callback para notificaciones en HUD / Toast

        // Físicas y velocidades
        this.baseWalkSpeed = 3.2 + (classInfo.speedBonus || 0);
        this.baseRunSpeed = 5.4 + (classInfo.speedBonus || 0);
        this.walkSpeed = this.baseWalkSpeed;
        this.runSpeed = this.baseRunSpeed;
        this.currentSpeed = this.walkSpeed;
        this.isRunning = false;
        this.inTallGrass = false;

        this.direction = options.initialDirection || 'down';
        this.state = 'idle';
        this.animTimer = 0;
        this.dustParticles = [];
        this.bubbleAlert = false;
        this.tallGrassStepTimer = 0;

        // LPCRenderer con el sprite seleccionado
        this.renderer = new LPCRenderer({
            src: options.spriteUrl || null,
            fallbackColor: options.fallbackColor || '#2b78e4',
            accentColor: options.accentColor || '#00e5ff',
            name: this.name,
            scale: 1.8 // Escala perfecta para cuadrícula de 32px
        });
    }

    setPlayerClass(classKey) {
        if (PLAYER_CLASSES[classKey]) {
            this.playerClassKey = classKey;
            const info = PLAYER_CLASSES[classKey];
            this.maxHp = info.baseHp + (this.level - 1) * 12;
            this.maxEnergy = info.baseEnergy + (this.level - 1) * 20;
            this.attack = info.attack + (this.level - 1) * 3;
            this.defense = info.defense + (this.level - 1) * 2;
            this.baseWalkSpeed = 3.2 + (info.speedBonus || 0);
            this.baseRunSpeed = 5.4 + (info.speedBonus || 0);
            this.walkSpeed = this.baseWalkSpeed;
            this.runSpeed = this.baseRunSpeed;
            this.hp = Math.min(this.hp, this.maxHp);
            this.energy = Math.min(this.energy, this.maxEnergy);
        }
    }

    gainExp(amount, reason = '') {
        this.exp += amount;
        let leveledUp = false;

        while (this.exp >= this.expNext) {
            this.exp -= this.expNext;
            this.level++;
            this.expNext = Math.floor(this.expNext * 1.4);
            this.maxHp += 12;
            this.maxEnergy += 20;
            this.hp = this.maxHp;
            this.energy = this.maxEnergy;
            this.attack += 3;
            this.defense += 2;
            leveledUp = true;
        }

        if (this.onExpGain) {
            this.onExpGain({ amount, reason, leveledUp, level: this.level });
        }
        return { leveledUp, level: this.level };
    }

    gainSkillExp(skillKey, amount) {
        if (this.skills[skillKey]) {
            const sk = this.skills[skillKey];
            sk.exp += amount;
            if (sk.exp >= sk.next && sk.level < 10) {
                sk.exp -= sk.next;
                sk.level++;
                sk.next = Math.floor(sk.next * 1.5);
                this.gainExp(40, `¡Subiste ${sk.name} a Nivel ${sk.level}!`);
                return true;
            }
        }
        return false;
    }

    advanceMission(missionId, amount = 1) {
        const m = this.missions.find(ms => ms.id === missionId);
        if (m && !m.done) {
            m.current = Math.min(m.target, m.current + amount);
            if (m.current >= m.target) {
                m.done = true;
                this.gainExp(m.expReward, `Misión Cumplida: "${m.title}"`);
            }
        }
    }

    // Actualización para el jugador LOCAL controlado por teclado
    update(input, tileMap) {
        let { dx, dy, run, attack } = input;

        this.isRunning = !!run;
        this.currentSpeed = this.isRunning ? this.runSpeed : this.walkSpeed;

        // Actualizar partículas de polvo
        for (let i = this.dustParticles.length - 1; i >= 0; i--) {
            const p = this.dustParticles[i];
            p.y -= 0.5;
            p.life -= 0.08;
            if (p.life <= 0) this.dustParticles.splice(i, 1);
        }

        // Regeneración pasiva de energía (Stamina) al estar quieto o caminar
        if (!this.isRunning && this.energy < this.maxEnergy) {
            this.energy = Math.min(this.maxEnergy, this.energy + 0.06);
        }

        if (attack && this.state !== 'slash') {
            this.state = 'slash';
            this.animTimer = 0;
            // Consumo de energía al blandir arma / atacar
            if (this.energy >= 3) {
                this.energy -= 3;
            }
            // Entrenar combate estilo Stardew Valley
            this.gainSkillExp('combat', 6);
            this.advanceMission('m_attack', 1);
            return;
        }

        if (this.state === 'slash') {
            this.animTimer++;
            const anim = this.renderer.animations.slash;
            if (this.animTimer >= anim.frameCount * anim.speed) {
                this.state = 'idle';
                this.animTimer = 0;
            }
            return;
        }

        let moved = false;

        if (dx !== 0 || dy !== 0) {
            const norm = Math.hypot(dx, dy) || 1;
            const targetVx = (dx / norm) * this.currentSpeed;
            const targetVy = (dy / norm) * this.currentSpeed;

            // Deslizamiento suave en ejes separados
            let nextX = this.x + targetVx;
            let nextY = this.y + targetVy;

            const canMoveX = !tileMap.isSolid(nextX, this.y);
            const canMoveY = !tileMap.isSolid(this.x, nextY);

            if (canMoveX) {
                this.x = nextX;
                moved = true;
            }
            if (canMoveY) {
                this.y = nextY;
                moved = true;
            }

            // Sistema de rescate anti-atascos: si el jugador quedó solapado en un obstáculo, permitirle salir
            if (!moved && tileMap.isSolid(this.x, this.y)) {
                this.x = nextX;
                this.y = nextY;
                moved = true;
            }

            if (Math.abs(dx) > Math.abs(dy)) {
                this.direction = dx > 0 ? 'right' : 'left';
            } else {
                this.direction = dy > 0 ? 'down' : 'up';
            }

            this.state = 'walk';
            this.animTimer += this.isRunning ? 1.4 : 1.0;
            this.inTallGrass = tileMap.isTallGrass(this.x, this.y);

            if (this.inTallGrass) {
                this.tallGrassStepTimer++;
                if (this.tallGrassStepTimer % 20 === 0) {
                    this.gainSkillExp('foraging', 3);
                    this.advanceMission('m_grass', 1);
                }
            }

            if (this.isRunning && Math.random() < 0.25) {
                this.dustParticles.push({
                    x: this.x + (Math.random() * 6 - 3),
                    y: this.y + 2,
                    size: 3 + Math.random() * 2,
                    life: 1.0
                });
            }
        } else {
            this.state = 'idle';
            this.animTimer = 0;
        }

        return moved;
    }

    // Actualización para jugadores REMOTOS que vienen del servidor WebSocket
    updateRemote(data) {
        this.targetX = data.x;
        this.targetY = data.y;
        this.direction = data.direction || this.direction;
        this.state = data.state || this.state;
        this.isRunning = !!data.isRunning;

        // Suavizado de posición hacia la posición de la red
        this.x += (this.targetX - this.x) * 0.35;
        this.y += (this.targetY - this.y) * 0.35;

        if (this.state === 'walk') {
            this.animTimer += this.isRunning ? 1.4 : 1.0;
        } else {
            this.animTimer = 0;
        }
    }

    draw(ctx) {
        // Partículas de polvo
        this.dustParticles.forEach(p => {
            ctx.save();
            ctx.fillStyle = `rgba(212, 163, 115, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        // Personaje LPC
        this.renderer.draw(ctx, {
            x: this.x,
            y: this.y,
            direction: this.direction,
            animState: this.state,
            animTimer: Math.floor(this.animTimer),
            isHurt: false,
            invulnerableTimer: 0
        });

        // Efecto de hierba alta tapando los pies
        if (this.inTallGrass) {
            ctx.save();
            ctx.fillStyle = '#2d6a14';
            for (let i = -10; i <= 10; i += 5) {
                ctx.beginPath();
                ctx.moveTo(this.x + i, this.y + 4);
                ctx.lineTo(this.x + i + 2, this.y - 3);
                ctx.lineTo(this.x + i + 4, this.y + 4);
                ctx.fill();
            }
            ctx.restore();
        }

        // Globo de alerta '!'
        if (this.bubbleAlert) {
            ctx.save();
            const bx = this.x;
            const by = this.y - 56;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(bx - 9, by - 10, 18, 20, 5);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#e63946';
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', bx, by + 5);
            ctx.restore();
        }

        // Nombre del jugador en etiqueta
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(this.name, this.x, this.y - 42);
        ctx.fillText(this.name, this.x, this.y - 42);
        ctx.restore();
    }
}
