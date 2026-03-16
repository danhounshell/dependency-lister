const semver = require("semver");
const createNpmRegistryService = require("./npmRegistry");

module.exports = function createDependencyAggregationService(config) {
  const npmRegistryService = createNpmRegistryService(config);

  function getCleanVersion(versionString) {
    return versionString.replace(/^[^\d]*/, "").split(/[\s,]/)[0];
  }

  function aggregateDependencyUsage(packageJsonResults) {
    const allDependencies = {};

    packageJsonResults.forEach(result => {
      const { orgName, repoName, packageJson } = result;
      const fullRepoName = `@${orgName.toLowerCase()}/${repoName}`;
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [depName, versionString] of Object.entries(deps)) {
        const cleanVersion = getCleanVersion(versionString);

        if (!allDependencies[depName]) {
          allDependencies[depName] = {};
        }
        if (!allDependencies[depName][cleanVersion]) {
          allDependencies[depName][cleanVersion] = [];
        }

        allDependencies[depName][cleanVersion].push(fullRepoName);
      }
    });

    return allDependencies;
  }

  function compareUsageVersions(a, b) {
    if (semver.valid(a) && semver.valid(b)) {
      return semver.rcompare(a, b);
    }
    return b.localeCompare(a);
  }

  async function buildDependencyOutput(allDependencies) {
    const dependencyNames = Object.keys(allDependencies).sort();
    const sortedDependencies = {};

    for (const depName of dependencyNames) {
      const usageVersions = Object.keys(allDependencies[depName]);
      const latestVersions = config.includeLatestPackageVersions
        ? await npmRegistryService.getLatestVersionsByMajor(depName, usageVersions)
        : [];

      const usage = {};
      usageVersions
        .sort(compareUsageVersions)
        .forEach(version => {
          usage[version] = allDependencies[depName][version].sort();
        });

      sortedDependencies[depName] = {
        latestVersions,
        usage,
      };
    }

    return sortedDependencies;
  }

  function getTopDependencyStats(allDependencies, count) {
    return Object.entries(allDependencies)
      .map(([name, versions]) => ({
        name,
        repos: new Set(Object.values(versions).flat()).size,
        versionCount: Object.keys(versions).length,
      }))
      .sort((a, b) => b.repos - a.repos)
      .slice(0, count);
  }

  return {
    aggregateDependencyUsage,
    buildDependencyOutput,
    getTopDependencyStats,
  };
};
