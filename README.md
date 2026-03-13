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
    "4.17.23": [
      "@yourorg/repo1",
      "@yourorg/repo5"
    ],
    "4.17.21": [
      "@yourorg/repo2",
      "@yourorg/repo4"
    ],
    "4.17.4": [
      "@yourorg/repo3"
    ]
  }
  ... other dependencies
}
```
