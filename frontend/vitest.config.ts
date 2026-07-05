import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolve the former sub-packages from TypeScript source (bare import -> source
// entry point, subpath -> package src/). Mirrors the aliases used by the dev
// server and the production build.
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const pkgAliases = [
    ["@shared", "openchat-shared", "src/index.ts"],
    ["@client", "openchat-client", "src/index.ts"],
    ["@agent", "openchat-agent", "src/index.ts"],
    ["@worker", "openchat-worker", "src/worker.ts"],
].flatMap(([alias, dir, entry]) => [
    { find: new RegExp(`^${alias}/(.*)$`), replacement: src(`./${dir}/src/$1`) },
    { find: new RegExp(`^${alias}$`), replacement: src(`./${dir}/${entry}`) },
]);

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: [
            { find: "@dfinity/agent", replacement: "@icp-sdk/core/agent" },
            { find: "@dfinity/auth-client", replacement: "@icp-sdk/auth/client" },
            ...pkgAliases,
            { find: "usergeek-ic-js", replacement: src("./app/test-stubs/usergeek-ic-js.ts") },
        ],
        conditions: process.env.VITEST ? ["browser"] : undefined,
        // Prefer ESM (`module`) entry points. Otherwise svelte-i18n + its
        // intl-messageformat dependency resolve to their CJS builds, where
        // `require("intl-messageformat")` yields the module namespace object
        // (the constructor is on `.default`); svelte-i18n's `new IntlMessageFormat(...)`
        // then throws "o is not a constructor" and ICU messages stay unparsed
        // (literal "{n}"). The ESM builds expose the constructor as the default.
        mainFields: ["module", "browser", "main"],
    },
    test: {
        globals: true,
        environment: "jsdom",
        include: [
            "app/src/**/*.{test,spec}.ts",
            "openchat-shared/src/**/*.{test,spec}.ts",
            "openchat-client/src/**/*.{test,spec}.ts",
            "openchat-agent/src/**/*.{test,spec}.ts",
        ],
        exclude: ["**/node_modules/**", "**/lib/**"],
        server: {
            deps: {
                // Inline svelte-i18n together with its intl-messageformat /
                // @formatjs dependency chain so vitest transforms them through
                // vite (resolving their extensionless ESM imports) instead of
                // loading them natively in node. Loading them natively breaks
                // the default-export interop — svelte-i18n's `new IntlMessageFormat(...)`
                // throws "o is not a constructor" and ICU messages stay unparsed
                // (literal "{n}").
                inline: [/svelte/, /intl-messageformat/, /@formatjs/],
            },
        },
    },
});
