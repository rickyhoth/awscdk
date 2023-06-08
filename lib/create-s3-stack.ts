import * as cdk from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as s3class from './provisioning/s3';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string
  }
}

interface MyStackOutput {
  output: object,
}

interface S3CSV{
  bucketName: string,
  bucketVersionControl: boolean,
  keepBucket: boolean,
  encryptionType: string,
  kmsArn: string
}

async function readCSV() {
  const results: S3CSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/S3/s3.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const bucket :S3CSV = {
        bucketName: row.BucketName,
        // string to boolean, not equal to false, it sets to true
        bucketVersionControl: row.BucketVersionControl !== 'false',
        // string to boolean, not equal to false, it sets to true
        keepBucket: row.KeepBucket !== 'false',
        encryptionType: row.EncryptionType,
        kmsArn: row.KmsArn,
      };
      results.push(bucket);
    });
    file.on('end', () => {
      resolve(results);
    });
  });

  return results;
}

export async function CreateS3Stack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  // Read csv and loop each row
  const stack = new cdk.Stack(scope, id, props);
  for (const bucket of await readCSV()) {
    // check empty row
    if (!bucket.bucketName) {
      throw new Error('Invalid parameter(s)');
    }

    await s3class.main(stack, id, props, bucket);
  }

  return {
    output: {},
  };
}
