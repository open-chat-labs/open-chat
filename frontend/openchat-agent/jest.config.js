const baseConfig = require("../jest.config.base");

module.exports = {
    ...baseConfig,
    displayName: "openchat-agent",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-agent/src/**/*.spec.ts"],
    moduleNameMapper: {
        "idb": "<rootDir>/openchat-agent/src/dummyModule.js"
    }
}
