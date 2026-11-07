import {
    fontScaleFor,
    fontSizeOf,
    TEXT_SCALE_MAX,
    TEXT_SCALE_MIN,
    textScaleOf,
    themePrefOf,
} from "./appearance";

describe("the theme", () => {
    test("a theme the design doesn't have shows as the system's", () => {
        expect(themePrefOf("dark")).toBe("dark");
        expect(themePrefOf("light")).toBe("light");
        expect(themePrefOf("system")).toBe("system");
        expect(themePrefOf("signals")).toBe("system");
    });
});

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

describe("the native text scale", () => {
    test("is the font size setting's factor at the platform's default scale", () => {
        expect([0, 1, 2, 3, 4].map((s) => textScaleOf(s as 0 | 1 | 2 | 3 | 4, 1))).toEqual([
            0.75, 0.875, 1, 1.125, 1.25,
        ]);
    });

    test("multiplies the setting by the platform's font scale", () => {
        expect(textScaleOf(2, 1.3)).toBe(1.3);
        expect(textScaleOf(3, 1.2)).toBe(1.35);
        expect(textScaleOf(1, 0.9)).toBe(0.788);
    });

    test("stays within its bounds", () => {
        expect(textScaleOf(4, 3.1)).toBe(TEXT_SCALE_MAX);
        expect(textScaleOf(0, 0.8)).toBe(TEXT_SCALE_MIN);
    });

    test("takes a platform scale that isn't a positive number as the default", () => {
        expect(textScaleOf(3, 0)).toBe(1.125);
        expect(textScaleOf(3, -1)).toBe(1.125);
        expect(textScaleOf(3, Number.NaN)).toBe(1.125);
        expect(textScaleOf(3, Number.POSITIVE_INFINITY)).toBe(1.125);
    });
});
