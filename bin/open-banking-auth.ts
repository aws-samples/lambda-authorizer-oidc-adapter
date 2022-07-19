#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OpenBankingAuthStack } from '../lib/open-banking-auth-stack';

const app = new cdk.App();
new OpenBankingAuthStack(app, 'OpenBankingAuthStack');