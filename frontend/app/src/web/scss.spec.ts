// @vitest-environment node
// Every src/web component styles in SCSS, so @openchat/ui's mixins (prepended by app/svelte.config.js) and nesting
// work in all of them.
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const web = new URL("./", import.meta.url);

test('every style block in src/web is <style lang="scss">', () => {
    const plain = readdirSync(web, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".svelte"))
        .filter((path) =>
            /<style(?![^>]*lang="scss")[^>]*>/.test(readFileSync(new URL(path, web), "utf8")),
        );
    expect(plain).toEqual([]);
});
