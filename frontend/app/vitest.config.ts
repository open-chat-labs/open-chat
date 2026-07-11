import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p) => fileURLToPath(new URL(p, import.meta.url));
const usergeekStub = src("./test-stubs/usergeek-ic-js.ts");

const pkgAliases = [
    ["@shared", "openchat-shared", "src/index.ts"],
    ["@client", "openchat-client", "src/index.ts"],
    ["@agent", "openchat-agent", "src/index.ts"],
    ["@worker", "openchat-worker", "src/worker.ts"],
].flatMap(([alias, dir, entry]) => [
    { find: new RegExp(`^${alias}/(.*)$`), replacement: src(`../${dir}/src/$1`) },
    { find: new RegExp(`^${alias}$`), replacement: src(`../${dir}/${entry}`) },
]);

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: [
            { find: "@dfinity/agent", replacement: "@icp-sdk/core/agent" },
            { find: "@dfinity/auth-client", replacement: "@icp-sdk/auth/client" },
            ...pkgAliases,
            { find: "usergeek-ic-js", replacement: usergeekStub },
        ],
    },
    test: {
        globals: true,
        environment: "jsdom",
        exclude: ["lib/**", "node_modules/**"],
    },
});
