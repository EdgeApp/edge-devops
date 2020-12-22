## bash <(curl -o- https://raw.githubusercontent.com/EdgeApp/edge-devops/master/edge-sync/provisions.sh)

# Recommended to be run as non-root user

# Install NVM
echo "Instalign NVM..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
echo "
export NVM_DIR=\"\$HOME/.nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"  # This loads nvm
[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"  # This loads nvm bash_completion
" > ~/.usenvm
source ~/.usenvm

# Install NodeJS/NPM LTS (14)
echo "Installing NodeJS/NPM..."
nvm install --lts

# Install yarn
echo "Installing Yarn..."
npm i -g yarn

# Install PM2
echo "Installing PM2"
npm i -g pm2

# App Installation:
echo "Creating app directory, repo, and config"

appName="edge-sync-server"
baseDir=/apps/$appName
repoDir=$baseDir/repo
appDir=$baseDir/app
ecosystemFile=$baseDir/ecosystem.config.js

# Create app directory
mkdir $baseDir
# Repo
mkdir $repoDir
git init --bare $repoDir
# App
mkdir $appDir
# Ecosystem config
cat <<EOF > $ecosystemFile
module.exports = {
  apps : [{
    name: "$appName",
    script: "$appDir/lib/index.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
}
EOF

# Configure repo's githook 
cat <<EOF > $repoDir/hooks/post-receive
#!/bin/bash
source ~/.usenvm

cd $repoDir
GIT_WORK_TREE=$appDir git checkout -f master

cd $appDir	
yarn

cd $baseDir
pm2 startOrRestart $ecosystemFile
EOF
chmod 755 $repoDir/hooks/post-receive

# Initialize environement config 
dbNameDefault=sync_datastore
dbHostDefault=localhost
dbPortDefault=6984
appPortDefault=8008
maxPageSizeDefault=100
migrationOriginServerDefault="https://git1.edge.app/repos/"
migrationTmpDirDefault="/tmp/apps/edge-sync-server/"

read -p "Enter database name [$dbNameDefault]: " dbName
read -sp 'Enter database password: ' dbPassword
echo ''
read -p "Enter database host [$dbHostDefault]: " dbHost
read -p "Enter database port [$dbPortDefault]: " dbPort
read -p "Enter app server port [$appPortDefault]: " appPort
read -p "Enter app config maxPageSize [$maxPageSizeDefault]: " maxPageSize
read -p "Enter app config migrationOriginServer [$migrationOriginServerDefault]: " migrationOriginServer
read -p "Enter app config migrationTmpDir [$migrationTmpDirDefault]: " migrationTmpDir
# Defaults
dbName=${dbName:-$dbNameDefault}
dbHost=${dbHost:-$dbHostDefault}
dbPort=${dbPort:-$dbPortDefault}
appPort=${appPort:-$appPortDefault}
maxPageSize=${maxPageSize:-$maxPageSizeDefault}
migrationOriginServer=${migrationOriginServer:-$migrationOriginServerDefault}
migrationTmpDir=${migrationTmpDir:-$migrationTmpDirDefault}

cat <<EOF > $appDir/config.json
{
  "couchDatabase": "$dbName",
  "couchAdminPassword": "$dbPassword",
  "couchHost": "$dbHost",
  "couchPort": "$dbPort",
  "httpPort": $appPort,
  "maxPageSize": $maxPageSize,
  "migrationOriginServer": "$migrationOriginServer",
  "migrationTmpDir": "$migrationTmpDir"
}
EOF
