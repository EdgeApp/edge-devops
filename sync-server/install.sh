## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install.sh

curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/install-couch-caddy-digitalocean.sh | bash

echo "Creating app directories..."
mkdir /apps
chown edgy:edgy /apps
mkdir /tmp/apps
chown edgy:edgy /tmp/apps

echo "Provisioning sync server as edgy user..."
sudo -i -u edgy bash -c 'bash <(curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/provisions.sh)'