#!/bin/bash

# Deployment script for Tailscale VPS
# Usage: ./deploy.sh [up|down|status|local-up|local-down|local-status]
# 
# Use 'local-*' commands to use local file backend instead of Pulumi Cloud

set -e

command=${1:-help}

# Determine which pulumi command to use
if [[ "$command" == local-* ]]; then
    PULUMI_CMD="./pulumilocal"
    command=${command#local-}
else
    PULUMI_CMD="pulumi"
fi

# Function to set up SSH key
setup_ssh_key() {
    if [ ! -f "key.pub" ]; then
        echo "Error: key.pub not found. Please generate an SSH key first:"
        echo "  ssh-keygen -f key"
        exit 1
    fi
    
    echo "Configuring SSH public key..."
    $PULUMI_CMD config set sshPublicKey "$(cat key.pub)"
}

# Function to set up Tailscale auth key
setup_tailscale_key() {
    # Check if parameter already exists
    if aws ssm get-parameter --name "TailscaleAuthKey" --region us-east-1 >/dev/null 2>&1; then
        echo "Tailscale auth key already configured in AWS Systems Manager"
        return 0
    fi
    
    echo ""
    echo "Tailscale auth key setup required:"
    echo "1. Go to: https://login.tailscale.com/admin/settings/keys"
    echo "2. Click 'Generate auth key'"
    echo "3. Enable 'Pre-approved' and optionally 'Reusable'"
    echo "4. Copy the generated key (starts with 'tskey-auth-')"
    echo ""
    
    while true; do
        read -p "Enter your Tailscale auth key: " auth_key
        if [[ "$auth_key" == tskey-auth-* ]]; then
            echo "Storing Tailscale auth key in AWS Systems Manager..."
            aws ssm put-parameter \
                --name "TailscaleAuthKey" \
                --value "$auth_key" \
                --type "String" \
                --region us-east-1
            echo "Tailscale auth key configured successfully"
            break
        else
            echo "Invalid auth key format. Please enter a key starting with 'tskey-auth-'"
        fi
    done
}

case $command in
    up)
        echo "Deploying Tailscale VPS..."
        if [[ "$PULUMI_CMD" == "./pulumilocal" ]]; then
            echo "Using local file backend"
        fi
        
        # Install dependencies if needed
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            bun install
        fi
        
        # Auto-setup SSH key and Tailscale auth key
        setup_ssh_key
        setup_tailscale_key
        
        $PULUMI_CMD up
        ;;
    down)
        echo "Destroying Tailscale VPS..."
        if [[ "$PULUMI_CMD" == "./pulumilocal" ]]; then
            echo "Using local file backend"
        fi
        $PULUMI_CMD destroy
        ;;
    status)
        echo "Getting stack status..."
        if [[ "$PULUMI_CMD" == "./pulumilocal" ]]; then
            echo "Using local file backend"
        fi
        $PULUMI_CMD stack output
        ;;
    help|*)
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  up           Deploy the Tailscale VPS (Pulumi Cloud)"
        echo "  down         Destroy the Tailscale VPS (Pulumi Cloud)"
        echo "  status       Show current stack outputs (Pulumi Cloud)"
        echo ""
        echo "Local Backend Commands (no Pulumi Cloud required):"
        echo "  local-up     Deploy the Tailscale VPS (local file backend)"
        echo "  local-down   Destroy the Tailscale VPS (local file backend)"
        echo "  local-status Show current stack outputs (local file backend)"
        echo ""
        echo -e "\033[1mBefore deploying, ensure you have:\033[0m"
        echo "1. Configured your AWS credentials"
        echo "2. Generated an SSH key: ssh-keygen -f key"
        echo ""
        echo "Note: Dependencies, SSH key, and Tailscale auth key will be configured automatically during deployment"
        echo "Note: Local backend stores state in ~/.pulumi-local/tailscale-vps/"
        echo ""
        echo -e "\033[1mIMPORTANT:\033[0m Backup your SSH keys (key and key.pub) to a secure location!"
        echo "Without the private key, you won't be able to access your VPS."
        ;;
esac