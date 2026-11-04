// svelte.config.js
// The app's Svelte preprocessing, read by the Vite build, Rollup's production build, vitest (vitest.config.ts) and the
// language server.
import path from "path";
import { fileURLToPath } from "url";
import sveltePreprocess from "svelte-preprocess";
import { sassModulesAndMixins } from "./rollup.extras.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.join(here, "..", "openchat-ui");

// The legacy trees (and component-lib, which they use) get the app's own mixins (src/styles/mixins.scss) in front of
// every style block. Nothing else does: @openchat/ui and src/web never depend on the legacy styles, and a component
// that uses the library's mixins imports them itself (openchat-ui/src/lib/styles/_mixins.scss).
const LEGACY =
    /[\\/](app[\\/]src[\\/](components|components_mobile|components_shared|core)|component-lib)[\\/]/;
// Rollup passes paths relative to app/, Vite absolute ones
const isLegacy = (filename) => filename !== undefined && LEGACY.test(path.resolve(here, filename));

const legacy = sveltePreprocess({
    sourceMap: true,
    scss: {
        prependData: sassModulesAndMixins,
    },
});

// `@use '@openchat/ui/…'` resolves as the TypeScript alias does: from the library's own folder
const ui = sveltePreprocess({
    sourceMap: true,
    scss: {
        importer: (url) =>
            url.startsWith("@openchat/ui/")
                ? { file: path.join(uiRoot, url.slice("@openchat/ui/".length)) }
                : null,
    },
});

export default {
    preprocess: {
        markup: legacy.markup,
        script: legacy.script,
        style: (options) => (isLegacy(options.filename) ? legacy : ui).style(options),
    },
    onwarn: (warning, handler) => {
        if (warning.code.startsWith("a11y_")) return;
        handler(warning);
    },
};
