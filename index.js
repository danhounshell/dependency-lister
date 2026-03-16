
const { Octokit } = require("@octokit/rest");
const config = require("./config");
const https = require("https");
const semver = require("semver");

const { 
  orgNames: ORG_NAMES,
  githubToken: GITHUB_TOKEN,
  excludedRepos: EXCLUDED_REPOS,
  includePublic: INCLUDE_PUBLIC,
  includePrivate: INCLUDE_PRIVATE,
  includeArchived: INCLUDE_ARCHIVED,
  includeInternal: INCLUDE_INTERNAL, 
  includeLatestPackageVersions: INCLUDE_LATEST_PACKAGE_VERSIONS
} = config;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

function fetchFromNpmRegistry(packageName) {
  return new Promise((resolve, reject) => {
    const encodedName = packageName.startsWith("@")
      ? `@${encodeURIComponent(packageName.slice(1))}`
      : encodeURIComponent(packageName);
    const url = `https://registry.npmjs.org/${encodedName}`;

    https
      .get(url, response => {
        let body = "";
        response.setEncoding("utf8");

        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`Registry request failed with status ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Failed to parse registry response: ${error.message}`));
          }
        });
      })
      .on("error", error => reject(error));
  });
}

async function getLatestVersionsByMajor(depName, usageVersions) {
  let candidateVersions = [];

  try {
    const metadata = await fetchFromNpmRegistry(depName);
    candidateVersions = Object.keys(metadata.versions || {});
  } catch (error) {
    // Fallback to discovered usage versions when registry metadata is unavailable.
    candidateVersions = usageVersions;
  }

  const validVersions = candidateVersions.filter(version => semver.valid(version));
  const latestByMajor = {};

  validVersions.forEach(version => {
    const major = semver.major(version);
    if (!latestByMajor[major] || semver.gt(version, latestByMajor[major])) {
      latestByMajor[major] = version;
    }
  });

  return Object.values(latestByMajor).sort(semver.rcompare);
}

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

    const dependencyNames = Object.keys(allDependencies).sort();

    // Build output with latest version per major and sorted usage map.
    const sortedDependencies = {};
    for (const depName of dependencyNames) {
      const usageVersions = Object.keys(allDependencies[depName]);
      let latestVersions = [];
      if ( INCLUDE_LATEST_PACKAGE_VERSIONS ) {
        latestVersions = await getLatestVersionsByMajor(depName, usageVersions);
      }

      const usage = {};
      usageVersions
        .sort((a, b) => {
          if (semver.valid(a) && semver.valid(b)) {
            return semver.rcompare(a, b);
          }
          return b.localeCompare(a);
        })
        .forEach(version => {
          usage[version] = allDependencies[depName][version].sort();
        });

      sortedDependencies[depName] = {
        latestVersions,
        usage,
      };
    }

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