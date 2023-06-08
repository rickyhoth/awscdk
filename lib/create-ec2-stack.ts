import * as ec2 from '@aws-cdk/aws-ec2';
import { ISubnet } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as ec2class from './provisioning/ec2';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const SubnetCIDRAdviser = require('subnet-cidr-calculator');

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string;
  };
}

interface MyStackOutput {
  output: object;
}

interface Ec2CSV {
  sgName: string,
  type: string,
  protocol: string,
  fromPort: string,
  toPort: string,
  cidr: string,
  desc: string,
}

interface TierCSV {
  tier: string,
  prefix: string,
  lbType: string,
  source: string,
  target: string,
}

const vpcCidr = String(process.env.NETWORK_ADDRESS);
const maxAZ = Number(process.env.MAX_AZ);
const cidrList: string[] = [];
// let cidrLoopCount = 0;

async function readCSV() {
  const results: Ec2CSV[] = [];
  const path: string = `${process?.env.ENVIRONMENT}`.toUpperCase() === 'PRODUCTION'
    ? './lib/provisioning/config/INFRA_SG/cp_sg.csv' : './lib/provisioning/config/INFRA_SG/ct_sg.csv';

  const file = fs.createReadStream(path).pipe(csv());
  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const csvData: Ec2CSV = {
        sgName: row.GroupName,
        type: row.Ingress_Egress,
        protocol: row.IpProtocol,
        fromPort: row.FromPort,
        toPort: row.ToPort,
        cidr: row.CidrIp,
        desc: row.Description,
      };
      results.push(csvData);
    });
    file.on('end', () => {
      // console.log(results)
      resolve(results);
    });
  });
  return results;
}

async function readTierInfo() {
  const results: TierCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/VPC/tier.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const csvData: TierCSV = {
        tier: row.TierName,
        prefix: row.SubnetPrefix,
        lbType: row.LoadBalancer,
        source: row.Source,
        target: row.Target,
      };
      results.push(csvData);
    });
    file.on('end', () => {
      // console.log(results)
      resolve(results);
    });
  });

  return results;
}

export async function CreateEc2Stack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const csvdata = await readCSV();
  const stack = new cdk.Stack(scope, id, props);
  const vpcName = process.env.VPC_NAME;
  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    // isDefault: false,
    vpcName,
  });

  const tierInfo: TierCSV[] = await readTierInfo();

  const tierSubnets: { [key: string]: ISubnet; }[] = [];
  for (const [i, r] of tierInfo.entries()) {
    const tierSubnetsValue: { [key: string]: ISubnet; } = {};
    cdk.Stack.of(stack).availabilityZones.forEach((az: string, index: number) => {
      const importSubnet: string = cdk.Fn.importValue(`${vpcName}-${r.tier}-${az}-subnetId`).toString();
      tierSubnetsValue[az] = ec2.Subnet.fromSubnetAttributes(stack, `importSubnet${az}${i}`, { subnetId: importSubnet, availabilityZone: az });
    });
    tierSubnets.push(tierSubnetsValue);
  }

  const sgNames = [...new Set(csvdata.map((r) => r.sgName))];
  const sgs = sgNames.map((r, i) => ec2.SecurityGroup.fromLookupByName(stack, `SG-Lookup-${i}`, r, vpc));

  const createEC2 = await ec2class.main(stack, vpc, tierInfo, tierSubnets, maxAZ, sgs);

  return {
    output: {},
  };
}
