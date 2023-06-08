import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as rdsclass from './provisioning/rds';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string;
  };
}

interface MyStackOutput {
  output: object;
}

interface SGCSV{
  sgName: string,
  type:string,
  protocol:string,
  fromPort: string,
  toPort:string,
  cidr:string,
  desc: string,
}

async function readSgCSV() {
  const results: SGCSV[] = [];
  const path: string = `${process?.env.ENVIRONMENT}`.toUpperCase() === 'PRODUCTION'
    ? './lib/provisioning/config/INFRA_SG/cp_sg.csv' : './lib/provisioning/config/INFRA_SG/ct_sg.csv';

  const file = fs.createReadStream(path).pipe(csv());
  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const rule:SGCSV = {
        sgName: row.GroupName,
        type: row.Ingress_Egress,
        protocol: row.IpProtocol,
        fromPort: row.FromPort,
        toPort: row.ToPort,
        cidr: row.CidrIp,
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

export async function CreateRdsStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const csvdata = await readSgCSV();
  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    isDefault: false,
    vpcName: process.env.VPC_NAME,
  });
  const sgNames = [...new Set(csvdata.map((r) => r.sgName))];
  const sgs = sgNames.map((r, i) => ec2.SecurityGroup.fromLookupByName(stack, `sg-lookup-${i}`, r, vpc));

  await rdsclass.main(stack, vpc, vpc.isolatedSubnets, sgs);

  return {
    output: {},
  };
}
