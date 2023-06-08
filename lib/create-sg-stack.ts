import * as ec2 from '@aws-cdk/aws-ec2';
import { IVpc } from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { Stack } from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string,
  }
}

interface MyStackOutput {
  output: object;
}

interface CustomRulesCSV{
  sgName: string,
  type:string,
  protocol: string,
  fromPort: string,
  toPort: string,
  cidr:string,
  targetSG:string,
  desc:string,
}
const maxAZ = Number(process.env.MAX_AZ);

async function readCustomRules() {
  const results: CustomRulesCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/APP_SG/customrules.csv').pipe(csv());
  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const rule:CustomRulesCSV = {
        sgName: row.GroupName,
        type: row.Ingress_Egress,
        protocol: row.IpProtocol,
        fromPort: row.FromPort,
        toPort: row.ToPort,
        cidr: row.CidrIp,
        targetSG: row.SourceSecurityGroupId,
        desc: row.Description,
      };
      results.push(rule);
    });
    file.on('end', () => {
      /// /console.log(results)
      resolve(results);
    });
  });
  return results;
}

async function customRules(stack: Stack, vpc: IVpc) {
  const customRulesCsvdata = await readCustomRules();

  const sgNameList: string[] = [];

  for (const r of customRulesCsvdata) {
    if (sgNameList.indexOf(r.sgName) === -1) {
      sgNameList.push(r.sgName);
    }
  }

  const customSGList = [];

  for (const [i, sgName] of sgNameList.entries()) {
    // console.log(sgName);

    const securityGroup = new ec2.SecurityGroup(
      stack,
      sgName,
      {
        vpc,
        allowAllOutbound: false,
        securityGroupName: String(sgName),
      },
    );
    cdk.Tags.of(securityGroup).add('Name', sgName);

    new cdk.CfnOutput(stack, `${sgName}id`, {
      value: securityGroup.securityGroupId,
      description: `${sgName}SG ID`,
      exportName: `${sgName}-SGID`,
    });

    for (const csvData of customRulesCsvdata) {
      if (csvData.type === 'SecurityGroupIngress' && csvData.sgName === sgName) {
        if (csvData.protocol === 'TCP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addIngressRule(
              ec2.Peer.ipv4(csvData.cidr),
              ec2.Port.tcpRange(Number(csvData.fromPort), Number(csvData.toPort)),
              csvData.desc,
            );
          }
        } else if (csvData.protocol === 'UDP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addIngressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.udpRange(Number(csvData.fromPort), Number(csvData.toPort)),
              csvData.desc,
            );
          }
        } else if (csvData.protocol === 'ALL' || csvData.protocol === '-1') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addIngressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.allTraffic(),
              csvData.desc,
            );
          }
        } else if (csvData.protocol === 'ICMP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addIngressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.allIcmp(),
              csvData.desc,
            );
          }
        }
      } else if (csvData.type === 'SecurityGroupEgress' && csvData.sgName === sgName && customRulesCsvdata[i].cidr != null) {
        // console.log(csvdata);
        if (csvData.protocol === 'TCP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addEgressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.tcpRange(Number(csvData.fromPort), Number(csvData.toPort)),
              csvData.desc,
            );
          }
        } else if (csvData.protocol === 'UDP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addEgressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.udpRange(Number(customRulesCsvdata[i].fromPort), Number(customRulesCsvdata[i].toPort)),
              customRulesCsvdata[i].desc,
            );
          }
        } else if (csvData.protocol === 'ALL' || csvData.protocol === '-1') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addEgressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.allTraffic(),
              csvData.desc,
            );
          }
        } else if (csvData.protocol === 'ICMP') {
          if (String(csvData.cidr).length > 1) {
            securityGroup.addEgressRule(
              ec2.Peer.ipv4(String(csvData.cidr).trim()),
              ec2.Port.allIcmp(),
              csvData.desc,
            );
          }
        }
      }
    }

    customSGList.push(securityGroup);
  }

  return customSGList;
}

export async function CreateSGStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const stackName = 'cdk-custom-sg';

  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcName: process.env.VPC_NAME,
  });

  await customRules(stack, vpc);

  return {
    output: {},
  };
}
