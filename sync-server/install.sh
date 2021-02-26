## curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install.sh | bash

# Install NodeJS/NPM LTS
echo "Installing NodeJS/NPM..."
curl -fsSL https://deb.nodesource.com/setup_14.x | bash
apt-get install -y nodejs

# Install yarn
echo "Installing Yarn..."
npm i -g yarn

# Install PM2
echo "Installing PM2..."
npm i -g pm2

# Install ab-sync util
curl https://github.com/EdgeApp/airbitz-sync-server/raw/master/staging/ab-sync -o /usr/local/bin/ab-sync
chmod 755 /usr/local/bin/ab-sync

# Install edge-sync-server
echo "Provisioning sync server as edgy user..."
sudo -i -u edgy bash -c 'curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/sync-server/install-sync-server.sh | bash'

# Setup PM2 to resurrect on startup
echo "Setting up PM2 startup..."
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u edgy --hp /home/edgy