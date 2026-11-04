// Which .svelte sources have a style block that isn't SCSS: the check behind scss.spec.ts here and in the app's src/web.
// A component's <style> tag starts a line; one inside a string or a comment (a docs sample) is indented or mid-line.

const STYLE_TAG = /^<style\b([^>]*)>/gm;
const SCSS = /\blang\s*=\s*(["']?)scss\1(?=[\s>]|$)/;

/** Whether a component's source has a <style> block without lang="scss" (or 'scss', or scss). */
export function hasPlainStyle(source: string): boolean {
  return [...source.matchAll(STYLE_TAG)].some(([, attributes]) => !SCSS.test(attributes));
}
