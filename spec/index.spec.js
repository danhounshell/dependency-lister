const chai = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const proxyquire = require("proxyquire").noCallThru();

chai.should();

describe("index", () => {
  let consoleLogStub;
  let consoleErrorStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    sinon.restore();
  });

  function loadIndexWithStubs(configOverride = {}, behavior = {}) {
    const config = {
      orgNames: ["OrgA"],
      githubToken: "token-123",
      outputPath: "dependencies.json",
      ...configOverride,
    };

    const fetchAllPackageJsons = behavior.fetchAllPackageJsons || sinon.stub().resolves([]);
    const aggregateDependencyUsage = behavior.aggregateDependencyUsage || sinon.stub().returns({});
    const buildDependencyOutput = behavior.buildDependencyOutput || sinon.stub().resolves({});
    const printSummary = behavior.printSummary || sinon.stub();
    const writeFileSync = behavior.writeFileSync || sinon.stub();

    const githubFactory = sinon.stub().returns({ fetchAllPackageJsons });
    const dependencyFactory = sinon.stub().returns({
      aggregateDependencyUsage,
      buildDependencyOutput,
    });
    const summaryFactory = sinon.stub().returns({ printSummary });

    const octokitInstance = { marker: "octokit" };
    const Octokit = sinon.stub().callsFake(function OctokitCtor(opts) {
      this.opts = opts;
      return octokitInstance;
    });

    const mod = proxyquire("../index", {
      "./config": config,
      fs: { writeFileSync },
      "@octokit/rest": { Octokit },
      "./services/githubPackages": githubFactory,
      "./services/dependencyAggregation": dependencyFactory,
      "./services/summary": summaryFactory,
    });

    return {
      mod,
      config,
      stubs: {
        fetchAllPackageJsons,
        aggregateDependencyUsage,
        buildDependencyOutput,
        printSummary,
        writeFileSync,
        githubFactory,
        dependencyFactory,
        summaryFactory,
        Octokit,
      },
      octokitInstance,
    };
  }

  it("returns early when orgNames is not an array", async () => {
    const { mod, stubs } = loadIndexWithStubs({ orgNames: "OrgA" });

    await mod.run();

    consoleLogStub
      .calledWith("orgNames must be an array in config. Please check your config file.")
      .should.equal(true);
    stubs.Octokit.called.should.equal(false);
  });

  it("returns early when orgNames is empty", async () => {
    const { mod, stubs } = loadIndexWithStubs({ orgNames: [] });

    await mod.run();

    consoleLogStub
      .calledWith(
        "No organization names provided in config. Please add org names to the config file."
      )
      .should.equal(true);
    stubs.Octokit.called.should.equal(false);
  });

  it("returns early when github token is missing", async () => {
    const { mod, stubs } = loadIndexWithStubs({ githubToken: "" });

    await mod.run();

    consoleLogStub
      .calledWith(
        "No GitHub token provided in config. Please add a GitHub token to the config file."
      )
      .should.equal(true);
    stubs.Octokit.called.should.equal(false);
  });

  it("processes dependencies and writes output on success", async () => {
    const allPackageJsonResults = [{ orgName: "OrgA", repoName: "repo", packageJson: {} }];
    const allDependencies = { dep: { "1.0.0": ["@orga/repo"] } };
    const output = { dep: { latestVersions: ["1.0.0"], usage: { "1.0.0": ["@orga/repo"] } } };

    const { mod, config, stubs, octokitInstance } = loadIndexWithStubs(
      {},
      {
        fetchAllPackageJsons: sinon.stub().resolves(allPackageJsonResults),
        aggregateDependencyUsage: sinon.stub().returns(allDependencies),
        buildDependencyOutput: sinon.stub().resolves(output),
      }
    );

    await mod.run();

    stubs.Octokit.calledOnce.should.equal(true);
    stubs.Octokit.firstCall.args[0].should.deep.equal({ auth: config.githubToken });
    stubs.fetchAllPackageJsons.calledOnceWithExactly(octokitInstance).should.equal(true);
    stubs.aggregateDependencyUsage.calledOnceWithExactly(allPackageJsonResults).should.equal(true);
    stubs.buildDependencyOutput.calledOnceWithExactly(allDependencies).should.equal(true);
    stubs.writeFileSync.calledOnce.should.equal(true);
    stubs.writeFileSync.firstCall.args[0].should.equal("dependencies.json");
    stubs.writeFileSync.firstCall.args[1].should.equal(JSON.stringify(output, null, 2));
    stubs.printSummary
      .calledOnceWithExactly(allPackageJsonResults.length, 1, allDependencies)
      .should.equal(true);
  });

  it("logs error when processing throws", async () => {
    const { mod } = loadIndexWithStubs(
      {},
      {
        fetchAllPackageJsons: sinon.stub().rejects(new Error("boom")),
      }
    );

    await mod.run();

    consoleErrorStub.calledWith("An error occurred during the process:").should.equal(true);
    consoleErrorStub.calledWith("boom").should.equal(true);
  });

  it("executes run when index is launched as main module", () => {
    const projectRoot = path.resolve(__dirname, "..");
    const localConfigPath = path.join(projectRoot, "config.local.json");
    const backupPath = path.join(projectRoot, "config.local.json.bak-main-test");

    if (fs.existsSync(localConfigPath)) {
      fs.renameSync(localConfigPath, backupPath);
    }

    fs.writeFileSync(localConfigPath, JSON.stringify({ orgNames: [], githubToken: "" }, null, 2));

    try {
      const result = spawnSync(process.execPath, ["index.js"], {
        cwd: projectRoot,
        encoding: "utf8",
      });

      result.status.should.equal(0);
      result.stdout
        .includes(
          "No organization names provided in config. Please add org names to the config file."
        )
        .should.equal(true);
    } finally {
      fs.unlinkSync(localConfigPath);
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, localConfigPath);
      }
    }
  });
});
