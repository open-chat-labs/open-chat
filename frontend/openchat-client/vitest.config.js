import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const usergeekStub = fileURLToPath(new URL("./test-stubs/usergeek-ic-js.ts", import.meta.url));

export default defineConfig({
    plugins: [svelte()],
    resolve: {
        alias: {
            "usergeek-ic-js": usergeekStub,
        },
        // eslint-disable-next-line no-undef
        conditions: process.env.VITEST ? ["browser"] : undefined,
    },
    test: {
        globals: true,
        environment: "jsdom",
        exclude: ["lib/**"],
        deps: {
            inline: [/svelte/],
        },
    },
});
