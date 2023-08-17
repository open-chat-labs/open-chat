module.exports = {
    displayName: "openchat-client",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-client/src/**/*.spec.ts"],
    testEnvironment: "jsdom",
    fakeTimers: {
        enableGlobally: true
    },
    transform: {
        "^.+\\.ts$": ["ts-jest", { "isolatedModules": true, "useESM": true }],
        "^.+\\.js$": "babel-jest"
    },
    transformIgnorePatterns: ["/node_modules/(?!(svelte))"],
    moduleFileExtensions: ["js", "ts"],
    moduleNameMapper: {
        "peerjs": "<rootDir>/openchat-client/src/dummyModule.js",
        "openchat-shared": "<rootDir>/openchat-client/src/dummyModule.js",
        "idb": "<rootDir>/src/dummyModule.js",
        "../utils/notifications": "<rootDir>/src/dummyNotifications.js"
    },
    extensionsToTreatAsEsm: [".ts"]
}
