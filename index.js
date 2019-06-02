const request = require('request-promise');
const {
  SEMVER_TAG_BASE_PATTERN,
  SEMVER_TAG_PATTERN,
  Semver,
  parseSemver,
  getSemverIncrement,
  incrementVersion,
  sortSemver
} = require('./semver');

// If no semver base tag is provided then we search this many
// base tags for the highest found. Usually the first found will
// be the highest but we want to be extra sure we base things correctly.
const MAX_BASE_SEMVER_TAG_SEARCH = 5;

module.exports = execute;
async function execute(options) {
  options = await verifyOptions(options);
  const inc = await findSemverIncrement(options);
  const next = incrementVersion(inc, options);
  return {
    current: options.current,
    next,
    isFirstTag: options.tags.chain.length === 0
  };
}

async function verifyOptions(options) {
  options = options || {};

  if (typeof process !== 'undefined' && process.env) {
    const env = process.env;
    if (!options.url) options.url = env.BITBUCKET_PROJECT_URL;
    if (!options.username) options.username = env.BITBUCKET_USER;
    if (!options.password) {
      options.password = env.BITBUCKET_PASSWORD || env.BITBUCKET_PSWD;
    }
  }
  assert(options.url, 'Bitbucket base url is missing');
  assert(options.username, 'Bitbucket username is missing');
  assert(options.password, 'Bitbucket password is missing');

  if (!options.branch) options.branch = 'master';
  if (!options.branch.startsWith('refs/')) {
    options.branch = `refs/heads/${options.branch}`;
  }

  if (!options.depth || options.depth < 1) options.depth = 1;

  options.tags = await getTagChain(options);

  const { base } = options.tags;
  if (base && base.semver) {
    if (base.semver.major > 0 && options.dev) {
      throw new Error(
        `Semver major of 0 is only permitted during initial development. Current version is "${
          base.semver.label
        }".`
      );
    }
  }

  const label = options.tags.base ? options.tags.base.displayId : '0.0.0';
  options.current = parseSemver(label);

  return options;
}

async function getTagChain(options) {
  const allTags = [];
  let start = 0;
  let bases = [];
  let res;
  do {
    res = await getTagsPage(start, 20, options);
    // filter out any tags which aren't semver
    const tags = (res.values || []).filter(tag =>
      SEMVER_TAG_PATTERN.test(tag.displayId)
    );
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      allTags.push(tag);
      if (SEMVER_TAG_BASE_PATTERN.test(tag.displayId || '')) {
        bases.push({ tag, i: allTags.length - 1 + i });
        if (
          bases.length > MAX_BASE_SEMVER_TAG_SEARCH ||
          (options.current && options.current === tag.displayId)
        ) {
          break;
        }
      }
    }
    start = res.nextPageStart;
  } while (!res.isLastPage && bases.length < MAX_BASE_SEMVER_TAG_SEARCH);

  const versions = bases.map((base, i) => {
    const version = parseSemver(base.tag.displayId);
    version.index = i;
    return version;
  });

  const highestBase = sortSemver(versions)[0];
  if (highestBase) {
    const chain = allTags.slice(0, highestBase.index + 1);
    let tag = chain[0];
    tag.commit = await getCommit(tag.latestCommit, options);
    tag.semver = parseSemver(tag.displayId);
    tag = chain[chain.length - 1];
    if (!tag.commit) {
      tag.commit = await getCommit(tag.latestCommit, options);
      tag.semver = parseSemver(tag.displayId);
    }
    // We attempt to determine if the tag was made on a merged PR commit
    // If it was we parse out the PR's id. This later allows us to exclude
    // any pr that was merged at the same time or before it. This can
    // be more accurate than the timestamp as PR's returned from the RESTful
    // api do not give is the time the merge commit was made, only when
    // the PR was merged. There can be a second or two difference there.
    const match = (tag.commit.message || '').match(
      /^merge pull request #(\d+)/i
    );
    const taggedPrId = match ? Number(match[1]) : undefined;

    return { base: tag, chain, latest: chain[0], taggedPrId };
  }

  return { chain: allTags, latest: allTags[0] };
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
  }).then(data => JSON.parse(data));
}

function printTree(prs, indent = 0, options) {
  if (!prs || !options.verbose) return;
  for (let pr of prs) {
    print('    '.repeat(indent) + `#${pr.id} ${pr.title}`, options);
    printTree(pr.children, indent + 1, options);
  }
}

function print(msg, options) {
  if (options.verbose) process.stdout.write(`${msg}\n`);
}

function assert(truth, message) {
  if (!truth) throw new Error(message);
}
