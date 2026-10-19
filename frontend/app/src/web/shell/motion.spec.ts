import { fadeCss, SLOW, slideCss, tokenDuration } from "./motion";

describe("the right column's motion", () => {
    test("runs for the --duration-slow token, in ms or s", () => {
        expect(tokenDuration(" 320ms")).toBe(320);
        expect(tokenDuration(" 0.28s ")).toBe(280);
        expect(tokenDuration("200")).toBe(200);
    });

    test("doesn't run for a token of 0, and falls back without a readable one", () => {
        expect(tokenDuration("0ms")).toBe(0);
        expect(tokenDuration("")).toBe(SLOW);
        expect(tokenDuration("fast")).toBe(SLOW);
    });

    test("slides in from the inline end, over a fading scrim as a modal", () => {
        expect([slideCss(false)(0, 1), slideCss(false)(1, 0)]).toEqual([
            "transform: translateX(100%)",
            "transform: translateX(0%)",
        ]);
        expect(slideCss(true)(0, 1)).toBe("transform: translateX(-100%)");
        expect([fadeCss(0), fadeCss(1)]).toEqual(["opacity: 0", "opacity: 1"]);
    });
});
