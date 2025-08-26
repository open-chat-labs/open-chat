import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [svelte()],
    test: {
        globals: true,
        environment: "jsdom",
        exclude: ["lib/**"],
        deps: {
            inline: [/svelte/],
        },
    },
    // eslint-disable-next-line no-undef
    resolve: process.env.VITEST
        ? {
              conditions: ["browser"],
          }
        : undefined,
});
