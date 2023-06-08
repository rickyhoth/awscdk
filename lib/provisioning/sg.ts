import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Stack } from '@aws-cdk/core';
import { ISecurityGroup, IVpc, Vpc } from '@aws-cdk/aws-ec2';

interface SGCSV {
  sgName: string,
  type: string,
  protocol: string,
  fromPort: string,
  toPort: string,
  cidr:string,
  desc: string,
}

interface CustomRulesCSV{
  sgName: string,
  type:string,
  protocol: string,
  fromPort: string,
  toPort: string,
  cidr:string,
  desc:string,
}

async function readCSV() {
  const results: SGCSV[] = [];
  const path: string = `${process?.env.ENVIRONMENT}`.toUpperCase() === 'PRODUCTION'
    ? './lib/provisioning/config/INFRA_SG/cp_sg.csv' : './lib/provisioning/config/INFRA_SG/ct_sg.csv';

  const file = fs.createReadStream(path).pipe(csv());
  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const rule: SGCSV = {
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

async function readCustomRules() {
  const results: CustomRulesCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/APP_SG/customrules.csv').pipe(csv());
  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const rule:CustomRulesCSV = {
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

async function getDefaultRules(basicinfra1SG: ISecurityGroup, basicinfra2SG: ISecurityGroup, commonsvc1SG: ISecurityGroup) {
  const csvdata = await readCSV();

  for (const i in csvdata) {
    // console.log(csvdata[i]);
    if (csvdata[i].sgName === 'sin-ct1-basicinfra-sg') {
      if (csvdata[i].type === 'SecurityGroupIngress') {
        // console.log(csvdata);
        if (csvdata[i].protocol === 'TCP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        // console.log(csvdata);
        if (csvdata[i].protocol === 'TCP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    } else if (csvdata[i].sgName === 'sin-ct1-basicinfra-sg2') {
      // console.log(csvdata);
      if (csvdata[i].type === 'SecurityGroupIngress') {
        if (csvdata[i].protocol === 'TCP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        // console.log(csvdata);
        if (csvdata[i].protocol === 'TCP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    } else if (csvdata[i].sgName === 'sin-ct1-commonsvc-sg') {
      // console.log(csvdata);
      if (csvdata[i].type === 'SecurityGroupIngress') {
        if (csvdata[i].protocol === 'TCP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        // console.log(csvdata);
        if (csvdata[i].protocol === 'TCP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'All' || csvdata[i].protocol === '-1') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    } else if (csvdata[i].sgName === 'sin-cp1-basicinfra-sg') {
      if (csvdata[i].type === 'SecurityGroupIngress') {
        if (csvdata[i].protocol === 'TCP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        if (csvdata[i].protocol === 'TCP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    } else if (csvdata[i].sgName === 'sin-cp1-basicinfra-sg2') {
      if (csvdata[i].type === 'SecurityGroupIngress') {
        if (csvdata[i].protocol === 'TCP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra2SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        if (csvdata[i].protocol === 'TCP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          basicinfra2SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    } else if (csvdata[i].sgName === 'sin-cp1-commonsvc-sg') {
      if (csvdata[i].type === 'SecurityGroupIngress') {
        if (csvdata[i].protocol === 'TCP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          commonsvc1SG.addIngressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      } else if (csvdata[i].type === 'SecurityGroupEgress') {
        if (csvdata[i].protocol === 'TCP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.tcpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'UDP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.udpRange(Number(csvdata[i].fromPort), Number(csvdata[i].toPort)),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ALL' || csvdata[i].protocol === '-1') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allTraffic(),
            csvdata[i].desc,
          );
        } else if (csvdata[i].protocol === 'ICMP') {
          commonsvc1SG.addEgressRule(
            ec2.Peer.ipv4(csvdata[i].cidr),
            ec2.Port.allIcmp(),
            csvdata[i].desc,
          );
        }
      }
    }
  }
}

export async function main(stack: Stack, vpc: IVpc, env: string) {
  // await customRules(stack, vpc);
  if (String(process.env.ENVIRONMENT) === 'Production') {
    const basicinfra1SG = new ec2.SecurityGroup(
      stack,
      'sin-cp1-basicinfra-sg',
      {
        vpc,
        allowAllOutbound: false, // will let your instance send outboud traffic
        securityGroupName: 'sin-cp1-basicinfra-sg',
        description: 'Prod Basic Infra Services SG',
      },
    );
    cdk.Tags.of(basicinfra1SG).add('Name', 'sin-cp1-basicinfra-sg');

    const basicinfra2SG = new ec2.SecurityGroup(
      stack,
      'sin-cp1-basicinfra-sg2',
      {
        vpc,
        allowAllOutbound: false, // will let your instance send outboud traffic
        securityGroupName: 'sin-cp1-basicinfra-sg2',
        description: 'Prod Basic Infra Services SG2',
      },
    );
    cdk.Tags.of(basicinfra2SG).add('Name', 'sin-cp1-basicinfra-sg2');

    const commonsvc1SG = new ec2.SecurityGroup(
      stack,
      'sin-cp1-commonsvc-sg',
      {
        vpc,
        allowAllOutbound: false, // will let your instance send outboud traffic
        securityGroupName: 'sin-cp1-commonsvc-sg',
        description: 'Prod Common Services SG',
      },
    );
    cdk.Tags.of(commonsvc1SG).add('Name', 'sin-cp1-commonsvc-sg');

    await getDefaultRules(basicinfra1SG, basicinfra2SG, commonsvc1SG);

    const securityGroups: ISecurityGroup[] = [];

    securityGroups.push(basicinfra1SG);
    securityGroups.push(basicinfra2SG);
    securityGroups.push(commonsvc1SG);

    return securityGroups;
  }

  const basicinfra1SG = new ec2.SecurityGroup(
    stack,
    'sin-ct1-basicinfra-sg',
    {
      vpc,
      allowAllOutbound: false, // will let your instance send outboud traffic
      securityGroupName: 'sin-ct1-basicinfra-sg',
      description: 'ETE Basic Infra Services SG',
    },
  );
  cdk.Tags.of(basicinfra1SG).add('Name', 'sin-ct1-basicinfra-sg');

  const basicinfra2SG = new ec2.SecurityGroup(
    stack,
    'sin-ct1-basicinfra-sg2',
    {
      vpc,
      allowAllOutbound: false, // will let your instance send outboud traffic
      securityGroupName: 'sin-ct1-basicinfra-sg2',
      description: 'ETE Basic Infra Services SG2',
    },
  );
  cdk.Tags.of(basicinfra2SG).add('Name', 'sin-ct1-basicinfra-sg2');

  const commonsvc1SG = new ec2.SecurityGroup(
    stack,
    'sin-ct1-commonsvc-sg',
    {
      vpc,
      allowAllOutbound: false, // will let your instance send outboud traffic
      securityGroupName: 'sin-ct1-commonsvc-sg',
      description: 'ETE Common Services SG',
    },
  );
  cdk.Tags.of(commonsvc1SG).add('Name', 'sin-ct1-commonsvc-sg');

  await getDefaultRules(basicinfra1SG, basicinfra2SG, commonsvc1SG);

  const securityGroups: ISecurityGroup[] = [];

  securityGroups.push(basicinfra1SG);
  securityGroups.push(basicinfra2SG);
  securityGroups.push(commonsvc1SG);

  return securityGroups;
}
