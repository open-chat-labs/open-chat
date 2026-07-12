// eslint.config.mjs

import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import { dirname } from "path";
import { fileURLToPath } from "url";
import noPagejsDirect from "./eslint-rules/no-pagejs-direct.mjs";
import structureBoundaries from "./eslint-rules/structure-boundaries.mjs";

// __dirname equivalent
const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the ESM-only Svelte plugin via dynamic import
const svelte = await import("eslint-plugin-svelte").then((mod) => mod.default ?? mod);
const svelteParser = await import("svelte-eslint-parser").then((mod) => mod.default ?? mod);

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default defineConfig([
    {
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
            prettier,
            svelte,
            local: { rules: { "no-pagejs-direct": noPagejsDirect, "structure-boundaries": structureBoundaries } },
        },
        extends: compat.extends(
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended",
            "prettier",
        ),
        rules: {
            "@typescript-eslint/no-explicit-any": ["error"],
            "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "local/no-pagejs-direct": "error",
            "local/structure-boundaries": "error",
        },
    },
    // Explicit exceptions: files that are permitted to import page.js directly.
    // navigation.ts owns the routing API; the others bootstrap or register page.js routes,
    // and SlidingModals does a URL-sync replace inside a popstate handler.
    // The Svelte files also need svelte-eslint-parser so tsParser doesn't choke on Svelte syntax.
    {
        files: [
            "app/src/utils/navigation.ts",
            "openchat-client/src/state/path/stores.ts",
        ],
        rules: {
            "local/no-pagejs-direct": "off",
        },
    },
    {
        files: [
            "app/src/desktop/shell/Router.svelte",
            "app/src/mobile/shell/Router.svelte",
            "app/src/mobile/shell/SlidingModals.svelte",
        ],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tsParser,
            },
            globals: {
                ...globals.browser,
                gtag: "readonly",
                PageJS: "readonly",
            },
        },
        rules: {
            "local/no-pagejs-direct": "off",
            // PageJS types and callback signatures use `any`; pre-existing in these files.
            "@typescript-eslint/no-explicit-any": "off",
        },
    },
    // Structure boundaries for all app svelte components. Svelte files are not
    // otherwise linted (pre-consolidation status quo); this block parses them
    // solely to enforce import boundaries, so unrelated recommended rules that
    // would newly fire on svelte are disabled here.
    {
        files: ["app/src/**/*.svelte"],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tsParser,
            },
        },
        rules: {
            // Existing cross-feature imports are tracked as warnings until each
            // is resolved (exports/ surface, chats/core, or a move to shared/).
            "local/structure-boundaries": "warn",
            "no-unused-vars": "off",
            "no-undef": "off",
            "no-self-assign": "off", // svelte reactivity-trigger idiom
            // Pre-existing style in svelte files, which were never linted before
            // this block existed; only the boundary rule is enforced here.
            "no-case-declarations": "off",
            "no-empty": "off",
            "no-useless-escape": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "no-fallthrough": "off",
            "no-async-promise-executor": "off",
            "no-duplicate-case": "off",
            "no-constant-condition": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "prettier/prettier": "off",
        },
    },
    globalIgnores([
        "**/candid/*.ts",
        "**/candid/*.js",
        // Compiled/bundled output — never lint build artifacts.
        "**/lib/**",
        "**/build/**",
        "**/dist/**",
        "**/dist-js/**",
        // Standalone sub-packages with their own tooling and tsconfig. These were
        // not covered by the pre-consolidation per-package lint, so keep them out
        // of the single root lint too.
        "component-lib/**",
        "component-test/**",
        "tauri-plugin-oc/**",
        // Node-side build & tooling scripts (rollup/vite/vitest/svelte configs,
        // codegen, dependency-cruiser, the eslint config itself). These live
        // outside the app source and use Node globals; the old per-package
        // `eslint ./src` never linted them.
        "**/*.config.js",
        "**/*.config.cjs",
        "**/*.config.mjs",
        "**/*.config.ts",
        "**/*.cjs",
        "**/rollup.extras.mjs",
        "**/rollup-plugin-*.mjs",
        "**/build-workers.mjs",
        "**/svelte.config.js",
        "**/.dependency-cruiser.js",
        "eslint.config.mjs",
        "eslint-rules/**",
    ]),
]);
