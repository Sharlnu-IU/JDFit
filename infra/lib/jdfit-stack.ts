import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib/core';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

const BACKEND_ROOT = path.join(process.cwd(), '..', 'backend');
const HANDLERS_DIR = path.join(BACKEND_ROOT, 'src', 'handlers');

export class JDFitStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const resumeUploads = new s3.Bucket(this, 'ResumeUploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const resumes = new dynamodb.Table(this, 'Resumes', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'resumeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const analyses = new dynamodb.Table(this, 'Analyses', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'analysisId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const textractCompletion = new sns.Topic(this, 'TextractCompletion');
    const textractServiceRole = new iam.Role(this, 'TextractServiceRole', {
      assumedBy: new iam.ServicePrincipal('textract.amazonaws.com'),
    });
    textractCompletion.grantPublish(textractServiceRole);

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

    const lambdaEnv = {
      TABLE_RESUMES: resumes.tableName,
      TABLE_ANALYSES: analyses.tableName,
      BUCKET_NAME: resumeUploads.bucketName,
      SNS_TOPIC_ARN: textractCompletion.topicArn,
      APP_ENV: 'prod',
    };

    const nodeFunction = (
      functionId: string,
      entryFile: string,
      timeout = cdk.Duration.seconds(30),
    ): lambdaNodejs.NodejsFunction =>
      new lambdaNodejs.NodejsFunction(this, functionId, {
        runtime: lambda.Runtime.NODEJS_24_X,
        projectRoot: BACKEND_ROOT,
        depsLockFilePath: path.join(BACKEND_ROOT, 'package-lock.json'),
        entry: path.join(HANDLERS_DIR, entryFile),
        handler: 'handler',
        timeout,
        environment: lambdaEnv,
      });

    const presignedUrl = nodeFunction('PresignedUrl', 'presignedUrl.lambda.ts');
    resumeUploads.grantPut(presignedUrl);
    resumes.grant(presignedUrl, 'dynamodb:PutItem');

    const startExtraction = nodeFunction(
      'StartExtraction',
      'startExtraction.lambda.ts',
    );
    resumeUploads.grantRead(startExtraction);
    resumes.grant(startExtraction, 'dynamodb:UpdateItem');
    textractServiceRole.grantPassRole(startExtraction.grantPrincipal);
    startExtraction.addEnvironment(
      'TEXTRACT_ROLE_ARN',
      textractServiceRole.roleArn,
    );
    // Textract document-analysis APIs do not support resource-level ARNs.
    startExtraction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:StartDocumentAnalysis'],
        resources: ['*'],
      }),
    );

    const processResults = nodeFunction(
      'ProcessResults',
      'processResults.lambda.ts',
      cdk.Duration.seconds(60),
    );
    resumeUploads.grantRead(processResults);
    resumes.grant(processResults, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
    processResults.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['textract:GetDocumentAnalysis'],
        resources: ['*'],
      }),
    );

    const analyzeMatch = nodeFunction(
      'AnalyzeMatch',
      'analyzeMatch.lambda.ts',
    );
    resumes.grant(analyzeMatch, 'dynamodb:GetItem');
    analyses.grant(analyzeMatch, 'dynamodb:PutItem');

    const getResumes = nodeFunction('GetResumes', 'getResumes.lambda.ts');
    resumes.grant(getResumes, 'dynamodb:Query', 'dynamodb:GetItem');

    const getResume = nodeFunction('GetResume', 'getResume.lambda.ts');
    resumes.grant(getResume, 'dynamodb:Query', 'dynamodb:GetItem');

    const deleteResume = nodeFunction('DeleteResume', 'deleteResume.lambda.ts');
    resumes.grant(deleteResume, 'dynamodb:DeleteItem');
    resumeUploads.grantDelete(deleteResume);

    const getAnalyses = nodeFunction('GetAnalyses', 'getAnalyses.lambda.ts');
    analyses.grant(getAnalyses, 'dynamodb:Query', 'dynamodb:GetItem');

    const getAnalysis = nodeFunction('GetAnalysis', 'getAnalysis.lambda.ts');
    analyses.grant(getAnalysis, 'dynamodb:Query', 'dynamodb:GetItem');

    const deleteAnalysis = nodeFunction(
      'DeleteAnalysis',
      'deleteAnalysis.lambda.ts',
    );
    analyses.grant(deleteAnalysis, 'dynamodb:DeleteItem');

    const getSkillGaps = nodeFunction('GetSkillGaps', 'getSkillGaps.lambda.ts');
    analyses.grant(getSkillGaps, 'dynamodb:Query', 'dynamodb:GetItem');

    resumeUploads.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(startExtraction),
      { suffix: '.pdf' },
    );

    processResults.addEventSource(
      new lambdaEventSources.SqsEventSource(processQueue, { batchSize: 1 }),
    );

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'jdfit-api',
    });
    // TODO(Phase 4): Cognito User Pool authorizer

    const apiV1 = api.root.addResource('api').addResource('v1');

    const resumesResource = apiV1.addResource('resumes');
    resumesResource
      .addResource('upload-url')
      .addMethod('POST', new apigateway.LambdaIntegration(presignedUrl));
    resumesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getResumes),
    );
    const resumeResource = resumesResource.addResource('{resumeId}');
    resumeResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getResume),
    );
    resumeResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteResume),
    );

    const analysesResource = apiV1.addResource('analyses');
    analysesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(analyzeMatch),
    );
    analysesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getAnalyses),
    );
    const analysisResource = analysesResource.addResource('{analysisId}');
    analysisResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getAnalysis),
    );
    analysisResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteAnalysis),
    );

    apiV1
      .addResource('insights')
      .addResource('skill-gaps')
      .addMethod('GET', new apigateway.LambdaIntegration(getSkillGaps));
  }
}
