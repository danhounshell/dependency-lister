"use strict";

let config = require("./configs/config.default.js");

function mergeConfig(path) {
  try {
    const otherConfig = require(path);
    config = { ...config, ...otherConfig };
  } /* c8 ignore next */ catch {}
}

mergeConfig("./config.local");

config.identity = [require("os").hostname(), config.name, process.pid].join(".");
module.exports = Object.freeze(config);
