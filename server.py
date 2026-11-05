# Arranca el juego publicado: el servidor de world_builder en modo público (sin editor ni guardado de escenas).
import os
import runpy

os.environ.setdefault('JUEGO_PUBLICO', '1')
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'world_builder', 'server.py'), run_name='__main__')
