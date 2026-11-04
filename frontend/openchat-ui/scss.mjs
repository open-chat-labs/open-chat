// The Sass every component style block starts with: the library's mixins (src/lib/styles/_mixins.scss), so a
// component uses them without importing. Shared by the library's vite.config.ts and the app's svelte.config.js.
import { fileURLToPath, URL } from 'node:url';

export const uiMixins = fileURLToPath(new URL('./src/lib/styles/_mixins.scss', import.meta.url));
export const uiScssPrelude = `@use '${uiMixins.replace(/\\/g, '/')}' as *;`;
