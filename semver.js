const SEMVER_TAG_PATTERN = /^(\d+)\.(\d+)\.(\d+)([-+](.+))?$/;
const TITLE_PATTERN = /^(major|minor|patch|break|add|fix|doc):?\s.+$/i;

const Semver = {
  MAJOR: 1,
  BREAK: 1,
  MINOR: 2,
  ADD: 2,
  PATCH: 3,
  FIX: 3,
  DOC: 40, // support but ignore benign PRs with only documentation changes
  UNKNOWN: 40
};

function parseSemver(version) {
  const match = version.match(SEMVER_TAG_PATTERN);
  if (!match) throw new Error(`Invalid semver version: ${version}`);
  const tag = match[4] || '';
  const i = tag.indexOf('-');
  const j = tag.indexOf('+');
  const pre = i === 0 ? tag.slice(i + 1, j === -1 ? tag.length : j) : '';
  const meta = ~j ? tag.slice(j + 1) : '';

  return {
    label: version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    tag: {
      label: tag,
      pre,
      meta
    }
  };
}

function getSemverIncrement(prs) {
  let result = Semver.UNKNOWN;
  for (const pr of prs) {
    const match = (pr.title || '').match(TITLE_PATTERN);
    if (match) {
      const tag = (match[1] || '').toUpperCase();
      const weight = Semver[tag];
      if (weight && weight < result) {
        result = weight;
      }
    } else {
      throw new Error(`Invalid pull request title: ${pr.title}`);
    }
  }
  return result;
}

function incrementVersion(inc, options) {
  // const label = options.tags.base ? options.tags.base.displayId : '1.0.0';
  // options.current = parseSemver(label);
  const updated = Object.assign({}, options.current);

  updated.tag = { label: '', pre: '', meta: '' };
  if (inc === Semver.MAJOR) {
    if (updated.major > 0) {
      updated.major++;
      updated.minor = 0;
      updated.patch = 0;
    } else {
      updated.minor++;
      updated.patch = 0;
    }
  } else if (inc === Semver.MINOR) {
    updated.minor++;
    updated.patch = 0;
  } else if (inc === Semver.PATCH) {
    updated.patch++;
  }
  updated.label = `${updated.major}.${updated.minor}.${updated.patch}`;

  if (options.pre) updatePreRelease(updated, options.pre, options);
  else if (options.beta) updatePreRelease(updated, 'beta', options);
  else if (options.alpha) updatePreRelease(updated, 'alpha', options);

  if (options.meta) {
    updated.tag.meta = options.meta;
    updated.tag.label += `+${options.meta}`;
    updated.label += `+${options.meta}`;
  }
  return updated;
}

function updatePreRelease(updated, type, options) {
  const lastPre = findLatestPreRelease(updated.label, type, options);
  const pre = lastPre ? `${type}${lastPre.index + 1}` : `${type}1`;
  updated.tag.pre = pre;
  updated.tag.label = `-${pre}`;
  updated.label += updated.tag.label;
  return updated;
}

function findLatestPreRelease(label, tag, options) {
  const { chain } = options.tags;
  const pattern = new RegExp(`^${label}-${tag}(\\d+)$`);
  const pre = `${label}-${tag}`;
  for (let tag of chain) {
    const match = tag.displayId.match(pattern);
    if (match) {
      return {
        label: tag.displayId,
        index: Number(match[1])
      };
    }
  }
  return undefined;
}

exports.SEMVER_TAG_PATTERN = SEMVER_TAG_PATTERN;
exports.Semver = Semver;
exports.parseSemver = parseSemver;
exports.getSemverIncrement = getSemverIncrement;
exports.incrementVersion = incrementVersion;
