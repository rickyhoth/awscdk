import { IVpc } from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { IApplicationLoadBalancerTarget } from '@aws-cdk/aws-elasticloadbalancingv2';
import { InstanceIdTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import * as cdk from '@aws-cdk/core';
import { Stack } from '@aws-cdk/core';

export async function main(stack: Stack, vpc: IVpc, name: string, subnets: any, desc: string, listenerItems: any[]) {
  const alb = new elbv2.ApplicationLoadBalancer(stack, 'alb', {
    vpc,
    loadBalancerName: name,
    internetFacing: false,
    // crossZoneEnabled: true,
    vpcSubnets: {
      subnets: cdk.Stack.of(stack).availabilityZones.map((az) => subnets[az]),
    },
  });
  cdk.Tags.of(alb).add('Description', String(desc));

  for (const listenerItem of listenerItems) {
    const listenerConfig:{
      protocol: elbv2.ApplicationProtocol,
      port:number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any,
    } = {
      protocol: listenerItem.cert ? elbv2.ApplicationProtocol.HTTPS : elbv2.ApplicationProtocol.HTTP,
      port: Number(listenerItem.port),
      certificates: listenerItem.cert ? [{
        certificateArn: String(listenerItem.cert),
      }] : undefined,
    };

    const listener = alb.addListener(listenerItem.name, listenerConfig);

    const instanceList: IApplicationLoadBalancerTarget[] = [];
    const instanceTgInfos = listenerItem.tgInstances;
    for (const instanceTgInfo of instanceTgInfos) {
      const instanceId = cdk.Fn.importValue(`${instanceTgInfo.instance}`).toString();
      instanceList.push(new InstanceIdTarget(instanceId, Number(instanceTgInfo.port)));
    }
    listener.addTargets(listenerItem.tgName, {
      targets: instanceList,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: Number(listenerItem.tgPort),
      targetGroupName: listenerItem.tgName,
    });
  }

  return [];
}
