// svelte.config.js
import sveltePreprocess from "svelte-preprocess";
import path from "path";
import { sassModulesAndMixins } from "./rollup.extras.mjs";

// this file is only used by the svelte language server so don't worry about it too much
export default {
    preprocess: sveltePreprocess({
        sourceMap: true,
        scss: {
            prependData: sassModulesAndMixins,
        },
        onwarn: (warning, handler) => {
            if (warning.code.startsWith("a11y-")) return;
            handler(warning);
        },
    }),
};
