import * as ec2 from '@aws-cdk/aws-ec2';
import { Vpc } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SubnetCIDRAdviser = require('subnet-cidr-calculator');

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string,
  };
}

interface MyStackOutput {
  output: object,
}

const cidrList: string[] = [];
let cidrLoopCount = 0;

interface TierCSV {
  tier: string,
  prefix: string,
  tgwAttached: boolean,
}

async function readTierInfo() {
  const results: TierCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/VPC/tier.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const tier: TierCSV = {
        tier: row.TierName,
        prefix: row.SubnetPrefix,
        tgwAttached: row.TgwAttached === 'true',
      };
      results.push(tier);
    });
    file.on('end', () => {
      // console.log(results)
      resolve(results);
    });
  });

  return results;
}

async function addCIDR(vpc: Vpc) {
  for (const r of vpc.isolatedSubnets) {
    cidrList.push(r.ipv4CidrBlock);
    // console.log(vpc.isolatedSubnets[i].ipv4CidrBlock);
  }
  // console.log(cidrList);
  return cidrList;
}

// async function getVPCrange(vpcCidr) {
//   const one = vpcCidr.split('.')[0];
//   const two = vpcCidr.split('.')[1];

//   const cidrArr = SubnetCIDRAdviser.calculate(`${one}.${two}.0.0`, '16', '');

//   const result = [];

//   for (const cidr of cidrArr) {
//     result.push(cidr.value);
//     console.log(cidr.value);
//   }
//   return result;
// }

async function nextCidr(vpcCidr: string, size: string) {
  const vpcNetworkAddr = vpcCidr.split('/')[0];
  const ip = vpcNetworkAddr.split('.');
  let newVpcNetworkAddr: string = vpcNetworkAddr;
  if (cidrList.length >= 16) {
    if (cidrList.length % 16 === 0) {
      cidrLoopCount += 1;
    }
    // eslint-disable-next-line max-len
    newVpcNetworkAddr = `${ip[0]}.${ip[1]}.${String(Number(ip[2]) + cidrLoopCount)}.${ip[3]}`;
  }

  const probabalSubnets = SubnetCIDRAdviser.calculate(newVpcNetworkAddr, size, cidrList);
  const getNextValidCIDR = SubnetCIDRAdviser.getNextValidCIDR(vpcCidr, cidrList, probabalSubnets, '');

  cidrList.push(getNextValidCIDR.newCIDR);
  // console.log(getNextValidCIDR['newCIDR']);

  return getNextValidCIDR.newCIDR;
}

export async function CreateVpcStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  if (!process.env.STACK_NAME || !process.env.VPC_NAME) throw new Error('Invalid STACK_NAME or VPC_NAME');

  const vpcCidr = String(process.env.NETWORK_ADDRESS);
  const maxAZ = Number(process.env.MAX_AZ);
  const stack = new cdk.Stack(scope, id, props);
  const stackName = process.env.STACK_NAME;
  const vpcName = process.env.VPC_NAME;
  const tierInfos = await readTierInfo();

  // const subnetConfig = [
  //   {
  //     cidrMask: 28,
  //     name: 'RDS',
  //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  //   },
  // ];

  // for (const tierInfo of tierInfos) {
  //   subnetConfig.push({
  //     cidrMask: Number(tierInfo.prefix),
  //     name: String(tierInfo.tier),
  //     subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
  //     // reserved: false,
  //   });
  // }

  const vpc = new ec2.Vpc(stack, stackName, {
    // @ts-ignore: vpcName is not implemented in the module
    vpcName,
    maxAzs: maxAZ,
    cidr: vpcCidr,
    natGateways: 0,
    natGatewaySubnets: { subnets: [] },
    subnetConfiguration: [],
  });

  for (const az of cdk.Stack.of(stack).availabilityZones) {
    const rdsSubnet = new ec2.PrivateSubnet(stack, `RDS-subnet-${az}`, {
      availabilityZone: az,
      vpcId: vpc.vpcId,
      cidrBlock: await nextCidr(vpcCidr, '28'),
    });
    new cdk.CfnOutput(stack, `RDS-default-subnetId-${az}`, {
      value: rdsSubnet.subnetId.toString(),
      description: `Export ${az} RDS default subnet ID`,
      exportName: `${vpcName}-RDS-default-${az}-subnetId`,
    });
  }
  //   new cdk.CfnOutput(stack, `RDSSubnet${r}Output`, {
  //     value: rdsSubnet.subnetId,
  //     description: 'Main Stack VPC ID',
  //     exportName: `${vpcName}-RDS-Subnet1${r}SubnetId`,
  //   });
  // }
  // const rdsSubneta = new ec2.PrivateSubnet(stack, `RDSSubnet1a`, {
  //   availabilityZone: `ap-southeast-1a`,
  //   vpcId: vpc.vpcId,
  //   cidrBlock: await nextCidr('28')
  // });

  // new cdk.CfnOutput(stack, `RDSSubnetaOutputa`, {
  //   value: rdsSubneta.subnetId,
  //   description: 'Main Stack VPC ID',
  //   exportName: `${vpcName}-RDS-Subnet1aSubnetId`,
  // });

  // const rdsSubnetb = new ec2.PrivateSubnet(stack, `RDSSubnet1b`, {
  //   availabilityZone: `ap-southeast-1b`,
  //   vpcId: vpc.vpcId,
  //   cidrBlock: await nextCidr('28')
  // });

  // new cdk.CfnOutput(stack, `RDSSubnetaOutputb`, {
  //   value: rdsSubnetb.subnetId,
  //   description: 'Main Stack VPC ID',
  //   exportName: `${vpcName}-RDS-Subnet1bSubnetId`,
  // });

  // const rdsSubnetc = new ec2.PrivateSubnet(stack, `RDSSubnet1c`, {
  //   availabilityZone: `ap-southeast-1c`,
  //   vpcId: vpc.vpcId,
  //   cidrBlock: await nextCidr('28')
  // });

  // new cdk.CfnOutput(stack, `RDSSubnetcOutputc`, {
  //   value: rdsSubnetc.subnetId,
  //   description: 'Main Stack VPC ID',
  //   exportName: `${vpcName}-RDS-Subnet1cSubnetId`,
  // });
  // const dbSubnets = vpc.isolatedSubnets;

  const addCidrList = await addCIDR(vpc);
  // console.log(addCidrList);

  const dhcpOptionSet = new ec2.CfnDHCPOptions(stack, 'dhcpOptionSet', {
    domainName: '',
    domainNameServers: ['AmazonProvidedDNS'],
    // ntpServers: []
  });

  const dhcpOptionAssociation = new ec2.CfnVPCDHCPOptionsAssociation(stack, 'dhcpOptionsAssociation', {
    dhcpOptionsId: dhcpOptionSet.ref,
    vpcId: vpc.vpcId,
  });

  // const tierSubnets = [];
  for (const info of tierInfos) {
    const skipSubnetCIDR = await nextCidr(vpcCidr, '28');
    // const subnets:{ [key:string]:ISubnet } = {};
    for (const az of cdk.Stack.of(stack).availabilityZones) {
      const subnet = new ec2.PrivateSubnet(stack, `${info.tier}-subnet-${az}`, {
        availabilityZone: az,
        vpcId: vpc.vpcId,
        cidrBlock: await nextCidr(vpcCidr, '28'),
      });

      new cdk.CfnOutput(stack, `${info.tier}-subnetId-${az}`, {
        value: subnet.subnetId.toString(),
        description: `Export ${az} subnet ID`,
        exportName: `${vpcName}-${info.tier}-${az}-subnetId`,
      });
    }
  }

  console.log(cidrList);
  console.log(vpc.vpcId);

  new cdk.CfnOutput(stack, 'mainVPCID', {
    value: vpc.vpcId,
    description: 'Main Stack VPC ID',
    exportName: `${process.env.STACK_NAME}-VPCID`,
  });

  return {
    output: {},
  };
}
