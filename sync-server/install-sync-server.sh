## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install-sync-server.sh | bash

# Recommended to be run as edgy user

echo "Cloning edge-sync-server..."
mkdir ~/apps
cd ~/apps
git clone https://github.com/EdgeApp/edge-sync-server.git

echo "Installing edge-sync-server..."
cd edge-sync-server
yarn
# Run setup for configuration
yarn setup

echo "Starting edge-sync-server..."
pm2 start --name=edge-sync-server lib/index.js
# Save pm2 state for resurrection after reboot
pm2 save