# Bitbucket Semver

A tool to use with [Bitbucket Server](https://www.atlassian.com/software/bitbucket/server) to automatically determine the next [Semver](http://semver.org/) version of a repository based on merged pull requests.

Best when used together with the [Semver Pull Request Checker Plugin](https://marketplace.atlassian.com/plugins/mikestead.bitbucket.bitbucket-semver/server/overview) to enforce Semver labels on all pull request.

### Installation

You must be running Node v7.3+

    yarn global add bitbucket-semver

### Usage

```
  Usage: bbsemver [options]


  Options:

    -V, --version              output the version number
    --url [url]                butbucket project url e.g. https://bitbucket.company.com/projects/foo/repos/bar
    -u, --username [username]  bitbucket username. Can be defined via BITBUCKET_USER env variable
    -p, --password [password]  bitbucket password. Can be defined via BITBUCKET_PASSWORD env variable
    -b, --branch [name]        root branch to scan for merged pull requests since last release. Defaults to "master"
    -c, --current [version]    current semver version. If undefined will be searched for in tag history.
    --alpha                    add an alpha pre-release tag
    --beta                     add a beta pre-release tag
    --pre [tag]                add a custom pre-release tag
    --meta [tag]               add a metadata tag
    --json                     output incremented version in json format
    --dev                      maintain a semver major of zero during initial development
    -d, --depth [int]          depth of child pull requests to walk. Defaults to 1 which inspects PRs merged into the root branch only
    -v, --verbose              enable verbose logging
    -h, --help                 output usage information
```