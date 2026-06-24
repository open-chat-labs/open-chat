// svelte.config.js
import sveltePreprocess from "svelte-preprocess";
import path from "path";
import { mixins } from "./rollup.extras.mjs";

// this file is only used by the svelte language server so don't worry about it too much.
//
// Resolve the global mixins via a Sass load path + a relative `@use`, rather than passing the absolute
// path straight into an `@use` string: svelte-preprocess's Sass can't resolve a bare absolute import
// (and on Windows the backslashes in it are escape sequences that corrupt the path). Giving Sass the
// styles directory as a load path and importing the file by name resolves cleanly on every platform.
// (The Vite build is configured separately in vite.config.ts and is unaffected.)
const stylesDir = path.dirname(mixins).replace(/\\/g, "/");
const prependData = "@use 'sass:math'; @use 'sass:map'; @use 'mixins' as *;";

export default {
    preprocess: sveltePreprocess({
        sourceMap: true,
        scss: {
            // `loadPaths` (modern Sass) and `includePaths` (legacy) — whichever the installed Sass uses.
            loadPaths: [stylesDir],
            includePaths: [stylesDir],
            prependData,
        },
    }),
    onwarn: (warning, handler) => {
        if (warning.code.startsWith("a11y_")) return;
        handler(warning);
    },
};
