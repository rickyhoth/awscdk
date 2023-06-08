import * as kms from '@aws-cdk/aws-kms';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string,
  };
}

interface Context {
  bucketName: string,
  bucketVersionControl: boolean,
  keepBucket: boolean,
  encryptionType: string,
  kmsArn: string,
}

interface MyStackOutput {
  output: object;
}

interface Args {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

enum TYPE {
  S3_MANAGED = 'S3_MANAGED',
  KMS = 'KMS',
  KMS_MANAGED = 'KMS_MANAGED',
}

export async function main(stack: cdk.Stack, id: string, props: AwsProps, context: Context): Promise<MyStackOutput> {
  // const stack = new cdk.Stack(scope, id, props);
  const args: Args = {
    bucketName: context.bucketName,
    // @ts-ignore: BUCKET_OWNER_ENFORCED is not implemented in the module
    objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    versioned: context.bucketVersionControl,
    publicReadAccess: false,
  };

  if (!context.encryptionType || context.encryptionType === TYPE.S3_MANAGED) {
    args.encryption = s3.BucketEncryption.S3_MANAGED;
    args.bucketKeyEnabled = false;
  } else if (context.encryptionType === TYPE.KMS_MANAGED) {
    args.encryption = s3.BucketEncryption.KMS_MANAGED;
    args.bucketKeyEnabled = false;
  } else if (context.encryptionType === TYPE.KMS) {
    const cmsKey = kms.Key.fromKeyArn(stack, 'CMS', context.kmsArn);
    args.encryption = s3.BucketEncryption.KMS;
    args.encryptionKey = cmsKey;
    args.bucketKeyEnabled = true;
  }

  if (!context.keepBucket) {
    // clean and destroy bucket when stack is removed/rebuilt
    args.removalPolicy = cdk.RemovalPolicy.DESTROY;
    args.autoDeleteObjects = true;
  }

  const bucket = new s3.Bucket(stack, `${id}-${context.bucketName}`, args);

  return {
    output: {},
  };
}
