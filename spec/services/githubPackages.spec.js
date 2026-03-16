const chai = require("chai");
const sinon = require("sinon");

const createGithubPackagesService = require("../../services/githubPackages");

chai.should();

describe("services/githubPackages", () => {
  let consoleLogStub;
  let consoleErrorStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
    consoleErrorStub = sinon.stub(console, "error");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns empty list when no repo types are enabled", async () => {
    const service = createGithubPackagesService({
      includePublic: false,
      includePrivate: false,
      includeArchived: false,
      includeInternal: false,
      excludedRepos: [],
      orgNames: ["OrgA"],
    });

    const octokit = {
      paginate: sinon.stub(),
      repos: { getContent: sinon.stub() },
    };

    const result = await service.fetchAllPackageJsons(octokit);

    result.should.deep.equal([]);
    octokit.paginate.called.should.equal(false);
    consoleLogStub.calledWith("No repository types selected (public/private). Skipping organization.").should.equal(true);
  });

  it("filters repos and returns parsed package json data", async () => {
    const service = createGithubPackagesService({
      includePublic: true,
      includePrivate: true,
      includeArchived: false,
      includeInternal: false,
      excludedRepos: ["repo-excluded"],
      orgNames: ["OrgA"],
    });

    const allRepos = [
      { name: "repo-good", archived: false, visibility: "public" },
      { name: "repo-excluded", archived: false, visibility: "public" },
      { name: "repo-archived", archived: true, visibility: "public" },
      { name: "repo-internal", archived: false, visibility: "internal" },
      { name: "repo-missing", archived: false, visibility: "public" },
    ];

    const octokit = {
      paginate: sinon.stub().resolves(allRepos),
      repos: {
        getContent: sinon.stub(),
      },
    };

    octokit.repos.getContent
      .withArgs({ owner: "OrgA", repo: "repo-good", path: "package.json" })
      .resolves({
        data: {
          content: Buffer.from(JSON.stringify({ dependencies: { chai: "^4.5.0" } })).toString("base64"),
        },
      });

    octokit.repos.getContent
      .withArgs({ owner: "OrgA", repo: "repo-missing", path: "package.json" })
      .rejects(new Error("not found"));

    const result = await service.fetchAllPackageJsons(octokit);

    result.should.deep.equal([
      {
        orgName: "OrgA",
        repoName: "repo-good",
        packageJson: { dependencies: { chai: "^4.5.0" } },
      },
    ]);
    octokit.paginate.calledOnce.should.equal(true);
  });

  it("returns empty list and logs error when org fetch fails", async () => {
    const service = createGithubPackagesService({
      includePublic: true,
      includePrivate: false,
      includeArchived: false,
      includeInternal: false,
      excludedRepos: [],
      orgNames: ["OrgA"],
    });

    const octokit = {
      paginate: sinon.stub().rejects(new Error("api failure")),
      repos: { getContent: sinon.stub() },
    };

    const result = await service.fetchAllPackageJsons(octokit);

    result.should.deep.equal([]);
    consoleErrorStub.called.should.equal(true);
    consoleErrorStub.firstCall.args[0].should.equal("An error occurred while fetching org OrgA:");
    consoleErrorStub.firstCall.args[1].should.equal("api failure");
  });

  it("supports explicit org list argument", async () => {
    const service = createGithubPackagesService({
      includePublic: true,
      includePrivate: false,
      includeArchived: false,
      includeInternal: false,
      excludedRepos: [],
      orgNames: ["WillNotBeUsed"],
    });

    const octokit = {
      paginate: sinon.stub().resolves([{ name: "repo", archived: false, visibility: "public" }]),
      repos: {
        getContent: sinon.stub().resolves({
          data: { content: Buffer.from(JSON.stringify({})).toString("base64") },
        }),
      },
    };

    const result = await service.fetchAllPackageJsons(octokit, ["OrgB"]);

    result[0].orgName.should.equal("OrgB");
  });

  it("uses private repo type when only private repos are enabled", async () => {
    const service = createGithubPackagesService({
      includePublic: false,
      includePrivate: true,
      includeArchived: false,
      includeInternal: false,
      excludedRepos: [],
      orgNames: ["OrgA"],
    });

    const octokit = {
      paginate: sinon.stub().resolves([]),
      repos: { getContent: sinon.stub() },
    };

    const result = await service.fetchAllPackageJsons(octokit);

    result.should.deep.equal([]);
    octokit.paginate.calledOnce.should.equal(true);
    octokit.paginate.firstCall.args[1].type.should.equal("private");
  });
});
