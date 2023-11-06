# Tailscale VPS

Deploy a secure VPS on AWS with Tailscale pre-installed for secure remote access. This project creates an EC2 instance that automatically connects to your Tailscale network, allowing SSH access only through Tailscale (no public SSH access).

## Features

- 🔒 **Secure by default**: SSH access only through Tailscale network
- ⚡ **Automatic setup**: Tailscale installs and connects automatically on boot
- 🏗️ **Infrastructure as Code**: Uses Pulumi for reproducible deployments
- 💰 **Cost-effective**: Uses t3.small instance (modify as needed)
- 🔑 **Configurable SSH keys**: Specify your public key via configuration

## Prerequisites

1. **AWS CLI configured** with appropriate credentials (Tested with `2.27`).
2. **Pulumi CLI** installed ([installation guide](https://www.pulumi.com/docs/get-started/install/)). Tested with `v3.73.0`.
3. **Tailscale account** and pre-approved auth key
4. **SSH key pair** for server access

## Backend Options

This project supports two backend options for storing Pulumi state:

### Option 1: Pulumi Cloud (Default)
- Stores state in Pulumi Cloud (free tier available)
- Requires Pulumi account and login
- Easy collaboration and state sharing

### Option 2: Local File Backend (Self-hosted)
- Stores state locally in `~/.pulumi-local/tailscale-vps/`
- No external dependencies or accounts required
- State files stored on your local machine

## Quick Start

### 1. Generate SSH Key (if needed)

```bash
ssh-keygen -f key
```

**Important**: Backup both `key` and `key.pub` to a secure location (password manager, encrypted backup, etc.). Without the private key, you won't be able to access your VPS.

### 2. Set Up Tailscale Auth Key

1. **Generate auth key**: Go to https://login.tailscale.com/admin/settings/keys
2. **Enable "Pre-approved"** to automatically approve the device

Note: The auth key will be prompted for and stored automatically during deployment.

### 3. Deploy

**Using Pulumi Cloud:**
```bash
# Deploy the VPS
./deploy.sh up

# Or using bun
bun run deploy
```

**Using Local Backend:**
```bash
# Deploy the VPS with local state
./deploy.sh local-up

# Or using bun
bun run local-deploy
```

### 4. Connect via Tailscale

Once deployed, the VPS will automatically:
1. Connect to your Tailscale network with hostname `tailscale-vps`
2. Be accessible via SSH through Tailscale

Connect to your VPS:

```bash
# Find the Tailscale IP
tailscale status

# SSH via Tailscale (replace with actual Tailscale IP)
ssh -i key ec2-user@100.x.x.x
```

## Configuration

### Instance Settings

Modify `index.ts` to customize:

```typescript
const server = new aws.ec2.Instance("tailscale-vps", {
    instanceType: "t3.small",     // Change instance size
    // ... other settings
});
```

### Region and Availability Zone

```typescript
const zone = "us-east-1a";  // Change as needed
```

### Security Groups

The default security group only allows:
- **Outbound traffic** (all)

SSH (port 22) is **not open to the internet** - access is only through Tailscale.

## Available Commands

### Pulumi Cloud Backend (Default)
```bash
# Deploy the infrastructure
./deploy.sh up

# Destroy the infrastructure  
./deploy.sh down

# Show current status and outputs
./deploy.sh status

# Using bun scripts
bun run deploy   # same as ./deploy.sh up
bun run destroy  # same as ./deploy.sh down
bun run status   # same as ./deploy.sh status
```

### Local File Backend
```bash
# Deploy the infrastructure (local state)
./deploy.sh local-up

# Destroy the infrastructure (local state)
./deploy.sh local-down

# Show current status and outputs (local state)
./deploy.sh local-status

# Using bun scripts
bun run local-deploy   # same as ./deploy.sh local-up
bun run local-destroy  # same as ./deploy.sh local-down
bun run local-status   # same as ./deploy.sh local-status
```

### Direct pulumilocal Usage
```bash
# Use pulumilocal directly for any Pulumi command
./pulumilocal up
./pulumilocal destroy
./pulumilocal stack output
./pulumilocal config set sshPublicKey "ssh-rsa ..."
```

## Outputs

After deployment, you'll see:

- `instanceId`: EC2 instance ID
- `publicIp`: Public IP address (for AWS management)
- `privateIp`: Private IP address
- `tailscaleInfo`: Information about Tailscale access

## Documentation

- [Troubleshooting Guide](docs/troubleshooting.md)
- [Cost Estimation](docs/costs.md)

## Cleanup

To destroy all resources:

```bash
./deploy.sh down
```

This will remove:
- EC2 instance
- Security groups
- VPC and networking components
- Key pair

**Note**: The Tailscale auth key in Systems Manager Parameter Store is not automatically removed.

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is available under the MIT license.
