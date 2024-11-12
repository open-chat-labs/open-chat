// preprocess-test.js
const fs = require("fs");
const sveltePreprocess = require("svelte-preprocess");
const { preprocess } = require("svelte/compiler");

console.log(__dirname);
const code = fs.readFileSync("./src/components/calendar/calendarState.svelte.ts", "utf-8");

preprocess(
    code,
    sveltePreprocess({
        sourceMap: true,
        scss: {
            prependData: `@use 'sass:math'; @import 'src/styles/mixins.scss';`,
        },
    }),
)
    .then((result) => console.log(result.code))
    .catch(console.error);
