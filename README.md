# dependency-lister

Fetches `package.json` files from every repository in one or more GitHub organizations and aggregates all dependency versions into a single `dependencies.json` file. Optionally enriches each dependency with the latest published version for each major semver series.

## Features

- Scans all repos in one or more GitHub organizations
- Aggregates both `dependencies` and `devDependencies`
- Filters repos by visibility (public/private), archived status, and an explicit exclusion list
- Optionally fetches the latest published version per major series from the npm registry

## Requirements

- Node.js >= 22
- A GitHub personal access token with `repo` (or `read:org`) scope

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `config.local.json` in the project root (this file is git-ignored):

   ```json
   {
     "orgNames": ["YourOrg"],
     "githubToken": "your github token goes here",
     "excludedRepos": [],
     "outputPath": "dependencies.json",
     "includePublic": true,
     "includePrivate": true,
     "includeArchived": false,
     "includeInternal": false,
     "includeLatestPackageVersions": false
   }
   ```

   See `example.config.local.js` for a full annotated example.

## Usage

```bash
npm start
```

The output is written to the path specified in `outputPath` in the project root configuration file.

## Scripts

| Script                 | Description                              |
| ---------------------- | ---------------------------------------- |
| `npm start`            | Run the dependency lister                |
| `npm test`             | Lint + unit tests with coverage          |
| `npm run test:unit`    | Unit tests with c8 coverage only         |
| `npm run lint`         | Run ESLint                               |
| `npm run lint:fix`     | Run ESLint and auto-fix issues           |
| `npm run format`       | Format all files with Prettier           |
| `npm run format:check` | Check formatting without writing changes |

## Output format

Outputs json format to the path specified in `outputPath` in the project root configuration file with a format like:

```
{
  ... other dependencies
  "lodash": {
    "latestVersions": [
      "4.17.23",
      "3.10.1",
      "2.4.2"
    ],
    "usage": {
      "4.17.23": [
        "@yourOrg/repo1",
        "@yourOrg/repo5"
      ],
      "4.17.21": [
        "@yourOrg/repo2",
        "@yourOrg/repo4"
      ],
      "4.17.4": [
        "@yourOrg/repo3"
      ]
    }
  }
  ... other dependencies
}
```
