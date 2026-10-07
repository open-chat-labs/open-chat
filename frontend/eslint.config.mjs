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
            // New state uses runes or the custom stores in openchat-client/src/utils/stores.ts.
            // Type-only imports stay allowed: the custom stores implement svelte/store's contract.
            "@typescript-eslint/no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "svelte/store",
                            allowTypeImports: true,
                            message:
                                "Use runes or the custom stores in openchat-client/src/utils/stores.ts (see frontend/CLAUDE.md).",
                        },
                    ],
                },
            ],
        },
    },
    // The app reaches the worker and agent only through the client, and the client only through its entry point.
    {
        files: ["app/src/**/*.ts", "app/src/**/*.svelte"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@agent", "@agent/*", "@worker", "@worker/*", "**/openchat-agent/**", "**/openchat-worker/**"],
                            message: "The app talks to the agent and worker only through @client.",
                        },
                        {
                            group: ["@client/*", "**/openchat-client/**"],
                            message: "Import from @client, not from a path inside it.",
                        },
                    ],
                },
            ],
        },
    },
    // Specs may reach inside the client to build its internal state; the agent and worker stay off limits.
    {
        files: ["app/src/**/*.spec.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@agent", "@agent/*", "@worker", "@worker/*", "**/openchat-agent/**", "**/openchat-worker/**"],
                            message: "The app talks to the agent and worker only through @client.",
                        },
                    ],
                },
            ],
        },
    },
    // Files that used svelte/store before the rule. Move each to runes or the custom stores when you touch it,
    // then take it off this list. Never add to it.
    {
        files: [
            "app/src/actions/longpress.ts",
            "app/src/actions/translatable.ts",
            "app/src/components/home/ExternalContent.spec.ts",
            "app/src/components/home/MemeBuilder.spec.ts",
            "app/src/components_shared/calendar/weekdays.ts",
            "app/src/i18n/i18n.ts",
            "app/src/i18n/localeFallback.spec.ts",
            "app/src/i18n/storedLocale.spec.ts",
            "app/src/stores/androidInterfaceSizes.ts",
            "app/src/stores/automation.ts",
            "app/src/stores/chatListView.ts",
            "app/src/stores/chatShortcuts.ts",
            "app/src/stores/messageToForward.ts",
            "app/src/stores/pendingShare.ts",
            "app/src/stores/pinNumber.ts",
            "app/src/stores/proposalSections.ts",
            "app/src/stores/proposalVotes.ts",
            "app/src/stores/quickReactions.ts",
            "app/src/stores/rtl.ts",
            "app/src/stores/search.svelte.ts",
            "app/src/stores/snow.ts",
            "app/src/stores/solana/walletStore.ts",
            "app/src/stores/time.ts",
            "app/src/stores/toast.ts",
            "app/src/stores/video.call.spec.ts",
            "app/src/stores/video.spec.ts",
            "app/src/stores/video.ts",
            "app/src/stores/xframe.ts",
            "app/src/theme/themeV2.ts",
            "app/src/theme/themes.ts",
            "app/src/utils/access.ts",
            "app/src/utils/dailyPuzzle.svelte.ts",
            "app/src/utils/native/call_bridge.spec.ts",
            "app/src/utils/native/share_target.ts",
            "app/src/utils/navigation.ts",
            "app/src/utils/share.ts",
            "app/src/utils/store.ts",
            "app/src/utils/user.ts",
            "openchat-client/src/openchat.ts",
            "openchat-client/src/state/app/appStores.spec.ts",
            "openchat-client/src/stores/background.ts",
            "openchat-client/src/stores/dummyStore.ts",
            "openchat-client/src/stores/i18n.spec.ts",
            "openchat-client/src/stores/immutable.ts",
            "openchat-client/src/stores/lastOnlineDates.ts",
            "openchat-client/src/stores/mapStore.spec.ts",
            "openchat-client/src/stores/minutesOnline.ts",
            "openchat-client/src/stores/network.ts",
            "openchat-client/src/stores/profiling.ts",
            "openchat-client/src/stores/rules.ts",
            "openchat-client/src/stores/safeWritable.ts",
            "openchat-client/src/stores/throttling.ts",
            "openchat-client/src/stores/typing.ts",
            "openchat-client/src/utils/cryptoFormatter.ts",
            "openchat-client/src/utils/poller.ts",
            "openchat-client/src/utils/rtc.ts",
            "openchat-client/src/utils/stores.spec.ts",
            "openchat-client/src/utils/user.spec.ts",
        ],
        rules: {
            "@typescript-eslint/no-restricted-imports": "off",
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
    // Lint every Svelte component with the same rules as the .ts files.
    {
        files: ["**/*.svelte"],
        languageOptions: {
            parser: svelteParser,
            parserOptions: {
                parser: tsParser,
                extraFileExtensions: [".svelte"],
            },
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            // TypeScript already reports undefined names, and no-undef doesn't know the DOM types
            // (NodeListOf, CanvasImageSource). typescript-eslint turns it off for .ts files for the same reason.
            "no-undef": "off",
            // typescript-eslint switches these on for .ts files only; components get them too.
            "no-var": "error",
            "prefer-rest-params": "error",
            "prefer-spread": "error",
            // Not prefer-const: it flags `let { ... } = $props()` and `let x = $derived(...)`, which Svelte writes
            // with `let` (5,990 hits). svelte/prefer-const from eslint-plugin-svelte understands runes.
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
        "**/scripts/*.mjs",
        "**/svelte.config.js",
        "**/.dependency-cruiser.js",
        "eslint.config.mjs",
        "eslint-rules/**",
    ]),
]);
