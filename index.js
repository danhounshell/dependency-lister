const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const config = require("./config");

const githubPackagesService = require("./services/githubPackages")( config );
const dependencyAggregationService = require("./services/dependencyAggregation")( config );
const summaryService = require("./services/summary")( config, dependencyAggregationService );

async function run() {
  if (config.orgNames.length === 0) {
    console.log("No organization names provided in config. Please add org names to the config file.");
    return;
  }

  if (!config.githubToken) {
    console.log("No GitHub token provided in config. Please add a GitHub token to the config file.");
    return;
  }

  try {
    const octokit = new Octokit({ auth: config.githubToken });

    const allPackageJsonResults = await githubPackagesService.fetchAllPackageJsons(octokit);

    const allDependencies = dependencyAggregationService.aggregateDependencyUsage(allPackageJsonResults);
    const output = await dependencyAggregationService.buildDependencyOutput(allDependencies);

    fs.writeFileSync("dependencies.json", JSON.stringify(output, null, 2));

    summaryService.printSummary(
      allPackageJsonResults.length,
      Object.keys(allDependencies).length,
      allDependencies
    );
  } catch (error) {
    console.error("An error occurred during the process:");
    console.error(error.message);
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  run,
};