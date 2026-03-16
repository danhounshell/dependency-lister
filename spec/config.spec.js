const chai = require("chai");
const fs = require("fs");
const path = require("path");

chai.should();

describe("config", () => {
  const configModulePath = path.resolve(__dirname, "../config.js");
  const localConfigPath = path.resolve(__dirname, "../config.local.json");
  const tempLocalConfigPath = path.resolve(__dirname, "../config.local.json.bak-test");

  function clearConfigCache() {
    delete require.cache[configModulePath];
  }

  afterEach(() => {
    clearConfigCache();
    if (fs.existsSync(tempLocalConfigPath)) {
      fs.renameSync(tempLocalConfigPath, localConfigPath);
    }
  });

  it("loads config and sets identity and freeze", () => {
    clearConfigCache();
    const config = require("../config");

    Object.isFrozen(config).should.equal(true);
    config.identity.should.be.a("string");
    config.identity.includes(String(process.pid)).should.equal(true);
    config.identity.includes(config.name).should.equal(true);
  });

  it("handles missing local config without throwing", () => {
    if (fs.existsSync(localConfigPath)) {
      fs.renameSync(localConfigPath, tempLocalConfigPath);
    }

    clearConfigCache();
    const config = require("../config");

    config.should.be.an("object");
    config.identity.should.be.a("string");
    Object.isFrozen(config).should.equal(true);
  });
});
