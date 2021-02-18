## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-sync-digitalocean.sh | bash

# Collect input
read -s -p $'Enter CouchDB password: ' COUCH_PASSWORD
export COUCH_PASSWORD

echo "Stopping CouchDB in case it's running"
sudo systemctl stop couchdb
sleep 4
set -e
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-couch-caddy-digitalocean.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install.sh
