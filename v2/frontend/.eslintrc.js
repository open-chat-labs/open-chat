module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "prettier"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier",
    ],
    rules: {
        "@typescript-eslint/no-explicit-any": [
            "error"
        ],
        "no-unused-vars": ["warn", { "argsIgnorePatter": "^_" }]
    },
};