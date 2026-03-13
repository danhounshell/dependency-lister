
const { Octokit } = require("@octokit/rest");
const config = require("./config");

const { 
  orgNames: ORG_NAMES,
  githubToken: GITHUB_TOKEN,
  excludedRepos: EXCLUDED_REPOS,
  includePublic: INCLUDE_PUBLIC,
  includePrivate: INCLUDE_PRIVATE,
  includeArchived: INCLUDE_ARCHIVED,
  includeInternal: INCLUDE_INTERNAL
} = config;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

async function fetchOrgRepos(orgName) {
  console.log(`\nFetching repositories for organization: ${orgName}...`);

  try {
    const repoTypes = INCLUDE_PUBLIC && INCLUDE_PRIVATE ? "all" : (INCLUDE_PUBLIC ? "public" : (INCLUDE_PRIVATE ? "private" : "none"));
    if (repoTypes === "none") {
      console.log("No repository types selected (public/private). Skipping organization.");
      return [];
    }
    // List all repositories for the organization, Octokit handles pagination
    const allRepos = await octokit.paginate("GET /orgs/{org}/repos", {
      org: orgName,
      type: repoTypes, // "all" for both public and private repos
      per_page: 100
    });

    // Filter: exclude archived, internal, and explicitly excluded repositories
    const repos = allRepos.filter(repo =>
      ( !repo.archived || INCLUDE_ARCHIVED ) &&
      ( repo.visibility !== 'internal' || INCLUDE_INTERNAL ) &&
      !EXCLUDED_REPOS.includes(repo.name)
    );

    console.log(`Found ${repos.length} repositories (filtered from ${allRepos.length} total). Fetching package.json files...`);

    const packageJsonResults = [];

    // Iterate through repositories and fetch package.json content
    for (const repo of repos) {
      try {
        // Get repository content for package.json
        const response = await octokit.repos.getContent({
          owner: orgName,
          repo: repo.name,
          path: "package.json",
        });

        // The content is returned in Base64 encoding and is in the 'content' field
        if (response.data.content) {
          const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
          const packageJson = JSON.parse(content);
          packageJsonResults.push({
            orgName: orgName,
            repoName: repo.name,
            packageJson: packageJson,
          });
          //console.log(`Successfully fetched package.json for ${repo.name}`);
        }
      } catch (error) {
        // This likely means the file does not exist in the repo
        // console.log(`package.json not found in ${repo.name} or an error occurred`);
      }
    }

    return packageJsonResults;
  } catch (error) {
    console.error(`An error occurred while fetching org ${orgName}:`, error.message);
    return [];
  }
}

async function getDependenciesFromAllRepos() {
  try {
    const fs = require('fs');
    let allPackageJsonResults = [];

    if (ORG_NAMES.length === 0) {
      console.log("No organization names provided in config. Please add org names to the config file.");
      return;
    }

    if (!GITHUB_TOKEN) {
      console.log("No GitHub token provided in config. Please add a GitHub token to the config file.");
      return;
    }

    // Fetch repos from all organizations
    for (const orgName of ORG_NAMES) {
      const orgResults = await fetchOrgRepos(orgName);
      allPackageJsonResults = allPackageJsonResults.concat(orgResults);
    }

    // Aggregate all dependencies
    const allDependencies = {};

    allPackageJsonResults.forEach(result => {
      const { orgName, repoName, packageJson } = result;
      const fullRepoName = `@${orgName.toLowerCase()}/${repoName}`;

      // Process both dependencies and devDependencies
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [depName, versionString] of Object.entries(deps)) {
        // Extract clean version number (remove ^, ~, >, <, =, *, etc.)
        const cleanVersion = versionString.replace(/^[^\d]*/, '').split(/[\s,]/)[0];

        if (!allDependencies[depName]) {
          allDependencies[depName] = {};
        }
        if (!allDependencies[depName][cleanVersion]) {
          allDependencies[depName][cleanVersion] = [];
        }
        allDependencies[depName][cleanVersion].push(fullRepoName);
      }
    });

    // compare semantic versions
    function compareSemver(a, b) {
      const aParts = a.split('.').map(x => parseInt(x, 10) || 0);
      const bParts = b.split('.').map(x => parseInt(x, 10) || 0);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        if (aPart !== bPart) {
          return bPart - aPart; // Descending order (newest first)
        }
      }
      return 0;
    }

    // Sort dependencies alphabetically and versions from newest to oldest
    const sortedDependencies = {};
    Object.keys(allDependencies)
      .sort()
      .forEach(depName => {
        sortedDependencies[depName] = {};
        Object.keys(allDependencies[depName])
          .sort(compareSemver)
          .forEach(version => {
            sortedDependencies[depName][version] = allDependencies[depName][version].sort();
          });
      });

    // Save to JSON file
    fs.writeFileSync('dependencies.json', JSON.stringify(sortedDependencies, null, 2));

    // Display statistics
    console.log("\n--- Dependency Aggregation Complete ---");
    console.log(`✓ Organizations processed: ${ORG_NAMES.join(', ')}`);
    console.log(`✓ Successfully fetched ${allPackageJsonResults.length} package.json files`);
    console.log(`✓ Found ${Object.keys(allDependencies).length} unique dependencies`);
    console.log(`✓ Saved to dependencies.json`);

    // Show top 10 most used dependencies
    const depStats = Object.entries(allDependencies)
      .map(([name, versions]) => ({
        name,
        repos: new Set(Object.values(versions).flat()).size,
        versionCount: Object.keys(versions).length
      }))
      .sort((a, b) => b.repos - a.repos)
      .slice(0, 10);

    console.log("\nTop 10 most used dependencies:");
    depStats.forEach((dep, i) => {
      console.log(`  ${i + 1}. ${dep.name}: ${dep.repos} repos, ${dep.versionCount} version(s)`);
    });

  } catch (error) {
    console.error("An error occurred during the process:");
    console.error(error.message);
  }
}

getDependenciesFromAllRepos();