/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

// this ridiculous thing is used just to stop jest panicking when trying to import svelte-spa-router
export function process() {
    return {
        code: 'module.exports = ""',
    };
}
