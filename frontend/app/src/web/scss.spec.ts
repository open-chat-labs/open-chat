// @vitest-environment node
// Every src/web component styles in SCSS, so nesting and @openchat/ui's mixins work in all of them.
import { hasPlainStyle } from "@openchat/ui/src/lib/styles/styleBlocks";
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const web = new URL("./", import.meta.url);

test("every style block in src/web is SCSS", () => {
    const plain = readdirSync(web, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".svelte"))
        .filter((path) => hasPlainStyle(readFileSync(new URL(path, web), "utf8")));
    expect(plain).toEqual([]);
});
