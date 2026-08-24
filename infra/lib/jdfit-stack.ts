import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class JDFitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new s3.Bucket(this, 'ResumeUploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    new dynamodb.Table(this, 'Resumes', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'resumeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new dynamodb.Table(this, 'Analyses', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'analysisId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const textractCompletion = new sns.Topic(this, 'TextractCompletion');

    const processDlq = new sqs.Queue(this, 'ProcessDlq', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, //added
    });

    const processQueue = new sqs.Queue(this, 'ProcessQueue', {
      visibilityTimeout: cdk.Duration.seconds(90),
      removalPolicy: cdk.RemovalPolicy.DESTROY, //added
      deadLetterQueue: {
        queue: processDlq,
        maxReceiveCount: 3,
      },
    });

    textractCompletion.addSubscription(
      new snsSubscriptions.SqsSubscription(processQueue),
    );
  }
}
