import { accentOf } from "./accent";

describe("the stored accent", () => {
    test("is the one picked", () => {
        expect(accentOf("blue")).toBe("blue");
        expect(accentOf("green")).toBe("green");
    });

    test("is the design's default without one, or for one the design doesn't have", () => {
        expect(accentOf(null)).toBe("pink");
        expect(accentOf("teal")).toBe("pink");
    });
});
