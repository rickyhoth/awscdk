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
  output: object,
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
      // console.log(results)
      resolve(results);
    });
  });
  return results;
}

async function customRules(stack: Stack, vpc: IVpc) {
  const customRulesCsvdata = await readCustomRules();

  const sgNameList: string[] = [];

  for (const csvData of customRulesCsvdata) {
    if (sgNameList.indexOf(csvData.sgName) === -1) {
      sgNameList.push(csvData.sgName);
    }
  }

  const customSGList = [];

  for (const [i, sgName] of sgNameList.entries()) {
    // console.log(sgName);

    const securityGroup = ec2.SecurityGroup.fromLookupByName(stack, `${sgName}-add`, String(sgName), vpc);

    for (const [j, crCsvData] of customRulesCsvdata.entries()) {
      if (crCsvData.type === 'SecurityGroupIngress' && crCsvData.sgName === sgName) {
        if (crCsvData.protocol === 'TCP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowFrom(targetSG, ec2.Port.tcpRange(Number(crCsvData.fromPort), Number(crCsvData.toPort)), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'UDP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowFrom(targetSG, ec2.Port.udpRange(Number(crCsvData.fromPort), Number(crCsvData.toPort)), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'ALL' || crCsvData.protocol === '-1') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowFrom(targetSG, ec2.Port.allTraffic(), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'ICMP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowFrom(targetSG, ec2.Port.allIcmp(), String(crCsvData.desc));
          }
        }
      } else if (crCsvData.type === 'SecurityGroupEgress' && crCsvData.sgName === sgName && customRulesCsvdata[i].cidr != null) {
        // console.log(csvdata);
        if (crCsvData.protocol === 'TCP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowTo(targetSG, ec2.Port.tcpRange(Number(crCsvData.fromPort), Number(crCsvData.toPort)), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'UDP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowTo(targetSG, ec2.Port.udpRange(Number(crCsvData.fromPort), Number(crCsvData.toPort)), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'ALL' || crCsvData.protocol === '-1') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowTo(targetSG, ec2.Port.allTraffic(), String(crCsvData.desc));
          }
        } else if (crCsvData.protocol === 'ICMP') {
          if (String(crCsvData.cidr).length <= 1) {
            const targetSG = ec2.SecurityGroup.fromLookupByName(stack, `targetRule${[j]}`, String(crCsvData.targetSG), vpc);
            securityGroup.connections.allowTo(targetSG, ec2.Port.allIcmp(), String(crCsvData.desc));
          }
        }
      }
    }

    customSGList.push(securityGroup);
  }

  return customSGList;
}

export async function CreateSG2Stack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const stackName = 'cdk-custom-sg2';

  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcName: process.env.VPC_NAME,
  });

  await customRules(stack, vpc);

  return {
    output: {},
  };
}
