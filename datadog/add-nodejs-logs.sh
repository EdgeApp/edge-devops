## BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master; curl -o- $BURL/datadog/add-nodejs-logs.sh | bash

set -e

[ -z $NODEJS_SERVICE_NAME] && echo "Missing NODEJS_SERVICE_NAME" && exit 1
[ -z $NODEJS_SERVICE_LOG_PATH] && echo "Missing NODEJS_SERVICE_LOG_PATH" && exit 1

echo "datadog-agent: Adding /etc/datadog-agent/conf.d/nodejs.d/$NODEJS_SERVICE_NAME.yml"
sudo mkdir -p /etc/datadog-agent/conf.d/nodejs.d/
sudo cat <<EOF_CONF > /etc/datadog-agent/conf.d/nodejs.d/$NODEJS_SERVICE_NAME.yml
init_config:

instances:

##Log section
logs:

  - type: file
    path: "$NODEJS_SERVICE_LOG_PATH"
    service: "$NODEJS_SERVICE_NAME"
    source: nodejs
    sourcecategory: sourcecode
EOF_CONF

echo "restarting datadog-agent"
sudo systemctl restart datadog-agent