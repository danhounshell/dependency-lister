module.exports = function createGithubPackagesService(config) {
  function getRepoType() {
    if (config.includePublic && config.includePrivate) {
      return "all";
    }
    if (config.includePublic) {
      return "public";
    }
    if (config.includePrivate) {
      return "private";
    }
    return "none";
  }

  async function fetchOrgPackageJsons(octokit, orgName) {
    console.log(`\nFetching repositories for organization: ${orgName}...`);

    const repoType = getRepoType();
    if (repoType === "none") {
      console.log("No repository types selected (public/private). Skipping organization.");
      return [];
    }

    try {
      const allRepos = await octokit.paginate("GET /orgs/{org}/repos", {
        org: orgName,
        type: repoType,
        per_page: 100,
      });

      const repos = allRepos.filter(
        (repo) =>
          (!repo.archived || config.includeArchived) &&
          (repo.visibility !== "internal" || config.includeInternal) &&
          !config.excludedRepos.includes(repo.name)
      );

      console.log(
        `Found ${repos.length} repositories (filtered from ${allRepos.length} total). Fetching package.json files...`
      );

      const packageJsonResults = [];

      for (const repo of repos) {
        try {
          const response = await octokit.repos.getContent({
            owner: orgName,
            repo: repo.name,
            path: "package.json",
          });

          if (response.data.content) {
            const content = Buffer.from(response.data.content, "base64").toString("utf-8");
            const packageJson = JSON.parse(content);

            packageJsonResults.push({
              orgName,
              repoName: repo.name,
              packageJson,
            });
          }
        } catch {
          // package.json not found in repo or inaccessible; skip silently.
        }
      }

      return packageJsonResults;
    } catch (error) {
      console.error(`An error occurred while fetching org ${orgName}:`, error.message);
      return [];
    }
  }

  async function fetchAllPackageJsons(octokit, orgNames = config.orgNames) {
    const allPackageJsons = [];

    for (const orgName of orgNames) {
      const orgResults = await fetchOrgPackageJsons(octokit, orgName);
      allPackageJsons.push(...orgResults);
    }

    return allPackageJsons;
  }

  return {
    fetchAllPackageJsons,
  };
};
