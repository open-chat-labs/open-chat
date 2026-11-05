// @vitest-environment node
// Every src/native component styles in SCSS, so nesting and @openchat/ui's mixins work in all of them.
import { hasPlainStyle } from "@openchat/ui/src/lib/styles/styleBlocks";
import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

const native = new URL("./", import.meta.url);

test("every style block in src/native is SCSS", () => {
    const plain = readdirSync(native, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".svelte"))
        .filter((path) => hasPlainStyle(readFileSync(new URL(path, native), "utf8")));
    expect(plain).toEqual([]);
});
