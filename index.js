const request = require('axios');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  SEMVER_TAG_BASE_PATTERN,
  SEMVER_TAG_PATTERN,
  Semver,
  parseSemver,
  getSemverIncrement,
  incrementVersion
} = require('./semver');

const TARGET = {
  NODE: 'nodejs'
};

module.exports = execute;
async function execute(options) {
  options = await verifyOptions(options);
  const inc = await findSemverIncrement(options);
  const next = incrementVersion(inc, options);
  return { current: options.current, next };
}

async function verifyOptions(options) {
  options = options || {};

  assert.ok(options.url, 'Bitbucket base url is missing');
  assert.ok(options.username, 'Bitbucket username is missing');
  assert.ok(options.password, 'Bitbucket password is missing');

  if (!options.branch) options.branch = 'master';
  if (!options.branch.startsWith('refs/')) {
    options.branch = `refs/heads/${options.branch}`;
  }

  if (!options.depth || options.depth < 1) options.depth = 1;

  options.tags = await getTagChain(options);

  const label = options.tags.base ? options.tags.base.displayId : '0.0.0';
  options.current = parseSemver(label);

  return options;
}

async function getTagChain(options) {
  const size = 20;
  let start = 0;
  const chain = [];
  while (true) {
    const res = await getTagsPage(start, size, options);
    const tags = res.values || [];
    for (const tag of tags) {
      // ignore non-semver tags
      if (!SEMVER_TAG_PATTERN.test(tag.displayId)) {
        continue;
      }
      chain.push(tag);
      if (chain.length === 1) {
        tag.commit = await getCommit(tag.latestCommit, options);
      }
      if (SEMVER_TAG_BASE_PATTERN.test(tag.displayId || '')) {
        if (chain.length !== 1) {
          tag.commit = await getCommit(tag.latestCommit, options);
        }

        // We attempt to determine if the tag was made on a merged PR commit
        // If it was we parse out the PR's id. This later allows us to exclude
        // any pr that was merged at the same time or before it. This can
        // be more accurate than the timestamp as PR's returned from the RESTful
        // api do not give is the time the merge commit was made, only when
        // the PR was merged. There can be a second or two difference there.
        const match = (tag.commit.message || '')
          .match(/^merge pull request #(\d+)/i);
        const taggedPrId = match ? Number(match[1]) : undefined;
        return { base: tag, chain, latest: chain[0], taggedPrId };
      }
    }
    if (res.isLastPage || res.nextPageStart === undefined) {
      return { chain, latest: chain[0] };
    }
    start = res.nextPageStart;
  }
  return undefined;
}

function getTagsPage(start, size, options) {
  return serviceCall(`/tags?start=${start}&limit=${size}`, options);
}

async function findSemverIncrement(options) {
  const { tags, branch } = options;
  const lastTagDate = tags.base ? tags.base.commit.authorTimestamp : undefined;
  const prs = await getPullRequests(
    branch,
    'MERGED',
    lastTagDate,
    0,
    30,
    [],
    1,
    options
  );
  const all = flatten(prs);
  printTree(prs, 0, options);
  return getSemverIncrement(all);
}

function flatten(prs, result = []) {
  for (let pr of prs) {
    result.push(pr);
    flatten(pr.children, result);
  }
  return result;
}

async function getPullRequests(
  branch,
  state,
  since,
  start,
  size,
  results,
  currentDepth,
  options
) {
  const res = await getPullRequestsPage(branch, state, start, size, options);
  let prs = [];
  if (since) {
    for (let pr of res.values) {
      // There's a small but annoying issue here.
      // The PR metadata we get from Bitbucket's REST api doesn't give us the
      // commit hash it makes when a merge executes, only the timestamp of the merge.
      // This means the timestamp from a tag on a merged PR can be a second or so before
      // the PR timestamp. To account for this we check both the timestamp and also
      // the PR id if the last tag was against a PR.
      // See
      // - https://community.atlassian.com/t5/Bitbucket-questions/How-to-find-a-merge-commit-for-the-pull-request-via-Stash-REST/qaq-p/266783
      // - https://community.atlassian.com/t5/Bitbucket-questions/Rest-API-to-get-all-the-merged-commits-in-a-branch/qaq-p/619089#U634812
      if (pr.id === options.tags.taggedPrId || pr.updatedDate <= since) {
        break;
      }
      prs.push(pr);
    }
  } else {
    prs = res.values;
  }

  for (let pr of prs) {
    if (currentDepth < options.depth) {
      pr.children = await getPullRequests(
        pr.fromRef.id,
        state,
        undefined,
        0,
        20,
        [],
        currentDepth + 1,
        options
      );
    } else {
      pr.children = [];
    }
  }
  results = (results || []).concat(prs);
  if (
    res.isLastPage ||
    res.nextPageStart === undefined ||
    prs.length < res.values.length
  ) {
    return results;
  } else {
    return getPullRequests(
      branch,
      state,
      since,
      res.nextPageStart,
      size,
      results,
      currentDepth,
      options
    );
  }
}

function getPullRequestsPage(branch, state, start, size, options) {
  return serviceCall(
    `/pull-requests?state=${state}&order=NEWEST&at=${branch}&start=${start}&limit=${size}`,
    options
  );
}

function getCommit(hash, options) {
  return serviceCall(`/commits/${hash}`, options);
}

function serviceCall(url, options) {
  url = `${options.url}${url}`;
  print(url, options);

  return request({
    url,
    headers: {
      accept: 'application/json'
    },
    auth: {
      username: options.username,
      password: options.password
    },
    responseType: 'json'
  }).then(res => res.data);
}

function printTree(prs, indent = 0, options) {
  if (!prs || !options.verbose) return;
  for (let pr of prs) {
    print('    '.repeat(indent) + pr.title, options);
    printTree(pr.children, indent + 1, options);
  }
}

function print(msg, options) {
  if (options.verbose) process.stdout.write(`${msg}\n`);
}
