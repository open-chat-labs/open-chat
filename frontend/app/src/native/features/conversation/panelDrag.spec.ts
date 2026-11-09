import {
    CLOSE_PULL,
    dragPosition,
    flickVelocity,
    maxGrowFor,
    panelLayers,
    panelVeil,
    pullTakesPanel,
    searchPullEnd,
    searchPullOffset,
    settle,
    type DragPosition,
} from "./panelDrag";

const MAX = 500;
const grown = (n: number): DragPosition => ({ grown: n, pulled: 0 });

describe("a panel under the finger", () => {
    test("grows as it's dragged up, no further than it can", () => {
        expect(dragPosition(0, -120, MAX)).toEqual({ grown: 120, pulled: 0 });
        expect(dragPosition(0, -900, MAX)).toEqual({ grown: MAX, pulled: 0 });
        // from open, down shrinks it
        expect(dragPosition(MAX, 200, MAX)).toEqual({ grown: 300, pulled: 0 });
    });

    test("is pulled down below its resting height", () => {
        expect(dragPosition(0, 50, MAX)).toEqual({ grown: 0, pulled: 50 });
        expect(dragPosition(MAX, MAX + 30, MAX)).toEqual({ grown: 0, pulled: 30 });
    });

    test("that doesn't grow stays at rest dragged up", () => {
        expect(dragPosition(0, -120, 0)).toEqual({ grown: 0, pulled: 0 });
    });
});

describe("a panel let go", () => {
    test("pulled down past 80px, or flicked down from there, closes; else it springs back", () => {
        expect(settle("rest", { grown: 0, pulled: CLOSE_PULL + 1 }, MAX, 0)).toBe("close");
        expect(settle("rest", { grown: 0, pulled: 20 }, MAX, 0.6)).toBe("close");
        expect(settle("rest", { grown: 0, pulled: 40 }, MAX, 0.2)).toBe("rest");
    });

    test("flicked up opens, flicked down goes back to rest", () => {
        expect(settle("rest", grown(40), MAX, -0.6)).toBe("open");
        expect(settle("open", grown(480), MAX, 0.6)).toBe("rest");
    });

    test("from rest, opens past f 0.3", () => {
        expect(settle("rest", grown(0.31 * MAX), MAX, 0)).toBe("open");
        expect(settle("rest", grown(0.29 * MAX), MAX, 0)).toBe("rest");
    });

    test("from open, stays open past f 0.7", () => {
        expect(settle("open", grown(0.71 * MAX), MAX, 0)).toBe("open");
        expect(settle("open", grown(0.69 * MAX), MAX, 0)).toBe("rest");
    });

    test("that doesn't grow only rests or closes", () => {
        expect(settle("rest", grown(0), 0, -2)).toBe("rest");
    });
});

describe("the finger's speed", () => {
    test("is over its last 100ms", () => {
        const moves = [
            { t: 0, y: 0 },
            { t: 200, y: 10 },
            { t: 250, y: 30 },
            { t: 300, y: 60 },
        ];
        expect(flickVelocity(moves)).toBeCloseTo(50 / 100);
        expect(flickVelocity([])).toBe(0);
        expect(flickVelocity([{ t: 5, y: 5 }])).toBe(0);
    });
});

describe("what shows as a panel grows", () => {
    test("the resting content fades out by f 0.4 and stops taking touches past 0.05", () => {
        expect(panelLayers(0)).toMatchObject({ rest: 1, restLive: true, expanded: 0 });
        expect(panelLayers(0.2).rest).toBeCloseTo(0.5);
        expect(panelLayers(0.06).restLive).toBe(false);
        expect(panelLayers(0.4).rest).toBe(0);
    });

    test("the expanded content fades in from 0.4 to 0.8, taking touches from 0.8", () => {
        expect(panelLayers(0.6).expanded).toBeCloseTo(0.5);
        expect(panelLayers(0.79).expandedLive).toBe(false);
        expect(panelLayers(0.8)).toMatchObject({ expanded: 1, expandedLive: true });
    });

    test("the shadow is .45 × min(1, 3f)", () => {
        expect(panelLayers(0).shadow).toBe(0);
        expect(panelLayers(0.1).shadow).toBeCloseTo(0.135);
        expect(panelLayers(0.5).shadow).toBeCloseTo(0.45);
    });
});

describe("how far a panel grows", () => {
    test("to 90% of the screen, from its bottom", () => {
        expect(maxGrowFor(1000, 300)).toBe(600);
        // resting above that already: not at all
        expect(maxGrowFor(300, 280)).toBe(0);
    });
});

describe("the backdrop", () => {
    test("is min(1, 1.4f), taking taps from f 0.02", () => {
        expect(panelVeil(0, false)).toEqual({ opacity: 0, tappable: false });
        expect(panelVeil(0.02, false).tappable).toBe(false);
        expect(panelVeil(0.03, false).tappable).toBe(true);
        expect(panelVeil(0.5, false).opacity).toBeCloseTo(0.7);
        expect(panelVeil(0.8, false)).toEqual({ opacity: 1, tappable: true });
    });

    test("is fully on in a search, at rest too", () => {
        expect(panelVeil(0, true)).toEqual({ opacity: 1, tappable: true });
    });
});

describe("a pull on the content", () => {
    test("takes the panel at the content's top, past 6px down", () => {
        expect(pullTakesPanel({ firstUp: false, scrollTop: 0, fromTop: 7 })).toBe(true);
        expect(pullTakesPanel({ firstUp: false, scrollTop: 0, fromTop: 6 })).toBe(false);
        expect(pullTakesPanel({ firstUp: false, scrollTop: 30, fromTop: 40 })).toBe(false);
    });

    test("only scrolls when its first move is up", () => {
        expect(pullTakesPanel({ firstUp: true, scrollTop: 0, fromTop: 40 })).toBe(false);
    });
});

describe("the emoji search's handle", () => {
    test("moves the strip down at 0.6x and up at 0.3x, 24px at most", () => {
        expect(searchPullOffset(50)).toBeCloseTo(30);
        expect(searchPullOffset(-40)).toBeCloseTo(-12);
        expect(searchPullOffset(-200)).toBe(-24);
    });

    test("pulled up past 40px or flicked up, grows; down, closes the search; else stays", () => {
        expect(searchPullEnd(-41, 0)).toBe("expand");
        expect(searchPullEnd(-10, -0.6)).toBe("expand");
        expect(searchPullEnd(41, 0)).toBe("close");
        expect(searchPullEnd(10, 0.6)).toBe("close");
        expect(searchPullEnd(30, 0.1)).toBe("stay");
    });
});
