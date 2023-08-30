module.exports = {
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
    extensionsToTreatAsEsm: [".ts"]
};
