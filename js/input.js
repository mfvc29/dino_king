/**
 * InputHandler - Teclado del jugador.
 * WASD / flechas: moverse · Shift: correr · Espacio / E: hablar y avanzar diálogos
 * M: mapa · Enter: menú · Esc: cerrar
 */

class InputHandler {
    constructor() {
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            // Ignorar atajos mientras se escribe en un campo de texto
            const tag = e.target && e.target.tagName;
            const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

            if (!typing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.code] = true;

            if (typing || e.repeat) return;
            if (e.key === 'Enter' && this.onEnterPress) this.onEnterPress();
            if (e.key === 'Escape' && this.onEscapePress) this.onEscapePress();
            if (e.code === 'KeyM' && this.onMapPress) this.onMapPress();
            if ((e.code === 'Space' || e.code === 'KeyE') && this.onInteractPress) this.onInteractPress();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Al perder el foco, soltar todas las teclas para no quedarse caminando
        window.addEventListener('blur', () => { this.keys = {}; });
    }

    isPressed(code) {
        return !!this.keys[code];
    }

    getMoveInput() {
        let dx = 0;
        let dy = 0;
        if (this.isPressed('KeyW') || this.isPressed('ArrowUp')) dy -= 1;
        if (this.isPressed('KeyS') || this.isPressed('ArrowDown')) dy += 1;
        if (this.isPressed('KeyA') || this.isPressed('ArrowLeft')) dx -= 1;
        if (this.isPressed('KeyD') || this.isPressed('ArrowRight')) dx += 1;
        return {
            dx,
            dy,
            run: this.isPressed('ShiftLeft') || this.isPressed('ShiftRight') || this.isPressed('KeyK')
        };
    }
}
