import { IVpc } from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import { BaseNetworkListenerProps, INetworkLoadBalancerTarget } from '@aws-cdk/aws-elasticloadbalancingv2';
import { InstanceIdTarget } from '@aws-cdk/aws-elasticloadbalancingv2-targets';
import * as cdk from '@aws-cdk/core';
import { Stack } from '@aws-cdk/core';

export async function main(stack: Stack, vpc: IVpc, name: string, subnets: any, desc: string, listenerItems: any[]) {
  const nlb = new elbv2.NetworkLoadBalancer(stack, 'nlb', {
    vpc,
    loadBalancerName: name,
    internetFacing: false,
    crossZoneEnabled: true,
    vpcSubnets: {
      subnets: cdk.Stack.of(stack).availabilityZones.map((az) => subnets[az]),
    },
  });
  cdk.Tags.of(nlb).add('Description', String(desc));

  for (const listenerItem of listenerItems) {
    const listenerConfig: BaseNetworkListenerProps = {
      port: Number(listenerItem.port),
      certificates: listenerItem.cert ? [{
        certificateArn: String(listenerItem.cert),
      }] : undefined,
    };

    const listener = nlb.addListener(listenerItem.name, listenerConfig);

    const instanceList: INetworkLoadBalancerTarget[] = [];
    const instanceTgInfos = listenerItem.tgInstances;
    for (const instanceTgInfo of instanceTgInfos) {
      const instanceId = cdk.Fn.importValue(`${instanceTgInfo.instance}`).toString();
      instanceList.push(new InstanceIdTarget(instanceId, Number(instanceTgInfo.port)));
    }
    listener.addTargets(listenerItem.tgName, {
      targets: instanceList,
      port: Number(listenerItem.tgPort),
      targetGroupName: listenerItem.tgName,
    });
  }
}
