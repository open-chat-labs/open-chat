import { defineConfig, type PluginOption } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { createHtmlPlugin } from 'vite-plugin-html'
import replace from "@rollup/plugin-replace";
import dfxJson from "../../dfx.json";
import { sassModulesAndMixins, generateCspForScripts, initEnv, __dirname } from './rollup.extras.mjs';
import path from "path";

const version = undefined;
const inlineScripts = [
    `window.OC_WEBSITE_VERSION = "${version}";`,
];

initEnv();

// TODO use vite for prod build!
// https://vite.dev/config/
export default defineConfig({
    envPrefix: "OC_",
    server: {
        cors: true,
        hmr: {
            host: "localhost",
            protocol: "ws",
        },
        proxy: {
            '/api': `http://${dfxJson.networks.local.bind}`
        }
    },
    plugins: [
        svelte() as PluginOption,
        replace({
            'process.env': 'import.meta.env',
            preventAssignment: true
        }),
        createHtmlPlugin({
            minify: true,
            entry: './src/main.ts',
            inject: {
                data: {
                    injectScript: inlineScripts.map((s) => `<script>${s}</script>`).join(""),
                    csp: `<meta http-equiv="Content-Security-Policy" content="${generateCspForScripts(inlineScripts, true)}" />`,
                }
            }
        })
    ],
    resolve: {
        alias: {
            "@src": path.resolve(__dirname, "./src"),
            "@actions": path.resolve(__dirname, "./src/actions"),
            "@components": path.resolve(__dirname, "./src/components"),
            "@i18n": path.resolve(__dirname, "./src/i18n"),
            "@stores": path.resolve(__dirname, "./src/stores"),
            "@theme": path.resolve(__dirname, "./src/theme"),
            "@utils": path.resolve(__dirname, "./src/utils"),
            "@styles": path.resolve(__dirname, "./src/styles")
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: sassModulesAndMixins,
            }
        }
    }
})
