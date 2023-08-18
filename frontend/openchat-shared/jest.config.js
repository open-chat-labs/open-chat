const baseConfig = require("../jest.config.base");

module.exports = {
    ...baseConfig,
    displayName: "openchat-shared",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-shared/src/**/*.spec.ts"]
}
