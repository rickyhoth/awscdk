# This is a provisioning tool for build your AWS workload by fill in a couple of csv files and handle all of the dependencies. 

Please fill in the csv file in "prepare/config" and the env.txt file in "prepare/env".

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Supported AWS Service

* EC2
* ELB
* SG
* RDS
* VPC
* S3


## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
