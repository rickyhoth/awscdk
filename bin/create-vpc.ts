import * as cdk from '@aws-cdk/core';
import * as dotenv from 'dotenv';
import 'source-map-support/register';
import { CreateEbsStack } from '../lib/create-ebs-stack';
import { CreateEc2Stack } from '../lib/create-ec2-stack';
import { CreateELBStack } from '../lib/create-elb-stack';
import { CreateInfraSgStack } from '../lib/create-infrasg-stack';
import { CreateRdsStack } from '../lib/create-rds-stack';
import { CreateRTBStack } from '../lib/create-rtb-stack';
import { CreateS3Stack } from '../lib/create-s3-stack';
import { CreateSGStack } from '../lib/create-sg-stack';
import { CreateSG2Stack } from '../lib/create-sg2-stack';
import { CreateVpcStack } from '../lib/create-vpc-stack';

dotenv.config({ path: '.env' });
// const app = new cdk.App();
// new CreateVpcStack(app, 'CreateVpcStack', {
/* If you don't specify 'env', this stack will be environment-agnostic.
 * Account/Region-dependent features and context lookups will not work,
 * but a single synthesized template can be deployed anywhere. */

/* Uncomment the next line to specialize this stack for the AWS Account
 * and Region that are implied by the current CLI configuration. */
// env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

/* Uncomment the next line if you know exactly what Account and Region you
 * want to deploy the stack to. */
// env: { account: '123456789012', region: 'us-east-1' },

/* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
// });

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string,
  };
}

async function createApp(): Promise<cdk.App> {
  try {
    const app = new cdk.App();
    if (!process.env.CDK_DEFAULT_ACCOUNT || !process.env.CDK_DEFAULT_REGION) {
      throw new Error('Invaild AWS account or AWS region, please update .env or ~/.aws/credentials');
    }
    const env: AwsProps = { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } };
    console.log(process.env.CDK_DEFAULT_ACCOUNT, env);

    await CreateVpcStack(app, `${process.env.STACK_NAME}-vpc`, env);
    await CreateInfraSgStack(app, `${process.env.STACK_NAME}-infrasg`, env);
    await CreateEc2Stack(app, `${process.env.STACK_NAME}-ec2`, env);
    await CreateRdsStack(app, `${process.env.STACK_NAME}-rds`, env);

    await CreateEbsStack(app, `${process.env.STACK_NAME}-ebs`, env);
    await CreateSGStack(app, `${process.env.STACK_NAME}-sg`, env);
    await CreateSG2Stack(app, `${process.env.STACK_NAME}-sg2`, env);
    await CreateS3Stack(app, `${process.env.STACK_NAME}-s3`, env);
    await CreateELBStack(app, `${process.env.STACK_NAME}-elb`, env);

    // After Resource Sharing Lambda run
    await CreateRTBStack(app, `${process.env.STACK_NAME}-rtb`, env);

    cdk.Tags.of(app).add('Environment', String(process.env.ENVIRONMENT));

    return app;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

createApp();
