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
});
