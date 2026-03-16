const chai = require("chai");
const sinon = require("sinon");

const createSummaryService = require("../../services/summary");

chai.should();

describe("services/summary", () => {
  let consoleLogStub;

  beforeEach(() => {
    consoleLogStub = sinon.stub(console, "log");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("prints summary and top dependency stats", () => {
    const dependencyAggregationService = {
      getTopDependencyStats: sinon.stub().returns([
        { name: "dep-a", repos: 4, versionCount: 2 },
        { name: "dep-b", repos: 2, versionCount: 1 },
      ]),
    };

    const service = createSummaryService(
      { orgNames: ["OrgA", "OrgB"] },
      dependencyAggregationService
    );

    service.printSummary(10, 3, { dep: {} });

    consoleLogStub.calledWith("\n--- Dependency Aggregation Complete ---").should.equal(true);
    consoleLogStub.calledWith("✓ Organizations processed: OrgA, OrgB").should.equal(true);
    consoleLogStub.calledWith("✓ Successfully fetched 10 package.json files").should.equal(true);
    consoleLogStub.calledWith("✓ Found 3 unique dependencies").should.equal(true);
    consoleLogStub.calledWith("✓ Saved to dependencies.json").should.equal(true);
    consoleLogStub.calledWith("\nTop 10 most used dependencies:").should.equal(true);
    consoleLogStub.calledWith("  1. dep-a: 4 repos, 2 version(s)").should.equal(true);
    consoleLogStub.calledWith("  2. dep-b: 2 repos, 1 version(s)").should.equal(true);
    dependencyAggregationService.getTopDependencyStats.calledOnceWithExactly({ dep: {} }, 10).should.equal(true);
  });
});
