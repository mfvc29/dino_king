# Guía de Despliegue y Arquitectura - Dino King

Esta guía explica cómo está estructurado el juego en la nube y cómo guardar los cambios.

## 1. Firebase Hosting (Frontend Estático)
Firebase se encarga **exclusivamente** de servir los archivos estáticos del juego (HTML, CSS, imágenes, sprites y JavaScript del lado del cliente).
- El proyecto actual configurado en Firebase es `dino-king-game-mfvc29`.
- Se configuró el archivo `firebase.json` para ignorar los archivos que son del servidor (`.venv`, `server.py`, `saves/`, etc.).
- **Cómo subir cambios:** Cada vez que modifiques el diseño, el mapa o los diálogos, puedes subirlo corriendo el comando:
  `firebase deploy --only hosting`

## 2. GitHub y Render (Backend / Servidor Multijugador)
Dado que Firebase Hosting no puede ejecutar código Python (nuestro archivo `server.py` que maneja el modo multijugador por WebSockets), la parte del servidor deberá alojarse en un servicio como Render.
- **GitHub:** Se utiliza como puente y respaldo. Debes subir tus cambios (especialmente `server.py` y `requirements.txt`) a tu repositorio en GitHub.
- **Render:** Render se conectará a tu repositorio de GitHub, detectará el código Python y levantará el servidor automáticamente. Esto te dará una URL pública (por ejemplo, `wss://dino-king.onrender.com`) a la que el frontend alojado en Firebase se podrá conectar para el multijugador.

## 3. Base de Datos (Google Sheets / Apps Script)
El objetivo es reemplazar la carpeta local `saves/` por Google Sheets, de manera que el juego se comunique con un "Webhook" (una URL) cada vez que el jugador guarde la partida, y la información quede guardada en las celdas de Excel de Google.

### ¿Cómo obtener el Link (URL) en Google Apps Script?
Si ya pegaste el código de `Codigo.gs` pero no obtuviste un link, es porque falta **Implementar** (desplegar) el script como una aplicación web. Sigue estos pasos exactos:

1. Ve a la pestaña de tu proyecto de Apps Script donde pegaste el código.
2. En la esquina superior derecha, haz clic en el botón azul **Implementar** (Deploy) y luego selecciona **Nueva implementación** (New deployment).
3. En la ventana que aparece, haz clic en el ícono de engranaje (⚙️) al lado de "Seleccionar tipo" y elige **Aplicación web** (Web app).
4. Completa la configuración de esta manera:
   - **Descripción:** Ponle un nombre, por ejemplo, "API Guardado Dino King".
   - **Ejecutar como:** Selecciona **Yo** (tu correo electrónico).
   - **Quién tiene acceso:** *ESTO ES MUY IMPORTANTE*, debes seleccionar **Cualquier persona** (Anyone). Si no pones esto, el juego no podrá guardar los datos.
5. Haz clic en el botón **Implementar** en la parte inferior.
6. Es muy probable que te pida **Autorizar el acceso**. Sigue los pasos: elige tu cuenta de Google, si te sale una advertencia roja haz clic en "Avanzado" (Advanced) y luego en "Ir a [Nombre de tu script] (no seguro)". Luego dale a "Permitir".
7. Al finalizar, te aparecerá una ventana con un enlace largo bajo el título **URL de la aplicación web** (la URL termina en `/exec`). 

**¡Esa URL es la que necesitamos!**

Por favor, realiza esos pasos y envíame ese enlace por aquí para que yo pueda configurar el código del backend (`server.py`) y del frontend (`js/save.js`) para que apunten a esa dirección.
