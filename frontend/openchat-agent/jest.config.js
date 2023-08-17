module.exports = {
    displayName: "openchat-agent",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-agent/src/**/*.spec.ts"],
    testEnvironment: "jsdom",
    fakeTimers: {
        enableGlobally: true
    },
    transform: {
        "^.+\\.ts$": ["ts-jest", { "isolatedModules": true, "useESM": true }],
        "^.+\\.js$": "babel-jest"
    },
    moduleFileExtensions: ["js", "ts"],
    moduleNameMapper: {
        "idb": "<rootDir>/openchat-agent/src/dummyModule.js"
    },
    extensionsToTreatAsEsm: [".ts"]
}
