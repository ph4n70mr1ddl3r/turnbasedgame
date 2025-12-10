#!/bin/bash
# Deployment script for Linux VPS
# Assumes the server binary and frontend static files are built

set -e

echo "Deploying turnbasedgame to Linux VPS..."

# Check for required files
if [ ! -f "server/build/poker_server" ]; then
    echo "Error: Server binary not found. Run scripts/build-all.sh first."
    exit 1
fi

if [ ! -d "client/out" ]; then
    echo "Error: Frontend static files not found. Run scripts/build-all.sh first."
    exit 1
fi

# Copy files to deployment directory (adjust path as needed)
DEPLOY_DIR="${1:-/opt/turnbasedgame}"
echo "Deploying to: $DEPLOY_DIR"

sudo mkdir -p "$DEPLOY_DIR"
sudo cp -r client/out "$DEPLOY_DIR/frontend"
sudo cp server/build/poker_server "$DEPLOY_DIR/"
sudo cp scripts/run.sh "$DEPLOY_DIR/"

# Create systemd service file
sudo tee /etc/systemd/system/turnbasedgame.service > /dev/null <<EOF
[Unit]
Description=Turnbasedgame Poker Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$DEPLOY_DIR
ExecStart=$DEPLOY_DIR/poker_server
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Deployment complete!"
echo "To start service: sudo systemctl daemon-reload && sudo systemctl start turnbasedgame"
echo "To enable auto-start: sudo systemctl enable turnbasedgame"