const chai = require("chai");

chai.should();

describe("configs/config.default", () => {
  it("exports expected default settings", () => {
    const configDefault = require("../../configs/config.default");

    configDefault.should.include({
      name: "dependency-manager",
      githubToken: "",
      includePublic: true,
      includePrivate: true,
      includeArchived: false,
      includeInternal: false,
      includeLatestPackageVersions: false,
    });
    configDefault.orgNames.should.be.an("array");
    configDefault.should.have.property("excludedRepos");
  });
});
