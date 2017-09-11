# Bitbucket Semver

[![Build Status](https://travis-ci.org/mikestead/bitbucket-semver.svg?branch=master)](https://travis-ci.org/mikestead/bitbucket-semver)

A tool for [Bitbucket Server](https://www.atlassian.com/software/bitbucket/server) to automatically determine the next [Semver](http://semver.org/) version of a repository based on merged pull requests.

Best when used together with the [Semver Pull Request Checker Plugin](https://marketplace.atlassian.com/plugins/mikestead.bitbucket.bitbucket-semver/server/overview) to enforce Semver labels on all pull requests.

### Installation

via yarn

    yarn global add bitbucket-semver

or npm

    npm install bitbucket-semver --global

*You must be running Node v7.6+*

### Usage

    bbsemver \
        --url https://bitbucket.company.com/projects/foo/repos/bar \
        --username bitbucket-username \
        --password bitbucket-password

Any of these parameters may also be provided via environment variables.

- `BITBUCKET_PROJECT_URL`
- `BITBUCKET_USER`
- `BITBUCKET_PASSWORD`

The output of this command will be the incremented semver version printed to stdout (e.g. `1.3.6`) or if unchanged then the string `unchanged`. Both return an exit code of `0`.

If you want to see verbose output add the `-v` option. With this enabled you can look at the last line of output to determine the version.

Here's an example of how a bash script may look which calls this, assuming all environment variables are set.

```bash
echo "determining Semver version based on merged pull requests"
output="$(bbsemver -v)"
echo "$output"
# get new version from the last line of output
semverVersion=$(echo "$output" | tail -n1)

# if there's no version change then exit
if [ "$semverVersion" = "unchanged" ]; then
  echo "no version change found, aborting release"
  exit 0
fi

# otherwise we can use the version to generate a changelog, tag a release etc.
# e.g. if versioning an npm package
npm version $semverVersion
```

### Versioning

Bitbucket Semver works based on the previous highest *non pre-release* tag of your repository. We'll call this a *base* tag.

Examples

- base:   `1.0.0`
- base:   `1.0.0+metadata`
- non-base: `1.0.0-rc.1`
- non-base: `1.0.0-beta.1+metadata`

Given a base tag, it will examine the titles of merged pull requests (PRs) to a target branch since this tag was created. By default the target branch is `master` but you may override it via the `--branch [name]` option.

For each merged PR title it looks for one of the following keyword prefixes.

- `Major`: Breaking change
- `Minor`: Backwards compatible feature
- `Patch`: Backwards compatible fix
- `Upkeep`: General housekeeping which doesn't require a release e.g. improved tests or documentation.

**If any merged PR is discovered without a semver title prefix then the tool will exit with code `1` printing the offending PR title.**

Note that we'd prefer to look for semver _labels_ on a PR but these are [still unsupported](https://bitbucket.org/site/master/issues/11976/ability-to-add-labels-to-pull-requests-bb#). 

Scanning of pull requests will go one level deep unless a custom depth is specified via the `--depth [depth]` option. This means that any PR merged directly to `master` will be examined but any PR merged to another branch which then merged to master won't.

The reason for this default is to ensure high accuracy. For example a `major` PR may have been opened and merged to another branch months previously. If the branch it merged into only just made its way to master but in that time the `major` it referred to has already gone in via another PR then we'd end up with an invalid `major` bump. This issue is exacerbated by the inability to edit the metadata of a merged PR in Bitbucket Server.

You may feel this is an unduly cautious setting so are free to define your own more liberal scanning depth. Remember though that the semver tag on a PR going into `master` should reflect any PR's which have merged into it.

Here are some examples of generated version increments based on merged PRs.

    1.0.0
    - patch
    - patch
    > bbsemver
    = 1.0.1

    1.0.0
    - patch
    - minor
    - patch
    > bbsemver
    = 1.1.0

    1.0.0
    - minor
    - major
    - patch
    > bbsemver
    = 2.0.0

#### Pre-release

A pre-release can be generated via one of the following options.

- `--alpha`
- `--beta`
- `--rc`
- `--pre [tag]`

The first three will add their respective pre-release tag to the base version, the last allows for a custom tag.

For any of these options a count will also be added to the tag. This will auto increment if the same pre-release is applied to the same calculated version.

It's important to note that *each pre-release tag is generated from all merged PRs since the last full (base) release*. If the semver increment increases between two consecutive pre-releases of the same type then the pre-release counter is reset to `1`.

Here's an example to help clarify.

    1.0.0
    - patch
    - patch
    > bbsemver --beta
    = 1.0.1-beta.1
    - patch
    > bbsemver --beta
    = 1.0.1-beta.2
    - minor
    - patch
    > bbsemver --beta
    = 1.1.0-beta.1

#### Metadata

You can add metadata to the outputted version via the `--meta [tag]` option.

    1.0.0
    - patch
    > bbsemver --meta build21
    = 1.0.1+build21

### CLI Options

```
  Usage: bbsemver [options]


  Options:

    -V, --version              output the version number
    --url [url]                bitbucket project url e.g. https://bitbucket.company.com/projects/foo/repos/bar
    -u, --username [username]  bitbucket username. Can be defined via BITBUCKET_USER env variable
    -p, --password [password]  bitbucket password. Can be defined via BITBUCKET_PASSWORD env variable
    -b, --branch [name]        root branch to scan for merged pull requests since last release. Defaults to "master"
    -c, --current [version]    current base semver version. If undefined will be searched for in tag history.
    --alpha                    add an alpha pre-release tag
    --beta                     add a beta pre-release tag
    --rc                       add a release candidate (rc) pre-release tag
    --pre [tag]                add a custom pre-release tag
    --meta [tag]               add a metadata tag
    --json                     output incremented version in json format
    --dev                      maintain a semver major of zero during initial development
    -d, --depth [int]          depth of child pull requests to walk. Defaults to 1 which inspects PRs merged into the root branch only
    -v, --verbose              enable verbose logging
    -h, --help                 output usage information
```

### Programmatic Usage

For JavaScript developers you can also use the library programmatically.

```javascript
const bbsemver = require('bitbucket-semver')
bbsemver({
  url: 'https://bitbucket.company.com/projects/foo/repos/bar',
  username: 'bitbucket-username',
  password: 'bitbucket-password'
})
.then({ current, next, isFirstTag } => {
  console.log(current, next, isFirstTag)
})
.catch(error => {
  console.error(error)
})
```

#### Options

```
/**
 * bitbucket project url e.g. https://bitbucket.company.com/projects/foo/repos/bar
 */
url: string
/**
 * bitbucket username. Can be defined via BITBUCKET_USER env variable
 */
username: string
/**
 * bitbucket password. Can be defined via BITBUCKET_PASSWORD env variable
 */
password: string
/**
 * root branch to scan for merged pull requests since last release. Defaults to "master"
 */
branch: string
/**
 * current base semver version. If undefined will be searched for in tag history.
 */
current: string
/**
 * add an alpha pre-release tag
 */
alpha: boolean
/**
 * add a beta pre-release tag
 */
beta: boolean
/**
 * add a release candidate (rc) pre-release tag
 */
rc: boolean
/**
 * add a custom pre-release tag
 */
pre: string
/**
 * add a metadata tag
 */
meta: string
/**
 * maintain a semver major of zero during initial development
 */
dev: boolean
/**
 * depth of child pull requests to walk. Defaults to 1 which inspects PRs merged into the root branch only
 */
depth: number
/**
 * enable verbose logging
 */
verbose: boolean
```
