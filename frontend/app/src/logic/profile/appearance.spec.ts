import { fontScaleFor, fontSizeOf } from "./appearance";

describe("the profile's font sizes", () => {
    test("are the font scale's steps 1 to 4", () => {
        expect([1, 2, 3, 4].map((s) => fontSizeOf(s as 1 | 2 | 3 | 4))).toEqual([
            "small",
            "default",
            "large",
            "larger",
        ]);
        expect(fontScaleFor("small", 2)).toBe(1);
        expect(fontScaleFor("larger", 2)).toBe(4);
    });

    test("show the smallest scale as small, and keep it until another size is picked", () => {
        expect(fontSizeOf(0)).toBe("small");
        expect(fontScaleFor("small", 0)).toBe(0);
        expect(fontScaleFor("default", 0)).toBe(2);
    });
});
