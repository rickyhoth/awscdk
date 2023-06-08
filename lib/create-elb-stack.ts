import * as csv from 'csv-parser';
import * as fs from 'fs';
import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

import { ISubnet } from '@aws-cdk/aws-ec2';
import * as albclass from './provisioning/alb';
import * as nlbclass from './provisioning/nlb';

interface MyStackProps extends cdk.StackProps {
  env: {
    account: any,
    region: any
  }
}

interface MyStackOutput {
  output: object;
}

async function readLBInfo() {
  const results: any[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/ELB/loadbalancer.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance = {
        lbName: row.LBName,
        lbType: row.LBType,
        tier: row.Tier,
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

async function readTGInfo() {
  const results: any[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/ELB/targetgroup.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance = {
        tgName: row.TGName,
        instance: row.Instance,
        port: row.InstancePort,
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

async function readListenerInfo() {
  const results: any[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/ELB/listener.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const instance = {
        listenerName: row.ListenerName,
        listenerPort: row.ListenerPort,
        lbName: row.LoadBalancer,
        tgName: row.TargetGroup,
        tgPort: row.TargetPort,
        certArn: row.SSLCertArn,
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

export async function CreateELBStack(scope: cdk.Construct, id: string, props: MyStackProps): Promise<MyStackOutput> {
  const stack = new cdk.Stack(scope, id, props);
  const vpcName = process.env.VPC_NAME;
  const vpc = ec2.Vpc.fromLookup(stack, 'VPC', {
    vpcName: process.env.VPC_NAME,
  });

  const lbLists = await readLBInfo();
  const listenerLists = await readListenerInfo();
  const tgList = await readTGInfo();

  const lbItems = [];

  for (const lbList of lbLists) {
    const listenerItems: {
      name: string,
      port: string,
      tgName: string,
      tgPort: string,
      cert:string,
      tgInstances:{
        instance: string,
        port: string,
      }[],
    }[] = [];
    for (const listenerList of listenerLists) {
      if (listenerList.lbName === lbList.lbName) {
        const targetItems : {
          instance: string,
          port: string,
        }[] = [];
        for (const k in tgList) {
          if (tgList[k].tgName === listenerList.tgName) {
            const tgInfo = {
              instance: tgList[k].instance,
              port: tgList[k].port,
            };
            targetItems.push(tgInfo);
          }
        }
        const listenerInfo = {
          name: listenerList.listenerName,
          port: listenerList.listenerPort,
          tgName: listenerList.tgName,
          tgPort: listenerList.tgPort,
          cert: listenerList.certArn,
          tgInstances: targetItems,
        };
        listenerItems.push(listenerInfo);
      }
    }
    const tierSubnets = cdk.Stack.of(stack).availabilityZones.reduce((acc:{ [key:string]:ISubnet }, az:string) => {
      const args = { subnetId: cdk.Fn.importValue(`${vpcName}-${lbList.tier}-${az}-subnetId`).toString(), availabilityZone: az };
      acc[az] = ec2.Subnet.fromSubnetAttributes(stack, `${lbList.lbName}-${az}-subnetId`, args);
      return acc;
    }, {});

    const lbInfo = {
      name: lbList.lbName,
      type: lbList.lbType,
      subnets: tierSubnets,
      desc: lbList.desc,
      listeners: listenerItems,
    };
    lbItems.push(lbInfo);
  }

  // console.log(lbItems[0].subnets['1a']);

  for (const lbItem of lbItems) {
    if (lbItem.type === 'ALB') {
      const createALB = await albclass.main(stack, vpc, lbItem.name, lbItem.subnets, lbItem.desc, lbItem.listeners);
    } else if (lbItem.type === 'NLB') {
      const createNLB = await nlbclass.main(stack, vpc, lbItem.name, lbItem.subnets, lbItem.desc, lbItem.listeners);
    }
  }

  return {
    output: {},
  };
}
