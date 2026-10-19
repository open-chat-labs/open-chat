import { fadeCss, growCss, motionDuration, SLOW, slideCss } from "./motion";

describe("the right column's motion", () => {
    test("runs for the --duration-slow token, or its fallback without one", () => {
        expect(motionDuration(false, " 320ms")).toBe(320);
        expect(motionDuration(false, "")).toBe(SLOW);
    });

    test("doesn't run across the docking width or with reduced motion", () => {
        expect(motionDuration(true, "320ms")).toBe(0);
    });

    test("docked, the column grows to its width", () => {
        const css = growCss(425);
        expect([css(0), css(0.5), css(1)]).toEqual(["width: 0px", "width: 212.5px", "width: 425px"]);
    });

    test("as a modal, the sheet comes in from the inline end over a fading scrim", () => {
        expect([slideCss(false)(0, 1), slideCss(false)(1, 0)]).toEqual([
            "transform: translateX(100%)",
            "transform: translateX(0%)",
        ]);
        expect(slideCss(true)(0, 1)).toBe("transform: translateX(-100%)");
        expect([fadeCss(0), fadeCss(1)]).toEqual(["opacity: 0", "opacity: 1"]);
    });
});
