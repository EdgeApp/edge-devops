## BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master; curl -o- $BURL/edge-server/project.sh | bash

echo "Running: $BURL/edge-server/project.sh"

# Recommended to be run as edgy user

# Setting permissions
echo "Adding SSH key to ~/home/edgy/.ssh/github"
eval "$(ssh-agent)"
mkdir ~/.ssh
echo $GITKEY | \
sed -e "s/-----BEGIN OPENSSH PRIVATE KEY-----/&\n/"\
    -e "s/-----END OPENSSH PRIVATE KEY-----/\n&/"\
    -e "s/\S\{64\}/&\n/g"\
    > ~/.ssh/github

chmod 600 ~/.ssh/github # Setting correct perms to add key
ssh-keygen -y -f ~/.ssh/github > ~/.ssh/github.pub # Making pubkey for Github's identification of key
echo "Generated pub key: "
cat ~/.ssh/github.pub
echo "Adding github.com to known hosts"
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts
echo "Adding gitkey"
ssh-add ~/.ssh/github

# Clone
echo "Cloning $PROJECT_URL..."
mkdir ~/apps
cd ~/apps
git clone $PROJECT_URL

# Install
echo "Installing $PROJECT_URL..."
cd $(basename $PROJECT_URL .git)
yarn

# Start processes
echo "Starting $PROJECT_URL..."
pm2 start pm2.json

# Save PM2 state for reboot resurrection
pm2 save