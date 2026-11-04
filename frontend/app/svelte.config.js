// svelte.config.js
// The app's Svelte preprocessing, read by the Vite build, vitest (vitest.config.ts) and the language server.
import sveltePreprocess from "svelte-preprocess";
import { uiScssPrelude } from "../openchat-ui/scss.mjs";
import { sassModulesAndMixins } from "./rollup.extras.mjs";

// The legacy trees' scss starts with the app's mixins (src/styles/mixins.scss)
const legacy = sveltePreprocess({
    sourceMap: true,
    scss: {
        prependData: sassModulesAndMixins,
    },
});

// The new UI's (@openchat/ui, src/web) starts with the library's own (openchat-ui/src/lib/styles/_mixins.scss), so the
// library never depends on the legacy app's styles
const ui = sveltePreprocess({
    sourceMap: true,
    scss: {
        prependData: uiScssPrelude,
        charset: false,
    },
});

const NEW_UI = /[\\/](openchat-ui[\\/]src|app[\\/]src[\\/]web)[\\/]/;
const isNewUi = (filename) => NEW_UI.test(filename ?? "");

export default {
    preprocess: {
        markup: legacy.markup,
        script: legacy.script,
        style: (options) => (isNewUi(options.filename) ? ui : legacy).style(options),
    },
    onwarn: (warning, handler) => {
        if (warning.code.startsWith("a11y_")) return;
        handler(warning);
    },
};
