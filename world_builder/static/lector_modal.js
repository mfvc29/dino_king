/**
 * Dino Lector como ventana flotante (modal) sobre el juego o la portada, en lugar de abrir otra página.
 * La página /dino_lector/ se carga en un iframe; su botón "Volver a la isla" (o Esc) avisa con postMessage y aquí se cierra.
 *   abrirDinoLector()            → abre el álbum
 *   abrirDinoLector('gigas')     → abre directamente la ficha de ese dino
 * Eventos en window: 'dino-lector-abierto' / 'dino-lector-cerrado' (el modo juego los usa para pausar el movimiento).
 */
(function () {
  'use strict';
  let modal = null, marco = null;

  function crear() {
    const css = document.createElement('style');
    css.textContent = `
      #modal-dino-lector { position: fixed; inset: 0; z-index: 500; display: none; align-items: center; justify-content: center;
        background: rgba(12, 74, 110, 0.45); backdrop-filter: blur(3px); }
      #modal-dino-lector.visible { display: flex; }
      #modal-dino-lector .marco { width: min(1480px, 96vw); height: 94vh; border-radius: 26px; overflow: hidden;
        border: 4px solid #7c2d12; box-shadow: 0 10px 0 #7c2d12, 0 30px 60px rgba(0, 0, 0, 0.45); background: #dff4ff;
        animation: lectorEntra 0.35s cubic-bezier(0.2, 1.4, 0.4, 1); }
      @keyframes lectorEntra { from { transform: scale(0.85) translateY(20px); opacity: 0; } }
      #modal-dino-lector iframe { width: 100%; height: 100%; border: 0; display: block; }`;
    document.head.appendChild(css);
    modal = document.createElement('div');
    modal.id = 'modal-dino-lector';
    modal.innerHTML = '<div class="marco"><iframe title="Dino Lector"></iframe></div>';
    marco = modal.querySelector('iframe');
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); }); // clic fuera = cerrar
    document.body.appendChild(modal);
  }

  function abrir(dinoId) {
    if (!modal) crear();
    marco.src = '/dino_lector/?modal=1' + (dinoId ? '&dino=' + encodeURIComponent(dinoId) : '');
    modal.classList.add('visible');
    setTimeout(() => { try { marco.focus(); } catch (e) {} }, 50);
    window.dispatchEvent(new CustomEvent('dino-lector-abierto'));
  }

  function cerrar() {
    if (!modal || !modal.classList.contains('visible')) return;
    modal.classList.remove('visible');
    marco.src = 'about:blank';
    window.focus();
    window.dispatchEvent(new CustomEvent('dino-lector-cerrado'));
  }

  window.addEventListener('message', (e) => {
    if (e.origin === location.origin && e.data === 'cerrar-dino-lector') cerrar();
  });

  window.abrirDinoLector = abrir;
  window.cerrarDinoLector = cerrar;
  window.dinoLectorAbierto = () => !!(modal && modal.classList.contains('visible'));
})();
