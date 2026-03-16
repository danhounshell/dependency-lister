const chai = require("chai");
const { EventEmitter } = require("events");
const proxyquire = require("proxyquire").noCallThru();

chai.should();

describe("services/npmRegistry", () => {
  function buildServiceWithHttp(fakeGet) {
    const createNpmRegistryService = proxyquire("../../services/npmRegistry", {
      https: { get: fakeGet },
    });

    return createNpmRegistryService();
  }

  function createHttpGetThatResponds(statusCode, body) {
    let capturedUrl;

    const get = (url, callback) => {
      capturedUrl = url;
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.setEncoding = () => {};

      process.nextTick(() => {
        callback(response);
        if (body !== undefined) {
          response.emit("data", body);
        }
        response.emit("end");
      });

      return {
        on() {
          return this;
        },
      };
    };

    return {
      get,
      getCapturedUrl: () => capturedUrl,
    };
  }

  it("returns latest versions by major from npm metadata", async () => {
    const metadata = JSON.stringify({
      versions: {
        "1.0.0": {},
        "1.2.0": {},
        "2.0.0": {},
        "2.1.5": {},
      },
    });
    const httpMock = createHttpGetThatResponds(200, metadata);
    const service = buildServiceWithHttp(httpMock.get);

    const result = await service.getLatestVersionsByMajor("@scope/pkg", []);

    result.should.deep.equal(["2.1.5", "1.2.0"]);
    httpMock.getCapturedUrl().should.equal("https://registry.npmjs.org/@scope%2Fpkg");
  });

  it("falls back to usage versions when registry status is non-200", async () => {
    const httpMock = createHttpGetThatResponds(500, "{}");
    const service = buildServiceWithHttp(httpMock.get);

    const result = await service.getLatestVersionsByMajor("dep", [
      "1.0.0",
      "1.3.0",
      "2.0.1",
      "invalid",
    ]);

    result.should.deep.equal(["2.0.1", "1.3.0"]);
  });

  it("falls back to usage versions when registry payload is invalid json", async () => {
    const httpMock = createHttpGetThatResponds(200, "{");
    const service = buildServiceWithHttp(httpMock.get);

    const result = await service.getLatestVersionsByMajor("dep", ["3.0.0", "3.1.0", "2.5.0"]);

    result.should.deep.equal(["3.1.0", "2.5.0"]);
  });

  it("falls back to usage versions on request error", async () => {
    const get = (url, callback) => {
      const request = {
        on(event, handler) {
          if (event === "error") {
            process.nextTick(() => handler(new Error("network down")));
          }
          return request;
        },
      };

      process.nextTick(() => {
        const response = new EventEmitter();
        response.statusCode = 200;
        response.setEncoding = () => {};
        callback(response);
      });

      return request;
    };

    const service = buildServiceWithHttp(get);

    const result = await service.getLatestVersionsByMajor("dep", ["1.0.0", "1.1.0"]);

    result.should.deep.equal(["1.1.0"]);
  });

  it("returns empty latest versions when metadata has no versions field", async () => {
    const httpMock = createHttpGetThatResponds(
      200,
      JSON.stringify({ distTags: { latest: "1.0.0" } })
    );
    const service = buildServiceWithHttp(httpMock.get);

    const result = await service.getLatestVersionsByMajor("dep", ["0.1.0"]);

    result.should.deep.equal([]);
  });
});
