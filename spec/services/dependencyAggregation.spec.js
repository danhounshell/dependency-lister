const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

chai.should();

let consoleWarnStub;

beforeEach(() => {
  consoleWarnStub = sinon.stub(console, "warn");
});

afterEach(() => {
  sinon.restore();
});

describe("services/dependencyAggregation", () => {
  function createService(
    configOverride = {},
    latestStub = sinon.stub().resolves(["2.0.0", "1.9.9"])
  ) {
    const createNpmRegistryService = sinon.stub().returns({
      getLatestVersionsByMajor: latestStub,
    });

    const createDependencyAggregationService = proxyquire("../../services/dependencyAggregation", {
      "./npmRegistry": createNpmRegistryService,
    });

    const config = {
      includeLatestPackageVersions: true,
      ...configOverride,
    };

    const service = createDependencyAggregationService(config);
    return { service, latestStub, createNpmRegistryService };
  }

  it("aggregates dependency usage from dependencies and devDependencies", () => {
    const { service } = createService();

    const result = service.aggregateDependencyUsage([
      {
        orgName: "OrgA",
        repoName: "repo1",
        packageJson: {
          dependencies: {
            a: "^1.2.3",
          },
          devDependencies: {
            b: "~2.0.0",
            c: ">=3.1.0 <4",
          },
        },
      },
      {
        orgName: "OrgA",
        repoName: "repo2",
        packageJson: {
          dependencies: {
            a: "1.2.3",
          },
          devDependencies: {},
        },
      },
    ]);

    result.should.deep.equal({
      a: {
        "1.2.3": ["@orga/repo1", "@orga/repo2"],
      },
      b: {
        "2.0.0": ["@orga/repo1"],
      },
      c: {
        "3.1.0": ["@orga/repo1"],
      },
    });
  });

  it("handles packageJson with no dependencies or devDependencies fields", () => {
    const { service } = createService();

    const result = service.aggregateDependencyUsage([
      {
        orgName: "OrgA",
        repoName: "repo1",
        packageJson: {},
      },
    ]);

    result.should.deep.equal({});
  });

  it("deduplicates repos when same package appears in dependencies and devDependencies", () => {
    const { service } = createService();

    const result = service.aggregateDependencyUsage([
      {
        orgName: "OrgA",
        repoName: "repo1",
        packageJson: {
          dependencies: { shared: "1.0.0" },
          devDependencies: { shared: "1.0.0" },
        },
      },
    ]);

    result.shared["1.0.0"].should.deep.equal(["@orga/repo1"]);
  });

  it("records both versions when same package has different versions in dependencies and devDependencies", () => {
    const { service } = createService();

    const result = service.aggregateDependencyUsage([
      {
        orgName: "OrgA",
        repoName: "repo1",
        packageJson: {
          dependencies: { pkg: "1.0.0" },
          devDependencies: { pkg: "2.0.0" },
        },
      },
    ]);

    result.pkg.should.have.property("1.0.0");
    result.pkg.should.have.property("2.0.0");
  });

  it("skips and warns for unrecognized version specifiers", () => {
    const { service } = createService();

    const result = service.aggregateDependencyUsage([
      {
        orgName: "OrgA",
        repoName: "repo1",
        packageJson: {
          dependencies: { valid: "^1.0.0", ws: "workspace:*" },
          devDependencies: {},
        },
      },
    ]);

    result.should.have.property("valid");
    result.should.not.have.property("ws");
    consoleWarnStub.calledOnce.should.equal(true);
    consoleWarnStub.firstCall.args[0].should.include("workspace:*");
  });

  it("builds output with latest versions when enabled", async () => {
    const latestStub = sinon.stub();
    latestStub.onCall(0).resolves(["4.0.0", "3.2.1"]);
    latestStub.onCall(1).resolves(["2.0.0"]);

    const { service } = createService({ includeLatestPackageVersions: true }, latestStub);

    const allDependencies = {
      beta: {
        "2.0.0": ["r2"],
        "1.1.0": ["r1"],
      },
      alpha: {
        "4.0.0": ["r2", "r1"],
        "3.2.1": ["r3"],
        "workspace:*": ["r4"],
      },
    };

    const output = await service.buildDependencyOutput(allDependencies);

    Object.keys(output).should.deep.equal(["alpha", "beta"]);
    output.alpha.latestVersions.should.deep.equal(["4.0.0", "3.2.1"]);
    output.beta.latestVersions.should.deep.equal(["2.0.0"]);
    Object.keys(output.alpha.usage)[0].should.equal("workspace:*");
    output.alpha.usage["4.0.0"].should.deep.equal(["r1", "r2"]);
    latestStub.calledTwice.should.equal(true);
  });

  it("builds output with empty latestVersions when disabled", async () => {
    const latestStub = sinon.stub().resolves(["should-not-be-used"]);
    const { service } = createService({ includeLatestPackageVersions: false }, latestStub);

    const output = await service.buildDependencyOutput({
      dep: {
        "1.0.0": ["repo"],
      },
    });

    output.dep.latestVersions.should.deep.equal([]);
    latestStub.called.should.equal(false);
  });

  it("computes top dependency stats", () => {
    const { service } = createService();

    const stats = service.getTopDependencyStats(
      {
        alpha: {
          "1.0.0": ["r1", "r2"],
          "2.0.0": ["r2", "r3"],
        },
        beta: {
          "1.0.0": ["r1"],
        },
      },
      2
    );

    stats[0].name.should.equal("alpha");
    stats[0].repos.should.equal(3);
    stats[0].versionCount.should.equal(2);
    stats[1].name.should.equal("beta");
  });

  it("initializes npm registry service with config", () => {
    const latestStub = sinon.stub().resolves([]);
    const createNpmRegistryService = sinon.stub().returns({ getLatestVersionsByMajor: latestStub });

    const createDependencyAggregationService = proxyquire("../../services/dependencyAggregation", {
      "./npmRegistry": createNpmRegistryService,
    });

    const config = { includeLatestPackageVersions: true, marker: "x" };
    createDependencyAggregationService(config);

    createNpmRegistryService.calledOnceWithExactly(config).should.equal(true);
  });
});
