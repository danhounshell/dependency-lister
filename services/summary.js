module.exports = function createSummaryService(config, dependencyAggregationService) {
  const { getTopDependencyStats } = dependencyAggregationService;

  function printSummary(packageJsonCount, uniqueDependencyCount, allDependencies) {
    console.log("\n--- Dependency Aggregation Complete ---");
    console.log(`✓ Organizations processed: ${config.orgNames.join(", ")}`);
    console.log(`✓ Successfully fetched ${packageJsonCount} package.json files`);
    console.log(`✓ Found ${uniqueDependencyCount} unique dependencies`);
    console.log("✓ Saved to dependencies.json");

    const depStats = getTopDependencyStats(allDependencies, 10);
    console.log("\nTop 10 most used dependencies:");
    depStats.forEach((dep, i) => {
      console.log(`  ${i + 1}. ${dep.name}: ${dep.repos} repos, ${dep.versionCount} version(s)`);
    });
  }

  return {
    printSummary,
  };
};
