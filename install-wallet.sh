## BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master; curl -o- $BURL/install-wallet.sh | bash

echo "Running: $BURL/install-wallet.sh"

set -e
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/addusers.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/wallet/install.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/nagios/install.sh | sudo bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/install-aliases.sh | bash
