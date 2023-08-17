module.exports = {
    displayName: "openchat-shared",
    rootDir: "..",
    testMatch: ["<rootDir>/openchat-shared/src/**/*.spec.ts"],
    testEnvironment: "jsdom",
    fakeTimers: {
        enableGlobally: true
    },
    transform: {
        "^.+\\.ts$": ["ts-jest", { "isolatedModules": true, "useESM": true }],
        "^.+\\.js$": "babel-jest"
    },
    moduleFileExtensions: ["js", "ts"],
    extensionsToTreatAsEsm: [".ts"]
}
