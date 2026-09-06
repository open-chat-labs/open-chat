// Build-time replacement for the @formatjs/intl-getcanonicallocales polyfill
// that svelte-i18n imports (see the alias in rollup.config.mjs / vite.config.ts).
// Intl.getCanonicalLocales is native in every runtime OpenChat targets
// (Chrome 54+, Safari 10.3+, Android WebView 54+), so the ~250 KB polyfill
// is pure dead weight in the vendor chunk.
export function getCanonicalLocales(locales?: string | string[]): string[] {
    return Intl.getCanonicalLocales(locales);
}
