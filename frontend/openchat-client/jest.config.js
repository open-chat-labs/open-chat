const baseConfig = require("../jest.config.base");

module.exports = {
    ...baseConfig,
    displayName: "openchat-client",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-client/src/**/*.spec.ts"],
    moduleNameMapper: {
        "openchat-shared": "<rootDir>/openchat-client/src/dummyModule.js",
        peerjs: "<rootDir>/openchat-client/src/dummyModule.js",
        "../utils/notifications": "<rootDir>/src/dummyNotifications.js",
    },
};
