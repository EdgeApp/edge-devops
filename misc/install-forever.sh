set -e

## BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master; curl -o- $BURL/misc/install-forever.sh | bash

echo "Running: $BURL/misc/install-forever.sh"

sudo npm install -g forever
sudo npm install -g forever-service