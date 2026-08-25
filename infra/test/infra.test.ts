import * as cdk from 'aws-cdk-lib/core';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { JDFitStack } from '../lib/jdfit-stack';

test('storage and messaging layer', () => {
  const app = new cdk.App();
  const stack = new JDFitStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.hasResourceProperties('AWS::S3::Bucket', {
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        {
          ServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256',
          },
        },
      ],
    },
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
  template.hasResource('AWS::S3::Bucket', {
    DeletionPolicy: 'Delete',
    UpdateReplacePolicy: 'Delete',
  });

  template.resourceCountIs('AWS::DynamoDB::Table', 2);
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'resumeId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'resumeId', AttributeType: 'S' },
    ],
  });
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    BillingMode: 'PAY_PER_REQUEST',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'analysisId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'analysisId', AttributeType: 'S' },
    ],
  });
  template.allResources('AWS::DynamoDB::Table', {
    DeletionPolicy: 'Delete',
    UpdateReplacePolicy: 'Delete',
  });

  template.resourceCountIs('AWS::SNS::Topic', 1);

  template.resourceCountIs('AWS::SQS::Queue', 2);
  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 90,
    RedrivePolicy: {
      deadLetterTargetArn: Match.anyValue(),
      maxReceiveCount: 3,
    },
  });

  template.hasResourceProperties('AWS::SNS::Subscription', {
    Protocol: 'sqs',
  });

  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Name: 'jdfit-api',
  });
  template.hasResourceProperties('AWS::IAM::Role', {
    AssumeRolePolicyDocument: {
      Statement: Match.arrayWith([
        Match.objectLike({
          Action: 'sts:AssumeRole',
          Effect: 'Allow',
          Principal: { Service: 'textract.amazonaws.com' },
        }),
      ]),
    },
  });
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs24.x',
    Timeout: 30,
    Environment: {
      Variables: {
        APP_ENV: 'prod',
        TABLE_RESUMES: Match.anyValue(),
        TABLE_ANALYSES: Match.anyValue(),
        BUCKET_NAME: Match.anyValue(),
        SNS_TOPIC_ARN: Match.anyValue(),
        TEXTRACT_ROLE_ARN: Match.anyValue(),
      },
    },
  });
  template.hasResourceProperties('AWS::Lambda::Function', {
    Runtime: 'nodejs24.x',
    Timeout: 60,
  });
  template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
    BatchSize: 1,
  });
  template.hasResourceProperties('Custom::S3BucketNotifications', {
    NotificationConfiguration: {
      LambdaFunctionConfigurations: Match.arrayWith([
        Match.objectLike({
          Events: ['s3:ObjectCreated:*'],
          Filter: {
            Key: {
              FilterRules: Match.arrayWith([
                { Name: 'suffix', Value: '.pdf' },
              ]),
            },
          },
        }),
      ]),
    },
  });

  template.resourceCountIs('AWS::Cognito::UserPool', 0);
});
