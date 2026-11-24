import { SolveReveal } from "./solveReveal.svelte";

describe("revealing a solve", () => {
    test("a solve made here plays the banner first, then the solved view", () => {
        const reveal = new SolveReveal(false);
        reveal.observe(false);
        expect(reveal.view).toBe("board");
        reveal.observe(true);
        expect(reveal.view).toBe("banner");
        reveal.bannerDone();
        expect(reveal.view).toBe("solved");
    });

    test("a puzzle solved before the screen opened shows the solved view at once, with no banner", () => {
        const reveal = new SolveReveal(true);
        expect(reveal.view).toBe("solved");
        reveal.observe(true);
        expect(reveal.view).toBe("solved");
    });

    test("the solved view stays once shown, and the banner never comes back", () => {
        const reveal = new SolveReveal(false);
        reveal.observe(true);
        reveal.bannerDone();
        reveal.observe(false);
        reveal.observe(true);
        expect(reveal.view).toBe("solved");
    });

    test("the banner's end before any solve changes nothing", () => {
        const reveal = new SolveReveal(false);
        reveal.bannerDone();
        expect(reveal.view).toBe("board");
    });
});
