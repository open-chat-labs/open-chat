import { describe, expect, test } from "vitest";
import { nativeViewport } from "./viewport";

const base = "width=device-width, initial-scale=1";

describe("the native tree's viewport", () => {
    test("on iOS a field taking the focus doesn't zoom the page; elsewhere pinch-zoom is left alone", () => {
        expect(nativeViewport(base, true)).toBe(`${base}, maximum-scale=1`);
        expect(nativeViewport(base, false)).toBe(base);
        // the tree mounting again doesn't add it twice
        expect(nativeViewport(nativeViewport(base, true), true)).toBe(`${base}, maximum-scale=1`);
    });
});
