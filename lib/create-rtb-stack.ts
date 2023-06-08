import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string;
  };
}

interface MyStackOutput {
  output: object;
}
interface RtbCSV {
  tier: string,
  prefix: string,
  tgwAttached: boolean,
}

async function readTierInfo() {
  const results: RtbCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/VPC/tier.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance: RtbCSV = {
        tier: row.TierName,
        prefix: row.SubnetPrefix,
        tgwAttached: row.TgwAttached === 'true',
      };
      results.push(instance);
    });
    file.on('end', () => {
      // console.log(results)
      resolve(results);
    });
  });

  return results;
}

export async function CreateRTBStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const vpcName = process.env.VPC_NAME;
  const tgwId = 'tgw-084ec3b72830136c7';
  const tierInfos = await readTierInfo();

  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcName: process.env.VPC_NAME,
  });
  for (const tierInfo of tierInfos) {
    // const targetSubnets = vpc.selectSubnets({
    //   subnetGroupName: String(tierInfo[i].tier)
    // });

    const targetSubnets = cdk.Stack.of(stack).availabilityZones.map((az) => ec2.Subnet.fromSubnetAttributes(
      stack,
      `${tierInfo.tier}-subnet-${az}-rtb`,
      { subnetId: cdk.Fn.importValue(`${vpcName}-${tierInfo.tier}-${az}-subnetId`).toString(), availabilityZone: az },
    ));

    const rtb = new ec2.CfnRouteTable(stack, 'tierRtb', {
      vpcId: vpc.vpcId,
    });

    cdk.Tags.of(rtb).add('Name', String(`${tierInfo.tier}RTB`));

    if (tierInfo.tgwAttached) {
      const tgwRoute = new ec2.CfnRoute(stack, 'tgwroute', {
        routeTableId: rtb.attrRouteTableId,
        destinationCidrBlock: '0.0.0.0/0',
        transitGatewayId: tgwId,
      });
    }

    new cdk.CfnOutput(stack, `${tierInfo.tier}rtbID`, {
      value: rtb.attrRouteTableId,
      description: `${tierInfo.tier} Route Table ID`,
      exportName: `${tierInfo.tier}-RTBID`,
    });

    targetSubnets.forEach((targetSubnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(stack, `asso${index}`, {
        routeTableId: rtb.attrRouteTableId,
        subnetId: targetSubnet.subnetId,
      });
    });
  }

  return {
    output: {},
  };
}
