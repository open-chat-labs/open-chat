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
            local: { rules: { "no-pagejs-direct": noPagejsDirect } },
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
            "app/src/components/Router.svelte",
            "app/src/components_mobile/Router.svelte",
            "app/src/components_mobile/home/SlidingModals.svelte",
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
    globalIgnores(["**/candid/*.ts", "**/candid/*.js"]),
]);
