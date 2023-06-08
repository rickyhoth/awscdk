import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import * as sgclass from './provisioning/sg';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string;
  };
}

interface MyStackOutput {
  output: object;
}

export async function CreateInfraSgStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const serviceName = String(process.env.STACK_NAME);

  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    isDefault: false,
    vpcName: process.env.VPC_NAME,
  });

  const securityGroups = await sgclass.main(stack, vpc, String(process.env.ENVIRONMENT));

  // new cdk.CfnOutput(stack, 'SG', {
  //   value: JSON.stringify(securityGroups),
  //   // description: 'The name of the s3 bucket',
  //   exportName: 'sg-id',
  // });

  return {
    output: {},
  };
}
