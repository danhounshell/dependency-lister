const https = require("https");
const semver = require("semver");

module.exports = function createNpmRegistryService() {
  function fetchFromNpmRegistry(packageName) {
    return new Promise((resolve, reject) => {
      const encodedName = packageName.startsWith("@")
        ? `@${encodeURIComponent(packageName.slice(1))}`
        : encodeURIComponent(packageName);
      const url = `https://registry.npmjs.org/${encodedName}`;

      https
        .get(url, (response) => {
          let body = "";
          response.setEncoding("utf8");

          response.on("data", (chunk) => {
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
        .on("error", (error) => reject(error));
    });
  }

  async function getLatestVersionsByMajor(depName, usageVersions) {
    let candidateVersions = [];

    try {
      const metadata = await fetchFromNpmRegistry(depName);
      candidateVersions = Object.keys(metadata.versions || {});
    } catch {
      // Fall back to discovered usage versions when registry metadata is unavailable.
      candidateVersions = usageVersions;
    }

    const validVersions = candidateVersions.filter((version) => semver.valid(version));
    const latestByMajor = {};

    validVersions.forEach((version) => {
      const major = semver.major(version);
      if (!latestByMajor[major] || semver.gt(version, latestByMajor[major])) {
        latestByMajor[major] = version;
      }
    });

    return Object.values(latestByMajor).sort(semver.rcompare);
  }

  return {
    getLatestVersionsByMajor,
  };
};
