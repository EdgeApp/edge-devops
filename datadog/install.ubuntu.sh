## BURL=https://raw.githubusercontent.com/EdgeApp/edge-devops/master; curl -o- $BURL/datadog/install.ubuntu.sh | bash

set -e

echo "Installing datadog-agent"
[ -z $DD_API_KEY ] && echo "Unabled to install datadog-agent. Missing DD_API_KEY" && exit 1
export DD_AGENT_MAJOR_VERSION=7 
export DD_SITE="datadoghq.com" 
bash -c "$(curl -L https://s3.amazonaws.com/dd-agent/scripts/install_script.sh)"


echo "datadog-agent: Setting 'logs_enabled: true' in datadog.yaml"
sed -i 's/# logs_enabled: false/logs_enabled: true/g' /etc/datadog-agent/datadog.yaml
