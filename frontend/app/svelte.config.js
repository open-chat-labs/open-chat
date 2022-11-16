// svelte.config.js
const sveltePreprocess = require("svelte-preprocess");
const path = require("path");

const mixins = path.join(__dirname, "src", "styles", "mixins.scss");

// this file is only used by the svelte language server so don't worry about it too much

const preprocessOptions = {
    sourceMaps: true,
    defaults: {
        script: "typescript",
        style: "scss",
    },
    scss: {
        // prependData: `@import 'v2/frontend/src/styles/mixins.scss';`,
        prependData: `@use 'sass:math'; @import '${mixins}';`,
    },
    onwarn: (warning, handler) => {
        if (warning.code.startsWith("a11y-")) return;
        handler(warning);
    },
};
module.exports = {
    preprocess: sveltePreprocess(preprocessOptions),
};
