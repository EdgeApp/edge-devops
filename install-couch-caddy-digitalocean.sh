## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-couch-caddy-digitalocean.sh | bash

echo "Stopping CouchDB in case it's running"
sudo systemctl stop couchdb
sleep 4
set -e
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/install-digitalocean-datadrive.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/install-aliases.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/addusers.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/install-couch-caddy.sh | bash