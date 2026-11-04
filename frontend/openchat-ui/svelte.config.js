import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { uiScssPrelude } from './scss.mjs';

// every <style lang="scss"> starts with the library's mixins (scss.mjs). svelte-check preprocesses with this (from any
// directory); inside Vite the Svelte plugin uses vite.config.ts's, which carries the same
export default {
  preprocess: vitePreprocess({
    style: { css: { preprocessorOptions: { scss: { additionalData: uiScssPrelude, charset: false } } } },
  }),
};
