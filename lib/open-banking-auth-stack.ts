require('dotenv').config()
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecr as ecr } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns } from 'aws-cdk-lib';
import { aws_certificatemanager as acm } from 'aws-cdk-lib';
import { aws_elasticloadbalancingv2 as alb } from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { Role, ServicePrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Duration, CustomResource } from 'aws-cdk-lib';

export class OpenBankingAuthStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ------ API GATEWAY CONFIGURATION

    // API Gateway Definition
    const api = new apigateway.RestApi(this, "OpenBankingAPI", {
      restApiName: "Open Banking API",
      description: "This API exposes Open Banking services."
    });

    const OIDC_JWKS_ENDPOINT = `${process.env.R53_DOMAIN_NAME}${process.env.JWKS_URI}`

    // Lambda Authorizer
    const LambdaAuthorizeRole = new Role(this, 'LambdaAuthorizerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    LambdaAuthorizeRole.addToPolicy(new PolicyStatement({
      resources: ['*'],
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'secretsmanager:GetSecretValue', 'sts:AssumeRole'],
    }));

    const jwtAuthorizer = new lambda.Function(this, "LambdaAuthHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("resources/lambda"),
      handler: "lambda-auth.handler",
      role: LambdaAuthorizeRole,
      environment: {
        JWKS_ENDPOINT: OIDC_JWKS_ENDPOINT,
        API_ID: api.restApiId,
        ACCOUNT_ID: <string>process.env.CDK_DEFAULT_ACCOUNT,
        SM_JWKS_SECRET_NAME: <string>process.env.SM_JWKS_SECRET_NAME
      }
    });

    // Lambda Backend Integration
    const backendHandler = new lambda.Function(this, "BackendHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("resources/lambda"),
      handler: "backend.handler"
    });

    // Add Lambda Authorizer to Gateway
    const authorizer = new apigateway.TokenAuthorizer(this, 'JWTAuthorizer', {
      handler: jwtAuthorizer,
      validationRegex: "^(Bearer )[a-zA-Z0-9\-_]+?\.[a-zA-Z0-9\-_]+?\.([a-zA-Z0-9\-_]+)$"
    });

    // Create Protected Resource
    const getApiIntegration = new apigateway.LambdaIntegration(backendHandler, {
      requestTemplates: { "application/json": '{ "statusCode": "200" }' }
    });

    // Define HTTP Method for Resource with Lambda Authorizer
    api.root.addMethod("GET", getApiIntegration, { authorizer }); // GET 

    // ------ END OF API GATEWAY CONFIGURATION


    // ------ SECRETS MANAGER CONFIGURATION FOR JWKS INFORMATION

    // Custom Resource to Create Secrets Manager with JWKS KID
    const customResourceRole = new Role(this, 'CustomResourceLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    customResourceRole.addToPolicy(new PolicyStatement({
      resources: ['*'],
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'secretsmanager:*', 'sts:AssumeRole'],
    }));

    const customSecretsManagerLambda = new lambda.Function(this, "CustomSecretsManagerHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("resources/lambda"),
      handler: "custom-secrets-manager.handler",
      timeout: Duration.minutes(5),
      role: customResourceRole,
      environment: {
        JWKS_ENDPOINT: OIDC_JWKS_ENDPOINT,
        SM_JWKS_SECRET_NAME: <string>process.env.SM_JWKS_SECRET_NAME
      }
    });

    new CustomResource(this, 'JwksSecretsManager', {
      serviceToken: customSecretsManagerLambda.functionArn
    });
    // ------ END OF SECRETS MANAGER CONFIGURATION FOR JWKS INFORMATION

  }

}
