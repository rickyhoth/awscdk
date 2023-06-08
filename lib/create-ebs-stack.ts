import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';
import { Tags } from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';

interface AwsProps extends cdk.StackProps {
  env: {
    account: string,
    region: string
  }
}

interface MyStackOutput {
  output: object;
}

interface EbsCSV {
  az: string,
  env: string,
  name: string,
  devId: string,
  disksize: string,
  disktype: string,
  instance: string,
}

const maxAZ = Number(process.env.MAX_AZ);

async function readEbsInfo() {
  const results: EbsCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/EBS/ebs.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance:EbsCSV = {
        az: row.AZ,
        env: row.Env,
        name: row.Name,
        devId: row.DevID,
        disksize: row.Size,
        disktype: row.Type,
        instance: row.Instance,
      };
      results.push(instance);
    });
    file.on('end', () => {
      resolve(results);
    });
  });
  return results;
}

export async function CreateEbsStack(scope: cdk.Construct, id: string, props: AwsProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const stackName = 'cdk-extrea-ebs';

  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcName: process.env.VPC_NAME,
  });

  const volumeLists = await readEbsInfo();

  for (const objs in volumeLists) {
    if (volumeLists[objs].disksize !== '' && volumeLists[objs].az === 'ap-southeast-1a') {
      // console.log(`Zone A object definded: ${volumeLists[objs].name}`)
      const volume = new ec2.Volume(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}`, {
        availabilityZone: volumeLists[objs].az,
        size: cdk.Size.gibibytes(Number(volumeLists[objs].disksize)),
        volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
        // volumeName: `${volumeLists[objs].name}-extra-volume-${volumeLists[objs].disksize}GB`
        encrypted: true,
        // encryptionKey: "arn:aws:kms:ap-southeast-1:528141447021:key/4f98b395-bbf0-4b80-9a79-93436aa5c339',
        removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      });
      Tags.of(volume).add('Name', `${volumeLists[objs].instance}_${volumeLists[objs].name}`);

      const hostname = cdk.Fn.importValue(volumeLists[objs].instance);
      const cfnVolumeAttachment = new ec2.CfnVolumeAttachment(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}_attch`, {
        device: volumeLists[objs].devId,
        instanceId: hostname,
        volumeId: volume.volumeId,
      });
    } else if (volumeLists[objs].disksize !== '' && volumeLists[objs].az === 'ap-southeast-1b') {
      // console.log(`Zone B object definded: ${volumeLists[objs].name}`)
      const volume = new ec2.Volume(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}`, {
        availabilityZone: volumeLists[objs].az,
        size: cdk.Size.gibibytes(Number(volumeLists[objs].disksize)),
        volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
        // volumeName: `${volumeLists[objs].name}-extra-volume-${volumeLists[objs].disksize}GB`
        encrypted: true,
        // encryptionKey: "arn:aws:kms:ap-southeast-1:528141447021:key/4f98b395-bbf0-4b80-9a79-93436aa5c339',
        removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      });
      Tags.of(volume).add('Name', `${volumeLists[objs].instance}_${volumeLists[objs].name}`);

      const hostname = cdk.Fn.importValue(volumeLists[objs].instance);
      const cfnVolumeAttachment = new ec2.CfnVolumeAttachment(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}_attch`, {
        device: volumeLists[objs].devId,
        instanceId: hostname,
        volumeId: volume.volumeId,
      });
    } else if (volumeLists[objs].disksize !== '' && volumeLists[objs].az === 'ap-southeast-1c') {
      // console.log(`Zone C object definded: ${volumeLists[objs].name}`)
      const volume = new ec2.Volume(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}`, {
        availabilityZone: volumeLists[objs].az,
        size: cdk.Size.gibibytes(Number(volumeLists[objs].disksize)),
        volumeType: ec2.EbsDeviceVolumeType.GENERAL_PURPOSE_SSD_GP3,
        // volumeName: `${volumeLists[objs].name}-extra-volume-${volumeLists[objs].disksize}GB`
        encrypted: true,
        // encryptionKey: "arn:aws:kms:ap-southeast-1:528141447021:key/4f98b395-bbf0-4b80-9a79-93436aa5c339',
        removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      });
      Tags.of(volume).add('Name', `${volumeLists[objs].instance}_${volumeLists[objs].name}`);

      const hostname = cdk.Fn.importValue(volumeLists[objs].instance);
      const cfnVolumeAttachment = new ec2.CfnVolumeAttachment(stack, `${volumeLists[objs].instance}_${volumeLists[objs].name}_attch`, {
        device: volumeLists[objs].devId,
        instanceId: hostname,
        volumeId: volume.volumeId,
      });
    } else if (volumeLists[objs].disksize !== '' && volumeLists[objs].az === '') {
      console.log(`Disk definded but there is no AZ provided. Skip: ${volumeLists[objs].name}`);
    } else if (!volumeLists[objs].disksize) {
      console.log(`Disk defindtion not found. Skip: ${volumeLists[objs].name}`);
    } else {
      console.log('Do nothing');
    }
  }
  return {
    output: {},
  };
}
