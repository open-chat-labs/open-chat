module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "prettier", "svelte"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    ignorePatterns: ["**/candid/*.ts", "**/candid/*.js"],
    rules: {
        "@typescript-eslint/no-explicit-any": ["error"],
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
    overrides: [
        {
            files: ["*.svelte"],
            processor: "svelte/svelte",
        },
    ],
};
