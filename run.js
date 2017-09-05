#!/usr/bin/env node
'use strict';

const program = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const execute = require('./index');
const env = process.env;

program
  .version(require('./package.json').version)
  .option(
    '--url [url]',
    'butbucket project url e.g. https://bitbucket.company.com/projects/foo/repos/bar',
    String,
    env.BITBUCKET_PROJECT_URL
  )
  .option(
    '-u, --username [username]',
    'bitbucket username. Can be defined via BITBUCKET_USER env variable',
    String,
    env.BITBUCKET_USER
  )
  .option(
    '-p, --password [password]',
    'bitbucket password. Can be defined via BITBUCKET_PASSWORD env variable',
    String,
    env.BITBUCKET_PASSWORD || env.BITBUCKET_PSWD // keep compat with bitbucket change log cli
  )
  .option(
    '-b, --branch [name]',
    'root branch to scan for merged pull requests since last release. Defaults to "master"',
    String,
    'master'
  )
  .option(
    '-c, --current [version]',
    'current semver version. If undefined will be searched for in tag history.',
    String
  )
  .option('--alpha', 'add an alpha pre-release tag')
  .option('--beta', 'add a beta pre-release tag')
  .option('--pre [tag]', 'add a custom pre-release tag', String)
  .option('--meta [tag]', 'add a metadata tag', String)
  .option('--json', 'output incremented version in json format')
  .option('--dev', 'maintain a semver major of zero during initial development')
  .option(
    '-d, --depth [int]',
    'depth of child pull requests to walk. Defaults to 1 which inspects PRs merged into the root branch only',
    Number,
    1
  )
  .option('-v, --verbose', 'enable verbose logging')
  .parse(process.argv);

execute(program).then(result => complete(result), e => error(e));

function complete({ current, next, isFirstTag }) {
  let str = '';
  if (current.label === next.label && !isFirstTag) {
    // if there's no version change output `unchanged`
    // to allow tools to handle this gracefully.
    if (program.verbose) console.info('no semver increment found');
    str = program.json ? JSON.stringify({ unchanged: true }) : 'unchanged';
  } else {
    if (program.verbose) console.info(`${current.label} -> ${next.label}`);
    str = program.json ? JSON.stringify(next) : next.label;
  }
  process.stdout.write(`${str}\n`);
  process.exit(0);
}

function error(e, code = 1) {
  const msg = e instanceof Error ? e.message : e;
  console.error(chalk.red(msg));
  process.exit(code);
}
