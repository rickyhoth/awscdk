import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as csv from 'csv-parser';
import * as fs from 'fs';
import { Stack } from '@aws-cdk/core';
import {
  ISecurityGroup, ISubnet, IVpc, Vpc,
} from '@aws-cdk/aws-ec2';

interface RDSCSV {
  id: string,
  env: string,
  engine: string,
  version:string,
  multiAZ:string,
  az:string,
  port: number,
  instanceType: string,
  storageType: string,
  storageSize: string,
  dbIops: string,
  dbName: string,
  mapServerID: string,
  desc: string,
}

async function readCSV() {
  const results: RDSCSV[] = [];
  const file = fs.createReadStream('./lib/provisioning/config/RDS/rds.csv').pipe(csv());

  await new Promise((resolve, reject) => {
    file.on('data', (row) => {
      const csvData:RDSCSV = {
        id: row.Name,
        env: row.Env,
        engine: row.DBEngine,
        version: row.Version,
        multiAZ: row.MultiAZ,
        az: row.AZ,
        port: +row.Port,
        instanceType: row.InstanceType,
        storageType: row.StorageType,
        storageSize: row.StorageSize,
        dbIops: row.DBIops,
        dbName: row.DBName,
        mapServerID: row.MAPServerID,
        desc: row.Desc,
      };
      results.push(csvData);
    });
    file.on('end', () => {
      resolve(results);
    });
  });

  return results;
}

async function getStorageType(type: string) {
  switch (type) {
    case 'standard': return rds.StorageType.STANDARD;
    case 'gp2': return rds.StorageType.GP2;
    case 'io1': return rds.StorageType.GP2;
    default: return rds.StorageType.GP2;
  }
}

async function isMultiAZ(value: string) {
  switch (value.toUpperCase()) {
    case 'ENABLE': return true;
    default: return false;
  }
}

export async function main(stack: Stack, vpc: IVpc, dbSubnets: ISubnet[], securityGroups: ISecurityGroup[]) {
  const vpcName = process.env.VPC_NAME;
  const stackName = process.env.STACK_NAME;
  const rdsList = await readCSV();
  const [dbSubnet1a, dbSubnet1b, dbSubnet1c]: ISubnet[] = cdk.Stack.of(stack).availabilityZones.map((az) => ec2.Subnet
    .fromSubnetAttributes(
      stack,
      `importSubnet-${az}`,
      {
        subnetId: cdk.Fn.importValue(`${vpcName}-RDS-default-${az}-subnetId`).toString(),
        availabilityZone: az,
      },
    ));

  const rdsInstances = [];

  for (const i in rdsList) {
    if (rdsList[i].engine === 'mysql') {
      const dbsecret = rds.Credentials.fromGeneratedSecret('cx_admin');
      //   const mysqlPG = new rds.ParameterGroup(stack, "mysqlPG", {
      //   engine: {
      //     engineType: 'mysql',
      //     engineVersion: {
      //       majorVersion: "8",
      //     },
      //     parameterGroupFamily: "mysql8.0"
      //   },
      //   parameters: {
      //     'audit_trail': 'OS',
      //     'audit_sys_operations' : 'True',
      //     'job_queue_processes' : '1000',
      //     'enable_ddl_logging' : 'True'
      //   }
      // });

      const dbInstance = new rds.DatabaseInstance(stack, `${rdsList[i].id}-RDS`, {
        vpc,
        vpcSubnets: {
          subnets: [dbSubnet1a, dbSubnet1b, dbSubnet1c],
        },
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_8_0,
        }),
        securityGroups,
        instanceIdentifier: rdsList[i].id,
        instanceType: new ec2.InstanceType(rdsList[i].instanceType),
        credentials: dbsecret,
        allocatedStorage: Number(rdsList[i].storageSize),
        maxAllocatedStorage: Math.round(Number(rdsList[i].storageSize) * 1.2),
        storageType: await getStorageType(rdsList[i].storageType),
        multiAz: await isMultiAZ(rdsList[i].multiAZ),
        availabilityZone: rdsList[i].az,
        deleteAutomatedBackups: true,
        databaseName: rdsList[i].dbName,
        // parameterGroup: mysqlPG
      });

      cdk.Tags.of(dbInstance).add('map_migrated', String(rdsList[i].mapServerID));
      cdk.Tags.of(dbInstance).add('Scheduling', 'mod-default');
      cdk.Tags.of(dbInstance).add('Description', String(rdsList[i].desc));
      rdsInstances.push(dbInstance);
    } else if (rdsList[i].engine === 'oracle') {
      const oraclePG = new rds.ParameterGroup(stack, 'oraclePG', {
        engine: rds.DatabaseInstanceEngine.oracleEe({
          version: rds.OracleEngineVersion.VER_19_0_0_0_2021_04_R1,
        }),
        parameters: {
          audit_trail: 'OS',
          audit_sys_operations: 'TRUE',
          job_queue_processes: '1000',
          enable_ddl_logging: 'TRUE',
        },
      });
      const oracleOG = new rds.OptionGroup(stack, 'oracleOG', {
        engine: rds.DatabaseInstanceEngine.oracleEe({
          version: rds.OracleEngineVersion.VER_19_0_0_0_2021_04_R1,
        }),
        configurations: [
          {
            name: 'Timezone',
            settings: { TIME_ZONE: 'Asia/Hong_Kong' },
          },
          {
            name: 'SSL',
            port: 2484,
            vpc,
            settings: {
              'FIPS.SSLFIPS_140': 'FALSE',
              'SQLNET.CIPHER_SUITE': 'SSL_RSA_WITH_AES_256_CBC_SHA',
              'SQLNET.SSL_VERSION': '1.2',
            },
          },
          {
            name: 'OEM_AGENT',
            version: '13.4.0.9.v1',
            port: 3872,
            vpc,
            settings: {
              AGENT_REGISTRATION_PASSWORD: 'Oracle$123',
              OMS_HOST: '10.212.75.22',
              OMS_PORT: '4903',
            },
          }],
      });

      const dbsecret = rds.Credentials.fromGeneratedSecret('admin');
      const dbInstance = new rds.DatabaseInstance(stack, `${rdsList[i].id}-RDS`, {
        vpc,
        vpcSubnets: {
          subnets: [dbSubnet1a, dbSubnet1b, dbSubnet1c],
        },
        engine: rds.DatabaseInstanceEngine.oracleEe({
          version: rds.OracleEngineVersion.VER_19,
        }),
        credentials: dbsecret,
        instanceType: new ec2.InstanceType(rdsList[i].instanceType),
        securityGroups,
        instanceIdentifier: rdsList[i].id,
        allocatedStorage: Number(rdsList[i].storageSize),
        maxAllocatedStorage: Math.round(Number(rdsList[i].storageSize) * 1.2),
        storageType: await getStorageType(rdsList[i].storageType),
        multiAz: await isMultiAZ(rdsList[i].multiAZ),
        availabilityZone: rdsList[i].az,
        deleteAutomatedBackups: true,
        databaseName: rdsList[i].dbName,
        parameterGroup: oraclePG,
        optionGroup: oracleOG,
        storageEncrypted: true,
      });

      cdk.Tags.of(dbInstance).add('map_migrated', String(rdsList[i].mapServerID));
      cdk.Tags.of(dbInstance).add('Scheduling', 'mod-default');
      cdk.Tags.of(dbInstance).add('Description', String(rdsList[i].desc));
      rdsInstances.push(dbInstance);
    } else if (rdsList[i].engine === 'postgres') {
      const dbsecret = rds.Credentials.fromGeneratedSecret('cx_admin');
      const defaultPostgresPG = {
        log_connections: 'on',
        log_disconnections: 'true',
        log_duration: '1',
        // 'log_hostname'  :null.
        log_lock_waits: 'true',
        log_statement: 'ddl',
        log_error_verbosity: 'default',
        log_min_duration_statement: '-1',
        debug_print_parse: 'off',
        debug_print_rewritten: '0',
        debug_print_plan: 'false',
        // 'debug_pretty_print':null.
        log_checkpoints: 'true',
        // 'log_parser_stats':null.
        // 'Log_planner_stats':null.
        // 'Log_executor_stats':null.
        log_statement_stats: 'false',
        'pgaudit.role': 'rds_pgaudit',
        'pgaudit.log': 'ddl,role',
      };

      const postgresPG = new rds.ParameterGroup(stack, 'postgresPG', {
        engine: {
          engineType: 'postgres',
          engineVersion: {
            majorVersion: rdsList[i].version === '12' ? '12' : '13',
          },
          parameterGroupFamily: rdsList[i].version === '12' ? 'postgres12' : 'postgres13',
        },
        parameters: {
          ...defaultPostgresPG,
        },
      });

      const postgresInstance = new rds.DatabaseInstance(stack, `${rdsList[i].id}-RDS`, {
        vpc,
        vpcSubnets: {
          subnets: [dbSubnet1a, dbSubnet1b, dbSubnet1c],
        },
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rdsList[i].version === '12' ? rds.PostgresEngineVersion.VER_12 : rds.PostgresEngineVersion.VER_13,
        }),
        instanceType: new ec2.InstanceType(rdsList[i].instanceType),
        securityGroups,
        instanceIdentifier: rdsList[i].id,
        credentials: dbsecret,
        allocatedStorage: Number(rdsList[i].storageSize),
        maxAllocatedStorage: Math.round(Number(rdsList[i].storageSize) * 1.2),
        storageType: await getStorageType(rdsList[i].storageType),
        multiAz: await isMultiAZ(rdsList[i].multiAZ),
        availabilityZone: rdsList[i].az,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        backupRetention: cdk.Duration.days(0),
        deleteAutomatedBackups: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deletionProtection: false,
        databaseName: rdsList[i].dbName,
        storageEncrypted: true,
        // optionGroupName: postgresOG,
        parameterGroup: postgresPG,
        port: rdsList[i].port,
      });

      cdk.Tags.of(postgresInstance).add('map_migrated', String(rdsList[i].mapServerID));
      cdk.Tags.of(postgresInstance).add('Scheduling', 'mod-default');
      cdk.Tags.of(postgresInstance).add('Description', String(rdsList[i].desc));
      rdsInstances.push(postgresInstance);
    }
  }

  return rdsInstances;
}
