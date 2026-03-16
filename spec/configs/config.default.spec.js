const chai = require("chai");

chai.should();

describe("configs/config.default", () => {
  it("exports expected default settings", () => {
    const configDefault = require("../../configs/config.default");

    configDefault.should.include({
      name: "dependency-lister",
      githubToken: "",
      outputPath: "dependencies.json",
      includePublic: true,
      includePrivate: true,
      includeArchived: false,
      includeInternal: false,
      includeLatestPackageVersions: false,
    });
    configDefault.orgNames.should.be.an("array");
    configDefault.excludedRepos.should.be.an("array");
  });
});
