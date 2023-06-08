/* eslint-disable no-useless-concat */
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as ec2 from '@aws-cdk/aws-ec2';
import {
  Instance, ISecurityGroup, ISubnet, IVpc,
} from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';
import * as cdk from '@aws-cdk/core';
import { Stack } from '@aws-cdk/core';
import * as csv from 'csv-parser';
import * as fs from 'fs';

interface Ec2CSV {
  id: string,
  app: string,
  env: string,
  tier: string,
  az: string,
  instanceType: string,
  disk: string,
  os: string,
  image: string,
  mapServerID: string,
  desc: string,
}

interface TierCSV {
  tier: string,
  prefix: string,
  lbType: string,
  source: string,
  target: string,
}

async function readCSV() {
  const results: Ec2CSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/EC2/ec2.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance: Ec2CSV = {
        id: row.Name,
        app: row.App,
        env: row.Env,
        tier: row.Tier,
        az: row.AZ,
        instanceType: row.Size,
        disk: row.Disk,
        os: row.OS,
        image: row.AMIName,
        mapServerID: row.MAPServerID,
        desc: row.Desc,
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

async function genUserData(instance: Instance, hostname: string, appID: string, env: string, os: string, desc: string) {
  if (os === 'Windows') {
    instance.addUserData('<powershell>' + '\n');
    instance.addUserData('New-Item -Path C:\\BGInfo\\ -ItemType Directory' + '\n');
    instance.addUserData('New-Item -Path C:\\BGInfo\\cmdb_info.txt -ItemType File' + '\n');
    instance.addUserData(`echo appid=${appID} > C:\\BGInfo\\cmdb_info.txt` + '\n');
    instance.addUserData(`echo ci_name=${hostname} >> C:\\BGInfo\\cmdb_info.txt` + '\n');
    instance.addUserData(`echo ci_description=${desc} >> C:\\BGInfo\\cmdb_info.txt` + '\n');
    instance.addUserData("echo 'platform_room=AWS' >> C:\\BGInfo\\cmdb_info.txt" + '\n');
    instance.addUserData(`echo 'usage=${env}' >> C:\\BGInfo\\cmdb_info.txt` + '\n');
    instance.addUserData("echo 'pci_inventory=' >> C:\\BGInfo\\cmdb_info.txt" + '\n');
    instance.addUserData("echo 'pci_inventory_effective_date=' >> C:\\BGInfo\\cmdb_info.txt" + '\n');
    instance.addUserData("echo 'level_2_support=CX-Infra Engineering Modernization' >> C:\\BGInfo\\cmdb_info.txt" + '\n');
    instance.addUserData("echo 'level_3_support=CX-Infra Engineering Modernization' >> C:\\BGInfo\\cmdb_info.txt" + '\n');
    // eslint-disable-next-line max-len
    instance.addUserData(`$password = (Get-SSMParameterValue -Names ${process.env.ADJOINKEY} -WithDecryption $True).Parameters[0].Value | ConvertTo-SecureString -asPlainText -Force` + '\n');
    instance.addUserData(`$newname = '${hostname}'; $username = 'nwow001\\TC_ADJOIN_502'` + '\n');
    instance.addUserData('$credential = New-Object System.Management.Automation.PSCredential($username,$password)' + '\n');
    // eslint-disable-next-line max-len
    instance.addUserData("Add-Computer -domainname 'NWOW001.CORP.ETE.CATHAYPACIFIC.COM' -NewName $newname -Credential $credential -OUPath 'OU=TB-0096,OU=TB-Servers,OU=Tier B,DC=nwow001,DC=corp,DC=ete,DC=cathaypacific,DC=com' -Passthru -Verbose -Force -Restart" + '\n');
    instance.addUserData('</powershell>' + '\n');
    instance.addUserData('<persist>true</persist>' + '\n');
  } else {
    let domain = '';

    if (env.toUpperCase() === 'PROD') {
      domain = 'cpadm001';
    } else {
      domain = 'nwow001';
    }

    instance.addUserData(`hostnamectl set-hostname --static ${hostname}\n`);
    instance.addUserData('touch /home/addmscan/cmdb_info.txt\n');
    instance.addUserData(`printf 'appid=${appID}\n`);
    instance.addUserData(`ci_name=${hostname}\n`);
    instance.addUserData(`ci_description=${desc}\n`);
    instance.addUserData('platform_room=AWS' + '\n');
    instance.addUserData('pci_inventory=' + '\n');
    instance.addUserData('pci_inventory_effective_date=' + '\n');
    instance.addUserData('level_2_support=CX-Infra Engineering Modernization' + '\n');
    instance.addUserData("level_3_support=CX-Infra Engineering Modernization \n' > /home/addmscan/cmdb_info.txt" + '\n');
    instance.addUserData('chmod u+w,a+r /home/addmscan/cmdb_info.txt' + '\n');
    instance.addUserData('chown addmscan.addmscan /home/addmscan/cmdb_info.txt' + '\n');
    instance.addUserData('' + '\n');
    instance.addUserData('rm -rf /etc/yum.repos.d/*rhui*.repo' + '\n');
    instance.addUserData('yum -y update --security' + '\n');
    instance.addUserData('' + '\n');
    instance.addUserData('usermod -s /sbin/nologin ec2-us' + '\n');
    instance.addUserData('' + '\n');
    instance.addUserData('mkdir -p /etc/opt/quest/vas' + '\n');
    instance.addUserData('touch /etc/opt/quest/vas/users.allow' + '\n');
    instance.addUserData('' + '\n');
    instance.addUserData("printf '#example: domain\\user or domain\\ADgroup" + '\n');
    instance.addUserData(`${domain}\\cloudl3lxsupport` + '\n');
    instance.addUserData(`${domain}\\cloudl2lxsupport` + '\n');
    instance.addUserData(`${appID}LxAppSupport' > /etc/opt/quest/vas/users.allow` + '\n');
  }
}

async function createCloudwatchAlarm(stack: Stack, hostname: string, instance: Instance, os: string) {
  const cpuMetric = new cw.Metric({
    namespace: 'AWS/EC2',
    metricName: 'CPUUtilization',
    statistic: 'Maximum',
    dimensionsMap: {
      instanceId: instance.instanceId,
    },
  });

  const cpuAlarm = cpuMetric.createAlarm(stack, `${hostname}-CPU`, {
    alarmName: `Cloud BAU Support - S4 - ${hostname} - CPU`,
    alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - CPU > 90%`,
    comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
    datapointsToAlarm: 3,
    threshold: 90,
    evaluationPeriods: 3,
    treatMissingData: cw.TreatMissingData.MISSING,
  });

  cpuAlarm.addAlarmAction({
    bind(): cw.AlarmActionConfig {
      return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
    },
  });

  if (os === 'Linux') {
    // Memory Cloudwatch Alarm
    const memMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'mem_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
      },
    });

    const memAlarm = memMetric.createAlarm(stack, `${hostname}-MEM`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - MEM`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - MEM > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    memAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Swap Cloudwatch Alarm
    const swapMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'swap_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
      },
    });

    const swapAlarm = swapMetric.createAlarm(stack, `${hostname}-SWAP`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - SWAP`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - SWAP > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    swapAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Root Disk Cloudwatch Alarm
    const rootDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/',
        device: 'nvme0n1p2',
        fstype: 'xfs',
      },
    });

    const rootDiskAlarm = rootDiskMetric.createAlarm(stack, `${hostname}-root`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - root`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - root > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    rootDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Usr Disk Cloudwatch Alarm
    const usrDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/usr',
        device: 'mapper/rhel-usr',
        fstype: 'xfs',
      },
    });

    const usrDiskAlarm = usrDiskMetric.createAlarm(stack, `${hostname}-usr`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - usr`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - usr > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    usrDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Tmp Disk Cloudwatch Alarm
    const tmpDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/tmp',
        device: 'mapper/rhel-tmp',
        fstype: 'xfs',
      },
    });

    const tmpDiskAlarm = tmpDiskMetric.createAlarm(stack, `${hostname}-tmp`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - tmp`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - tmp > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    tmpDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Home Disk Cloudwatch Alarm
    const homeDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/home',
        device: 'mapper/rhel-home',
        fstype: 'xfs',
      },
    });

    const homeDiskAlarm = homeDiskMetric.createAlarm(stack, `${hostname}-home`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - home`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - home > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    homeDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Opt Disk Cloudwatch Alarm
    const optDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/opt',
        device: 'mapper/rhel-opt',
        fstype: 'xfs',
      },
    });

    const optDiskAlarm = optDiskMetric.createAlarm(stack, `${hostname}-opt`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - opt`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - opt > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    optDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Var Disk Cloudwatch Alarm
    const varDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/var',
        device: 'mapper/rhel-var',
        fstype: 'xfs',
      },
    });

    const varDiskAlarm = varDiskMetric.createAlarm(stack, `${hostname}-var`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - var`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - var > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    varDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // VarLog Disk Cloudwatch Alarm
    const varlogDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/var/log',
        device: 'mapper/rhel-varlog',
        fstype: 'xfs',
      },
    });

    const varlogDiskAlarm = varlogDiskMetric.createAlarm(stack, `${hostname}-varlog`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - varlog`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - varlog > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    varlogDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // VarCrash Disk Cloudwatch Alarm
    const varcrashDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/var/crash',
        device: 'mapper/rhel-varcrash',
        fstype: 'xfs',
      },
    });

    const varcrashDiskAlarm = varcrashDiskMetric.createAlarm(stack, `${hostname}-varcrash`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - varcrash`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - varcrash > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    varcrashDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // VarLogAudit Disk Cloudwatch Alarm
    const varlogauditDiskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'disk_used_percent',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        path: '/var/log/audit',
        device: 'mapper/rhel-varlogaudit',
        fstype: 'xfs',
      },
    });

    const varlogauditDiskAlarm = varlogauditDiskMetric.createAlarm(stack, `${hostname}-varlogaudit`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - varlogaudit`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - varlogaudit > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    varlogauditDiskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });
  } else if (os === 'Windows') {
    // Memory Cloudwatch Alarm
    const memMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'Memory % Committed Bytes In Use',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        objectname: 'Memory',
      },
    });

    const memAlarm = memMetric.createAlarm(stack, `${hostname}-mem`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - mem`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - Memory > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    memAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });

    // Disk Cloudwatch Alarm
    const diskMetric = new cw.Metric({
      namespace: 'CWAgent',
      metricName: 'LogicalDisk % Free Space',
      statistic: 'Maximum',
      dimensionsMap: {
        instanceId: instance.instanceId,
        objectname: 'LogicalDisk',
        instance: 'C:',
      },
    });

    const diskAlarm = diskMetric.createAlarm(stack, `${hostname}-diskC`, {
      alarmName: `Cloud BAU Support - S4 - ${hostname} - Disk C`,
      alarmDescription: `Cloud BAU Support - S4 - ${hostname} - ${process.env.APPLICATIONID} - Disk C > 90%`,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
      datapointsToAlarm: 3,
      threshold: 90,
      evaluationPeriods: 3,
      treatMissingData: cw.TreatMissingData.MISSING,
    });

    diskAlarm.addAlarmAction({
      bind(): cw.AlarmActionConfig {
        return { alarmActionArn: 'arn:aws:sns:ap-southeast-1:689867028045:Cloud-L2_Support' };
      },
    });
  }
}

export async function main(
  stack: Stack,
  vpc: IVpc,
  tierList: TierCSV[],
  tierSubnets: { [key: string]: ISubnet; }[],
  maxAZ: number,
  securityGroups: ISecurityGroup[],
) {
  if (!process.env.APPLICATIONID || !process.env.ENVIRONMENT) throw new Error('Invalid env APPLICATIONID or ENVIRONMENT');
  const instanceList = await readCSV();
  // const securityGroups = await sg.main(stack, vpc, String(process.env.ENVIRONMENT));

  const role = new iam.Role(
    stack,
    'cdk-iam', // this is j unique id that will represent this resource in j Cloudformation template
    { assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com') },
  );

  const instances = [];

  for (const [i, tierOfList] of tierList.entries()) {
    const tierInstances = [];

    // const subnet1a: ISubnet = tierSubnets[i]['1a'];
    // const subnet1b: ISubnet = tierSubnets[i]['1b'];
    // const subnet1c: ISubnet = tierSubnets[i]['1c'];

    for (const j in instanceList) {
      if (instanceList[j].az === 'ap-southeast-1a' && instanceList[j].tier === tierOfList.tier) {
        const instance = new ec2.Instance(stack, instanceList[j].id, {
          vpc,
          role,
          securityGroup: securityGroups[0],
          vpcSubnets: {
            subnets: [tierSubnets[i]['ap-southeast-1a']],
            // subnetType: ec2.SubnetType.PRIVATE,
            availabilityZones: ['ap-southeast-1a'],
          },
          instanceName: instanceList[j].id,
          instanceType: new ec2.InstanceType(instanceList[j].instanceType),
          machineImage: ec2.MachineImage.lookup({
            name: instanceList[j].image,
          }),
          keyName: String(process.env.KEYPAIR), // we will create this in the console before we deploy
        });

        instance.addSecurityGroup(securityGroups[1]);
        instance.addSecurityGroup(securityGroups[2]);

        await genUserData(instance, instanceList[j].id, process.env.APPLICATIONID, process.env.ENVIRONMENT, instanceList[j].os, instanceList[j].desc);
        await createCloudwatchAlarm(stack, instanceList[j].id, instance, instanceList[j].os);

        cdk.Tags.of(instance).add('map_migrated', String(instanceList[j].mapServerID));
        cdk.Tags.of(instance).add('Scheduling', 'mod-default');
        cdk.Tags.of(instance).add('Description', String(instanceList[j].desc));
        tierInstances.push(instance);

        new cdk.CfnOutput(stack, `${instanceList[j].id}-id`, {
          value: instance.instanceId,
          exportName: instanceList[j].id,
          description: instanceList[j].desc,
        });
      } else if (instanceList[j].az === 'ap-southeast-1b' && instanceList[j].tier === tierOfList.tier) {
        const instance = new ec2.Instance(stack, instanceList[j].id, {
          vpc,
          role,
          securityGroup: securityGroups[0],
          vpcSubnets: {
            subnets: [tierSubnets[i]['ap-southeast-1b']],
            // subnetType: ec2.SubnetType.PRIVATE,
            availabilityZones: ['ap-southeast-1b'],
          },
          instanceName: instanceList[j].id,
          instanceType: new ec2.InstanceType(instanceList[j].instanceType),
          machineImage: ec2.MachineImage.lookup({
            name: instanceList[j].image,
          }),
          keyName: String(process.env.KEYPAIR), // we will create this in the console before we deploy
        });

        instance.addSecurityGroup(securityGroups[1]);
        instance.addSecurityGroup(securityGroups[2]);

        await genUserData(instance, instanceList[j].id, process.env.APPLICATIONID, process.env.ENVIRONMENT, instanceList[j].os, instanceList[j].desc);
        await createCloudwatchAlarm(stack, instanceList[j].id, instance, instanceList[j].os);

        cdk.Tags.of(instance).add('map_migrated', String(instanceList[j].mapServerID));
        cdk.Tags.of(instance).add('Scheduling', 'mod-default');
        cdk.Tags.of(instance).add('Description', String(instanceList[j].desc));
        tierInstances.push(instance);

        new cdk.CfnOutput(stack, `${instanceList[j].id}-id`, {
          value: instance.instanceId,
          exportName: instanceList[j].id,
          description: instanceList[j].desc,
        });
      } else if (instanceList[j].az === 'ap-southeast-1c' && instanceList[j].tier === tierOfList.tier) {
        const instance = new ec2.Instance(stack, instanceList[j].id, {
          vpc,
          role,
          securityGroup: securityGroups[0],
          vpcSubnets: {
            subnets: [tierSubnets[i]['ap-southeast-1c']],
            // subnetType: ec2.SubnetType.PRIVATE,
            availabilityZones: ['ap-southeast-1c'],
          },
          instanceName: instanceList[j].id,
          instanceType: new ec2.InstanceType(instanceList[j].instanceType),
          machineImage: ec2.MachineImage.lookup({
            name: instanceList[j].image,
          }),
          keyName: String(process.env.KEYPAIR), // we will create this in the console before we deploy
        });

        instance.addSecurityGroup(securityGroups[1]);
        instance.addSecurityGroup(securityGroups[2]);

        await genUserData(instance, instanceList[j].id, process.env.APPLICATIONID, process.env.ENVIRONMENT, instanceList[j].os, instanceList[j].desc);
        await createCloudwatchAlarm(stack, instanceList[j].id, instance, instanceList[j].os);

        cdk.Tags.of(instance).add('map-migrated', String(instanceList[j].mapServerID));
        cdk.Tags.of(instance).add('Scheduling', 'mod-default');
        cdk.Tags.of(instance).add('Description', String(instanceList[j].desc));
        tierInstances.push(instance);

        new cdk.CfnOutput(stack, `${instanceList[j].id}-id`, {
          value: instance.instanceId,
          exportName: instanceList[j].id,
          description: instanceList[j].desc,
        });
      }
    }
    instances.push(tierInstances);
  }

  return instances;
}
