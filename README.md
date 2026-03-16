Lists out all dependendencies for all repos in an Organization or multiple
Can filter repos to public, private or both
Can exlude archived or internal repos

example config.local.json
```
{
	"orgNames": [ "YourOrg" ],
	"githubToken": "your github token goes here",
	"excludedRepos": [],
	"includePublic": true,
	"includePrivate": true,
	"includeArchived": false,
	"includeInternal": false
}
```

Outputs `dependencies.json` file with a format like: 
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
