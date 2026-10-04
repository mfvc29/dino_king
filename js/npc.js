/**
 * NPC - Personajes fijos colocados desde el Advance Map Studio.
 * Tipos:
 *   - 'trainer': Entrenador. Si te ve en su línea de visión (estilo Pokémon) aparece el "!",
 *                camina hacia ti, habla y comienza un evento de combate.
 *   - 'npc':     Personaje normal. Solo habla al interactuar (Espacio / E).
 *   - 'tutor':   Maestro de ataques. Al hablarle permite cambiar los ataques de tus dinos.
 *
 * Formato en el JSON del mapa (campo "npcs"):
 * { id, x, y, name, sprite, direction, type, sightRange, dialog, defeatDialog, rewardExp,
 *   team: [{ species, name, element, image, card, level, attacks: [idAtaque x3] }] (máx. 3 dinos),
 *   moveCard: idCartaDeMovimiento | null }
 */

const NPC_DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
};

class NPC {
    constructor(data, tileSize, mapId) {
        this.data = data;
        this.mapId = mapId;
        this.id = data.id || `npc_${data.x}_${data.y}`;
        this.name = data.name || 'Entrenador';
        this.type = ['npc', 'tutor'].includes(data.type) ? data.type : 'trainer';
        this.sightRange = Number.isFinite(Number(data.sightRange)) ? Number(data.sightRange) : 4;
        this.dialog = data.dialog || '';
        this.defeatDialog = data.defeatDialog || '';
        this.team = Array.isArray(data.team) ? data.team : [];
        this.moveCard = data.moveCard || null; // carta de movimiento (id de ataque con moveCard)
        this.rewardExp = Number(data.rewardExp) || 0;

        this.tileSize = tileSize;
        this.col = Number(data.x);
        this.row = Number(data.y);
        this.x = this.col * tileSize + tileSize / 2;
        this.y = this.row * tileSize + tileSize / 2;
        this.direction = NPC_DIRS[data.direction] ? data.direction : 'down';
        this.state = 'idle';
        this.animTimer = 0;
        this.bubbleAlert = false;
        this.moveTarget = null; // { x, y } en píxeles

        this.renderer = new LPCRenderer({
            src: data.sprite ? `assets/characters/${data.sprite}` : null,
            fallbackColor: this.type === 'trainer' ? '#b5179e' : (this.type === 'tutor' ? '#2a9d8f' : '#6c757d'),
            accentColor: '#ffbe0b',
            name: this.name,
            scale: 1.8
        });
    }

    get isTrainer() {
        return this.type === 'trainer';
    }

    get isTutor() {
        return this.type === 'tutor';
    }

    get eventKey() {
        return `${this.mapId}:${this.id}`;
    }

    occupiesTile(col, row) {
        return this.col === col && this.row === row;
    }

    facePoint(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            this.direction = dx > 0 ? 'right' : 'left';
        } else {
            this.direction = dy > 0 ? 'down' : 'up';
        }
    }

    /**
     * ¿El jugador está en la línea de visión del entrenador?
     * Recorre losa por losa en la dirección que mira, deteniéndose en obstáculos.
     */
    canSee(playerCol, playerRow, tileMap) {
        if (!this.isTrainer || this.sightRange <= 0) return false;
        const d = NPC_DIRS[this.direction];
        for (let i = 1; i <= this.sightRange; i++) {
            const c = this.col + d.dx * i;
            const r = this.row + d.dy * i;
            if (c < 0 || r < 0 || c >= tileMap.cols || r >= tileMap.rows) return false;
            if (c === playerCol && r === playerRow) return true;
            if (tileMap.solidGrid[r] && tileMap.solidGrid[r][c]) return false;
        }
        return false;
    }

    /** Define la losa adyacente al jugador hacia donde caminará el entrenador. */
    walkTowardsPlayer(playerCol, playerRow) {
        const d = NPC_DIRS[this.direction];
        // Caminar en línea recta hasta quedar a 1 losa del jugador
        const steps = Math.max(0, Math.abs(playerCol - this.col) + Math.abs(playerRow - this.row) - 1);
        const targetCol = this.col + d.dx * steps;
        const targetRow = this.row + d.dy * steps;
        this.moveTarget = {
            col: targetCol,
            row: targetRow,
            x: targetCol * this.tileSize + this.tileSize / 2,
            y: targetRow * this.tileSize + this.tileSize / 2
        };
    }

    /** Avanza hacia moveTarget. Devuelve true cuando llegó. */
    updateMovement(speed = 2.6) {
        if (!this.moveTarget) {
            this.state = 'idle';
            return true;
        }
        const dx = this.moveTarget.x - this.x;
        const dy = this.moveTarget.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= speed) {
            this.x = this.moveTarget.x;
            this.y = this.moveTarget.y;
            this.col = this.moveTarget.col;
            this.row = this.moveTarget.row;
            this.moveTarget = null;
            this.state = 'idle';
            this.animTimer = 0;
            return true;
        }
        this.x += (dx / dist) * speed;
        this.y += (dy / dist) * speed;
        this.state = 'walk';
        this.animTimer += 1;
        return false;
    }

    draw(ctx) {
        this.renderer.draw(ctx, {
            x: this.x,
            y: this.y,
            direction: this.direction,
            animState: this.state,
            animTimer: Math.floor(this.animTimer)
        });

        // Icono flotante para encontrar al Maestro de ataques
        if (this.isTutor) {
            const bob = Math.sin(Date.now() / 300) * 3;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = '18px sans-serif';
            ctx.fillText('📚', this.x, this.y - 70 + bob);
            ctx.font = 'bold 10px sans-serif';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.fillStyle = '#5eead4';
            ctx.strokeText(this.name, this.x, this.y - 50);
            ctx.fillText(this.name, this.x, this.y - 50);
            ctx.restore();
        }

        if (this.bubbleAlert) {
            ctx.save();
            const bx = this.x;
            const by = this.y - 72;
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
    }
}
