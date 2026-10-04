#!/usr/bin/env bash
# ============================================================
# 🦖 Dino King - Script de Despliegue a GCP (VM e2-micro gratis)
# ============================================================
# Uso: bash deploy.sh
#
# Este script:
# 1. Crea un proyecto GCP "dino-king" (si no existe)
# 2. Crea una VM e2-micro gratuita
# 3. Abre los puertos 8000 (HTTP) y 8001 (WebSocket) en el firewall
# 4. Sube el código del juego a la VM
# 5. Instala dependencias y ejecuta el servidor
# ============================================================

set -e

PROJECT_ID="dino-king-server"
ZONE="us-central1-a"
VM_NAME="dino-king-vm"
MACHINE_TYPE="e2-micro"

echo "=================================================="
echo "  🦖 DINO KING - Despliegue a Google Cloud"
echo "=================================================="

# -------------------------------------------------------
# 1. Crear proyecto (si no existe)
# -------------------------------------------------------
echo ""
echo "📦 Paso 1: Verificando proyecto GCP..."
if ! gcloud projects describe "$PROJECT_ID" &>/dev/null; then
    echo "  Creando proyecto '$PROJECT_ID'..."
    gcloud projects create "$PROJECT_ID" --name="Dino King Server"
    echo "  ✅ Proyecto creado."
else
    echo "  ✅ Proyecto '$PROJECT_ID' ya existe."
fi
gcloud config set project "$PROJECT_ID"

# -------------------------------------------------------
# 2. Habilitar Compute Engine API
# -------------------------------------------------------
echo ""
echo "🔧 Paso 2: Habilitando API de Compute Engine..."
gcloud services enable compute.googleapis.com --quiet
echo "  ✅ API habilitada."

# -------------------------------------------------------
# 3. Crear reglas de firewall
# -------------------------------------------------------
echo ""
echo "🔥 Paso 3: Configurando firewall..."
if ! gcloud compute firewall-rules describe allow-dino-king --project="$PROJECT_ID" &>/dev/null; then
    gcloud compute firewall-rules create allow-dino-king \
        --project="$PROJECT_ID" \
        --allow=tcp:8000,tcp:8001 \
        --source-ranges=0.0.0.0/0 \
        --description="Puertos del juego Dino King (HTTP + WebSocket)" \
        --target-tags=dino-king
    echo "  ✅ Regla de firewall creada (puertos 8000, 8001)."
else
    echo "  ✅ Regla de firewall ya existe."
fi

# -------------------------------------------------------
# 4. Crear la VM (si no existe)
# -------------------------------------------------------
echo ""
echo "🖥️  Paso 4: Creando máquina virtual..."
if ! gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" &>/dev/null; then
    gcloud compute instances create "$VM_NAME" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --image-family=debian-12 \
        --image-project=debian-cloud \
        --boot-disk-size=10GB \
        --tags=dino-king \
        --metadata=startup-script='#!/bin/bash
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git
'
    echo "  ✅ VM creada. Esperando a que arranque..."
    sleep 30
else
    echo "  ✅ VM '$VM_NAME' ya existe."
    # Asegurarse de que esté encendida
    gcloud compute instances start "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" 2>/dev/null || true
    sleep 5
fi

# Obtener IP externa
EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
    --zone="$ZONE" \
    --project="$PROJECT_ID" \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "  🌐 IP externa: $EXTERNAL_IP"

# -------------------------------------------------------
# 5. Subir código a la VM
# -------------------------------------------------------
echo ""
echo "📤 Paso 5: Subiendo código del juego..."

# Crear un tar excluyendo archivos innecesarios
tar czf /tmp/dino_king.tar.gz \
    --exclude='.git' \
    --exclude='.venv' \
    --exclude='__pycache__' \
    --exclude='descargas' \
    --exclude='saves' \
    --exclude='.gitignore' \
    --exclude='*.pyc' \
    -C "$(dirname "$0")" .

gcloud compute scp /tmp/dino_king.tar.gz "$VM_NAME:~/" \
    --zone="$ZONE" \
    --project="$PROJECT_ID"

# Descomprimir y configurar en la VM
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="
    mkdir -p ~/dino_king
    tar xzf ~/dino_king.tar.gz -C ~/dino_king
    cd ~/dino_king
    python3 -m venv .venv
    .venv/bin/pip install -q -r requirements.txt
    echo '✅ Dependencias instaladas.'
"
echo "  ✅ Código subido y configurado."

# -------------------------------------------------------
# 6. Iniciar el servidor
# -------------------------------------------------------
echo ""
echo "🚀 Paso 6: Iniciando servidor del juego..."
gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="
    # Detener instancia anterior si existe
    pkill -f 'python3.*server.py' 2>/dev/null || true
    sleep 1
    # Ejecutar en background
    cd ~/dino_king
    nohup .venv/bin/python3 server.py --no-browser > server.log 2>&1 &
    sleep 2
    echo '✅ Servidor iniciado.'
"

# -------------------------------------------------------
# 7. ¡Listo!
# -------------------------------------------------------
echo ""
echo "=================================================="
echo "  🎮 ¡DINO KING ESTÁ EN LÍNEA!"
echo "=================================================="
echo ""
echo "  🌐 Jugar: http://$EXTERNAL_IP:8000"
echo "  ⚡ WebSocket: ws://$EXTERNAL_IP:8001"
echo ""
echo "  📋 Comandos útiles:"
echo "    Apagar VM:   gcloud compute instances stop $VM_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "    Encender VM:  gcloud compute instances start $VM_NAME --zone=$ZONE --project=$PROJECT_ID"
echo "    Ver logs:     gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --command='tail -f ~/dino_king/server.log'"
echo ""
echo "  💡 Comparte el enlace http://$EXTERNAL_IP:8000 con tu hermano. ¡A jugar!"
echo "=================================================="
