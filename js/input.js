/**
 * InputHandler - Administra las entradas del teclado para Player 1 y Player 2
 * en el mapa estilo Pokémon (Caminar, Correr, Interactuar/Desafiar).
 */

class InputHandler {
    constructor() {
        this.keys = {};
        this.p2IsBot = true; // Por defecto activado como NPC/Rival errante para que Martín explore inmediatamente
        this.botTimer = 0;
        this.botDir = { dx: 0, dy: 0 };

        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.key.toLowerCase()] = true;
            this.keys[e.code] = true;

            if (e.key === 'Enter') {
                if (this.onEnterPress) this.onEnterPress();
            }
            if (e.key === 'Escape') {
                if (this.onEscapePress) this.onEscapePress();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.keys[e.code] = false;
        });
    }

    isPressed(code) {
        return !!this.keys[code.toLowerCase()] || !!this.keys[code];
    }

    getP1Input() {
        let dx = 0;
        let dy = 0;
        if (this.isPressed('KeyW') || this.isPressed('w')) dy -= 1;
        if (this.isPressed('KeyS') || this.isPressed('s')) dy += 1;
        if (this.isPressed('KeyA') || this.isPressed('a')) dx -= 1;
        if (this.isPressed('KeyD') || this.isPressed('d')) dx += 1;

        return {
            dx,
            dy,
            run: this.isPressed('ShiftLeft') || this.isPressed('Shift') || this.isPressed('KeyK'),
            attack: this.isPressed('KeyJ') || this.isPressed('Space'),
            interact: this.isPressed('KeyE') || this.isPressed('Space')
        };
    }

    getP2Input(p2, p1) {
        if (this.p2IsBot && p2 && p1) {
            return this.getWanderingBotInput(p2, p1);
        }

        let dx = 0;
        let dy = 0;
        if (this.isPressed('ArrowUp')) dy -= 1;
        if (this.isPressed('ArrowDown')) dy += 1;
        if (this.isPressed('ArrowLeft')) dx -= 1;
        if (this.isPressed('ArrowRight')) dx += 1;

        return {
            dx,
            dy,
            run: this.isPressed('ShiftRight') || this.isPressed('Numpad2'),
            attack: this.isPressed('Numpad1') || this.isPressed('KeyO') || this.isPressed('Enter'),
            interact: this.isPressed('Enter')
        };
    }

    getWanderingBotInput(bot, target) {
        this.botTimer--;
        const dist = Math.hypot(target.x - bot.x, target.y - bot.y);

        // Si el jugador está muy cerca, detenerse y mirar al jugador (estilo entrenador Pokémon)
        if (dist < 85) {
            const dx = Math.sign(target.x - bot.x);
            const dy = Math.sign(target.y - bot.y);
            return { dx: 0, dy: 0, run: false, attack: false, interact: true, faceX: dx, faceY: dy };
        }

        // Cambio de dirección de patrulla errante cada 60-120 frames
        if (this.botTimer <= 0) {
            this.botTimer = 60 + Math.floor(Math.random() * 80);
            const choices = [
                { dx: 0, dy: 0 },
                { dx: 1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: -1 }
            ];
            this.botDir = choices[Math.floor(Math.random() * choices.length)];
        }

        return {
            dx: this.botDir.dx,
            dy: this.botDir.dy,
            run: false,
            attack: false,
            interact: false
        };
    }
}
