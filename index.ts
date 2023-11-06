import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const myVpc = new aws.ec2.Vpc("tailscale-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsSupport: true,
  enableDnsHostnames: true,
  tags: {
    Name: "Tailscale VPS VPC",
  },
});

const myInternetGateway = new aws.ec2.InternetGateway("tailscale-igw", {
  vpcId: myVpc.id,
  tags: {
    Name: "Tailscale VPS IGW",
  },
});

const zone = "us-east-1a";

const myPublicSubnet = new aws.ec2.Subnet("tailscale-subnet", {
  vpcId: myVpc.id,
  cidrBlock: "10.0.1.0/24",
  mapPublicIpOnLaunch: true,
  availabilityZone: zone,
  tags: {
    Name: "Tailscale VPS Subnet",
  },
});

const myIgRouteTable = new aws.ec2.RouteTable("tailscale-route-table", {
  vpcId: myVpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: myInternetGateway.id,
    },
  ],
  tags: {
    Name: "Tailscale VPS Route Table",
  },
});

const routeIgTableAssociation = new aws.ec2.RouteTableAssociation(
  "tailscale-rta",
  {
    subnetId: myPublicSubnet.id,
    routeTableId: myIgRouteTable.id,
  },
);

const securityGroup = new aws.ec2.SecurityGroup("tailscale-sg", {
  vpcId: myVpc.id,
  description: "Outbound only - SSH access through Tailscale",
  tags: {
    Name: "Tailscale VPS Security Group",
  },
});

const allOutbound = new aws.ec2.SecurityGroupRule("allOutbound", {
  type: "egress",
  fromPort: 0,
  toPort: 0,
  protocol: "-1", // -1 means all protocols
  cidrBlocks: ["0.0.0.0/0"],
  securityGroupId: securityGroup.id,
});

const config = new pulumi.Config();
const sshPublicKey = config.require("sshPublicKey");

const keyPair = new aws.ec2.KeyPair("tailscale-keypair", {
  publicKey: sshPublicKey,
  tags: {
    Name: "Tailscale VPS Key Pair",
  },
});

const role = new aws.iam.Role("tailscale-instance-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "ec2.amazonaws.com",
        },
      },
    ],
  }),
  tags: {
    Name: "Tailscale VPS Role",
  },
});

const policy = new aws.iam.Policy("tailscale-ssm-policy", {
  policy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: "ssm:GetParameter",
        Resource: "arn:aws:ssm:*:*:parameter/TailscaleAuthKey",
      },
    ],
  }),
  tags: {
    Name: "Tailscale SSM Access Policy",
  },
});

const rolePolicyAttachment = new aws.iam.RolePolicyAttachment(
  "tailscale-role-policy-attachment",
  {
    role: role.name,
    policyArn: policy.arn,
  },
);

const instanceProfile = new aws.iam.InstanceProfile(
  "tailscale-instance-profile",
  {
    role: role.name,
    tags: {
      Name: "Tailscale VPS Instance Profile",
    },
  },
);

const userData = `#!/bin/bash
set -e

# Set hostname
hostnamectl set-hostname tailscale-vps

# Update system and install packages
yum update -y
yum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm

# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Get Tailscale auth key from AWS Systems Manager
aws ssm get-parameter --name "TailscaleAuthKey" --with-decryption --query "Parameter.Value" --output text > /tmp/tailscale-auth-key

# Start Tailscale
systemctl enable --now tailscaled
tailscale up --authkey $(cat /tmp/tailscale-auth-key) --hostname=tailscale-vps

# Clean up
rm -f /tmp/tailscale-auth-key

echo "Tailscale VPS setup complete" > /var/log/setup-complete.log
`;

const size = 20;

const server = new aws.ec2.Instance("tailscale-vps", {
  availabilityZone: zone,
  instanceType: "t3.small",
  ami: "ami-0182f373e66f89c85", // Amazon Linux 2023, us-east-1
  userData: Buffer.from(userData).toString("base64"),
  keyName: keyPair.keyName,
  iamInstanceProfile: instanceProfile.name,
  vpcSecurityGroupIds: [securityGroup.id],
  subnetId: myPublicSubnet.id,
  associatePublicIpAddress: true,
  rootBlockDevice: {
    volumeSize: size,
    volumeType: "gp3",
    deleteOnTermination: true,
  },
  tags: {
    Name: "Tailscale VPS",
  },
});

export const instanceId = server.id;
export const publicIp = server.publicIp;
export const privateIp = server.privateIp;
export const tailscaleInfo =
  "Once the instance is running, it will automatically connect to your Tailscale network. SSH access is only available through Tailscale.";
