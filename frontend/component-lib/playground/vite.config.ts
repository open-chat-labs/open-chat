import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
    root: path.resolve(__dirname),
    plugins: [svelte()],
    resolve: {
        alias: {
            "@components": path.resolve(__dirname, "../src/components"),
        },
    },
    server: {
        port: 5174,
    },
});
