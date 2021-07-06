// svelte.config.js
const sveltePreprocess = require("svelte-preprocess");

// this file is only used by the svelte language server so don't worry about it too much

const preprocessOptions = {
    sourceMaps: true,
    defaults: {
        script: "typescript",
        style: "scss",
    },
    scss: {
        prependData: `@import 'v2/frontend/src/styles/mixins.scss';`,
    },
};
module.exports = {
    preprocess: sveltePreprocess(preprocessOptions),
};
