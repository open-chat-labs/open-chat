const baseConfig = require("../jest.config.base");

module.exports = {
    ...baseConfig,
    displayName: "openchat-worker",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-worker/src/**/*.spec.ts"],
    moduleNameMapper: {
        idb: "<rootDir>/openchat-worker/src/dummyModule.js",
    },
};
