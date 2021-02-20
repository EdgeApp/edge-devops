## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-sync-digitalocean.sh | bash

# Collect input
if [[ -z $COUCH_PASSWORD ]]; then
  read -s -p $'Enter CouchDB password: \n\r' COUCH_PASSWORD
  export COUCH_PASSWORD
fi
if [[ -z $COUCH_COOKIE ]]; then
  read -s -p $'Enter CouchDB master cookie: \n\r' COUCH_COOKIE
  export COUCH_COOKIE
fi

echo "Stopping CouchDB in case it's running"
sudo systemctl stop couchdb
sleep 4
set -e
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-couch-caddy-digitalocean.sh | bash
curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install.sh
