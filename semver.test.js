const {
  Semver,
  parseSemver,
  incrementVersion,
  getSemverIncrement
} = require('./semver');

const version = {
  label: '4.2.3',
  major: 4,
  minor: 2,
  patch: 3,
  tag: {
    label: '',
    meta: '',
    pre: ''
  }
};

test('parse semver tag', () => {
  const parsed = parseSemver(version.label);
  expect(parsed).toEqual(version);
});

test('parse semver tag with pre-release', () => {
  const v = copy(version, 'alpha.1.2');
  const parsed = parseSemver(v.label);
  expect(parsed).toEqual(v);
});

test('parse semver tag with metadata', () => {
  const v = copy(version, undefined, '44453');
  const parsed = parseSemver(v.label);
  expect(parsed).toEqual(v);
});

test('parse semver tag with pre-release and metadata', () => {
  const v = copy(version, 'alpha.1.2', '44453');
  const parsed = parseSemver(v.label);
  expect(parsed).toEqual(v);
});

test('fail to parse semver tag with invalid version', () => {
  expect(() => parseSemver('4.2')).toThrow('Invalid semver version: 4.2');
});

test('fail to parse semver tag with invalid tag', () => {
  expect(() => parseSemver('4.2.4@invalid')).toThrow(
    'Invalid semver version: 4.2.4@invalid'
  );
});

test('increment semver tag with major', () => {
  const v = incrementVersion(Semver.MAJOR, { current: version });
  expect(v).toEqual({
    label: '5.0.0',
    major: 5,
    minor: 0,
    patch: 0,
    tag: {
      label: '',
      pre: '',
      meta: ''
    }
  });
});

test('increment semver tag with minor', () => {
  const v = incrementVersion(Semver.MINOR, { current: version });
  expect(v).toEqual({
    label: '4.3.0',
    major: 4,
    minor: 3,
    patch: 0,
    tag: {
      label: '',
      pre: '',
      meta: ''
    }
  });
});

test('increment semver tag with patch', () => {
  const v = incrementVersion(Semver.PATCH, { current: version });
  expect(v).toEqual({
    label: '4.2.4',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '',
      pre: '',
      meta: ''
    }
  });
});

test('increment semver tag with pre-release tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    pre: 'foo',
    tags: { chain: [] }
  });
  expect(v).toEqual({
    label: '4.2.4-foo1',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-foo1',
      pre: 'foo1',
      meta: ''
    }
  });
});

test('increment semver tag with existing pre-release tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    pre: 'foo',
    tags: { chain: [{ displayId: `4.2.4-foo1` }] }
  });

  expect(v).toEqual({
    label: '4.2.4-foo2',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-foo2',
      pre: 'foo2',
      meta: ''
    }
  });
});

test('increment semver tag with alpha tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    alpha: true,
    tags: { chain: [] }
  });
  expect(v).toEqual({
    label: '4.2.4-alpha1',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-alpha1',
      pre: 'alpha1',
      meta: ''
    }
  });
});

test('increment semver tag with existing alpha tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    alpha: true,
    tags: { chain: [{ displayId: `4.2.4-alpha1` }] }
  });

  expect(v).toEqual({
    label: '4.2.4-alpha2',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-alpha2',
      pre: 'alpha2',
      meta: ''
    }
  });
});

test('increment semver tag with beta tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    beta: true,
    tags: { chain: [] }
  });
  expect(v).toEqual({
    label: '4.2.4-beta1',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-beta1',
      pre: 'beta1',
      meta: ''
    }
  });
});

test('increment semver tag with existing beta tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    beta: true,
    tags: { chain: [{ displayId: `4.2.4-beta1` }] }
  });

  expect(v).toEqual({
    label: '4.2.4-beta2',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-beta2',
      pre: 'beta2',
      meta: ''
    }
  });
});

test('increment semver tag with meta tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    meta: '44453'
  });
  expect(v).toEqual({
    label: '4.2.4+44453',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '+44453',
      pre: '',
      meta: '44453'
    }
  });
});

test('increment semver tag with pre and meta tag', () => {
  const v = incrementVersion(Semver.PATCH, {
    current: version,
    pre: 'alpha',
    meta: '44453',
    tags: { chain: [] }
  });
  expect(v).toEqual({
    label: '4.2.4-alpha1+44453',
    major: 4,
    minor: 2,
    patch: 4,
    tag: {
      label: '-alpha1+44453',
      pre: 'alpha1',
      meta: '44453'
    }
  });
});

test('find major semver increment', () => {
  const prs = [
    { title: 'Add: 1' },
    { title: 'Fix: 2' },
    { title: 'Doc: 3' },
    { title: 'Break: 4' },
    { title: 'Fix: 5' }
  ];
  const inc = getSemverIncrement(prs);
  expect(inc).toBe(Semver.MAJOR);
});

test('find minor semver increment', () => {
  const prs = [
    { title: 'Add: 1' },
    { title: 'Fix: 2' },
    { title: 'Doc: 3' },
    { title: 'Fix: 4' }
  ];
  const inc = getSemverIncrement(prs);
  expect(inc).toBe(Semver.MINOR);
});

test('find patch semver increment', () => {
  const prs = [{ title: 'Fix: 1' }, { title: 'Doc: 2' }];
  const inc = getSemverIncrement(prs);
  expect(inc).toBe(Semver.PATCH);
});

test('find unknown semver increment when only doc changes', () => {
  const prs = [{ title: 'Doc: 1' }, { title: 'Doc: 2' }];
  const inc = getSemverIncrement(prs);
  expect(inc).toBe(Semver.UNKNOWN);
});

test('fail with invalid pr title', () => {
  const prs = [{ title: 'Fix: 1' }, { title: '2' }];
  expect(() => getSemverIncrement(prs)).toThrow(
    'Invalid pull request title: 2'
  );
});

function copy(v, pre, meta) {
  const v2 = Object.assign({}, v);
  v2.tag = Object.assign({}, v.tag);
  if (pre) {
    v2.label += `-${pre}`;
    v2.tag.label += `-${pre}`;
    v2.tag.pre = pre;
  }
  if (meta) {
    v2.label += `+${meta}`;
    v2.tag.label += `+${meta}`;
    v2.tag.meta = meta;
  }
  return v2;
}
