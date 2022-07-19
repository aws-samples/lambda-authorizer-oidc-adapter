import { Match, Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib';
import * as OpenBankingAuth from '../lib/open-banking-auth-stack';

test('SQS Queue Created', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new OpenBankingAuth.OpenBankingAuthStack(app, 'MyTestStack');
    // THEN
    Template.fromStack(stack).hasResource("AWS::SQS::Queue",{
      VisibilityTimeout: 300
    });
});

test('SNS Topic Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack = new OpenBankingAuth.OpenBankingAuthStack(app, 'MyTestStack');
  // THEN
  Template.fromStack(stack).hasResource("AWS::SNS::Topic");
});
