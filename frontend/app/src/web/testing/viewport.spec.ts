import { installMatchMedia, setViewportWidth } from "./viewport";

describe("the matchMedia stand-in", () => {
    beforeAll(() => installMatchMedia());

    test("answers min-width queries from the window's width", () => {
        setViewportWidth(1000);
        const list = window.matchMedia("(min-width: 1200px)");
        expect(list.matches).toBe(false);
        setViewportWidth(1200);
        expect(list.matches).toBe(true);
    });

    test("doesn't match any other query, rather than throwing", () => {
        expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(false);
    });
});
