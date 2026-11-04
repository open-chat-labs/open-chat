import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { uiScssPrelude } from './scss.mjs';

export default defineConfig({
  plugins: [svelte()],
  // every <style lang="scss"> starts with the library's mixins (scss.mjs). Inside Vite the Svelte plugin preprocesses
  // with this config; svelte.config.js carries the same for svelte-check
  css: { preprocessorOptions: { scss: { additionalData: uiScssPrelude, charset: false } } },
});
