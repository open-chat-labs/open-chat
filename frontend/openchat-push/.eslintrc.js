module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint", "prettier"],
    extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
    rules: {
        "@typescript-eslint/no-explicit-any": ["error"],
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
};
