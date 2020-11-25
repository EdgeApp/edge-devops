## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/misc/install-couch-caddy.sh > /tmp/install-couch-caddy.sh && bash /tmp/install-couch-caddy.sh

echo 'What is the full DNS name of this machine?'
read dnsname
echo hello $dnsname

sudo apt-get install -y gnupg ca-certificates
echo "deb https://apache.bintray.com/couchdb-deb focal main" | sudo tee /etc/apt/sources.list.d/couchdb.list

sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 8756C4F765C9AC3CB6B85D62379CE192D401AB61

echo "deb [trusted=yes] https://apt.fury.io/caddy/ /" | sudo tee -a /etc/apt/sources.list.d/caddy-fury.list

sudo apt update -y
sudo apt install -y couchdb

sudo systemctl stop couchdb

if [ -d "/datadrive/couchdb" ] 
then
    echo "Directory /datadrive/couchdb already exists." 
else
    sudo mkdir -p /datadrive/couchdb
    sudo chown couchdb:couchdb /datadrive/couchdb
    sudo cp -a /var/lib/couchdb/* /datadrive/couchdb/
    sudo rm /opt/couchdb/data
    sudo ln -s  /datadrive/couchdb /opt/couchdb/data
    sudo chown couchdb:couchdb /opt/couchdb/data
fi

sudo systemctl restart couchdb

sudo apt install -y caddy

sudo echo "
# CouchDB:
$dnsname:6984 {
  reverse_proxy localhost:5984
}

# Main applications:
$dnsname {
  reverse_proxy localhost:8008
}
" > /etc/caddy/Caddyfile

sudo systemctl restart caddy
