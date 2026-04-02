import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const openchatClientSource = fileURLToPath(new URL("../openchat-client/src/index.ts", import.meta.url));
const usergeekStub = fileURLToPath(new URL("./test-stubs/usergeek-ic-js.ts", import.meta.url));

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: {
            "@dfinity/agent": "@icp-sdk/core/agent",
            "@dfinity/auth-client": "@icp-sdk/auth/client",
            "openchat-client": openchatClientSource,
            "usergeek-ic-js": usergeekStub,
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        exclude: ["lib/**", "node_modules/**"],
    },
});
