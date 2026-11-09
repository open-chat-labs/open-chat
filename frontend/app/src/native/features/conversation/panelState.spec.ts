import { KeyboardPanelState, type SearchLeave } from "./panelState.svelte";

const MAX = 500;

function restingPanel(): KeyboardPanelState {
    const panel = new KeyboardPanelState(true);
    panel.setMaxGrow(MAX);
    return panel;
}

function grownPanel(): KeyboardPanelState {
    const panel = restingPanel();
    panel.expand();
    return panel;
}

describe("a pull on the panel's content", () => {
    test("scrolls the content first, then, 6px past its top, drags the panel from there", () => {
        const panel = grownPanel();
        panel.pullStart(100);
        // the content still scrolled: it scrolls
        expect(panel.pullMove(140, 10, 60)).toBe(false);
        expect(panel.pullMove(180, 20, 0)).toBe(false);
        // at its top: within 6px, still the content's
        expect(panel.pullMove(185, 30, 0)).toBe(false);
        expect(panel.grown).toBe(MAX);
        // past it: the panel's, from where the finger is (no jump)
        expect(panel.pullMove(190, 40, 0)).toBe(true);
        expect(panel.dragging).toBe(true);
        expect(panel.grown).toBe(MAX);
        expect(panel.pullMove(290, 50, 0)).toBe(true);
        expect(panel.grown).toBe(MAX - 100);
    });

    test("whose first move is up only scrolls", () => {
        const panel = grownPanel();
        panel.pullStart(100);
        expect(panel.pullMove(90, 10, 0)).toBe(false);
        expect(panel.pullMove(200, 20, 0)).toBe(false);
        expect(panel.pullEnd(30)).toBeUndefined();
    });

    test("let go, settles as the handle's drag does", () => {
        // past f 0.7 down: back to rest
        let panel = grownPanel();
        panel.pullStart(0);
        panel.pullMove(10, 0, 0);
        panel.pullMove(300, 1000, 0);
        expect(panel.pullEnd(1010)).toBe("rest");

        // at rest, pulled down past 80px: closes
        panel = restingPanel();
        panel.pullStart(0);
        panel.pullMove(10, 0, 0);
        panel.pullMove(100, 1000, 0);
        expect(panel.pullEnd(1010)).toBe("close");
        expect(panel.closing).toBe(true);

        // at rest, a short slow pull: springs back
        panel = restingPanel();
        panel.pullStart(0);
        panel.pullMove(10, 0, 0);
        panel.pullMove(40, 1000, 0);
        expect(panel.pullEnd(1010)).toBe("rest");
        expect(panel.closing).toBe(false);
    });
});

describe("the backdrop", () => {
    test("tapped while grown, takes the panel back to rest, not closed", () => {
        const panel = grownPanel();
        expect(panel.veil).toEqual({ opacity: 1, tappable: true });
        panel.veilTapped();
        expect(panel.open).toBe(false);
        expect(panel.closing).toBe(false);
    });

    test("takes no taps at rest", () => {
        const panel = restingPanel();
        panel.veilTapped();
        expect(panel.veil.tappable).toBe(false);
    });

    test("in a search, is on and, tapped, leaves the search at rest", () => {
        const panel = restingPanel();
        const left: SearchLeave[] = [];
        panel.onLeaveSearch = (how) => left.push(how);
        panel.setSearch("strip");
        expect(panel.veil).toEqual({ opacity: 1, tappable: true });
        panel.veilTapped();
        expect(left).toEqual(["rest"]);
    });
});

describe("the emoji search's strip, its handle pulled", () => {
    function strip(): { panel: KeyboardPanelState; left: SearchLeave[] } {
        const panel = restingPanel();
        const left: SearchLeave[] = [];
        panel.onLeaveSearch = (how) => left.push(how);
        panel.setSearch("strip");
        return { panel, left };
    }

    test("follows the finger at its own rates, and grows the sheet when pulled up far enough", () => {
        const { panel, left } = strip();
        panel.dragStart(500, 0);
        panel.dragMove(400, 1000);
        expect(panel.searchOffset).toBe(-24);
        expect(panel.grown).toBe(0);
        expect(panel.dragEnd(1010)).toBe("expand");
        expect(left).toEqual(["expand"]);
        expect(panel.searchOffset).toBe(0);
    });

    test("pulled down far enough, closes the search; a short pull springs back", () => {
        let { panel, left } = strip();
        panel.dragStart(500, 0);
        panel.dragMove(560, 1000);
        expect(panel.searchOffset).toBeCloseTo(36);
        expect(panel.dragEnd(1010)).toBe("close");
        expect(left).toEqual(["close"]);

        ({ panel, left } = strip());
        panel.dragStart(500, 0);
        panel.dragMove(520, 1000);
        expect(panel.dragEnd(1010)).toBe("stay");
        expect(left).toEqual([]);
    });
});

describe("a tap after a drag", () => {
    test("isn't one for 300ms", () => {
        const panel = grownPanel();
        panel.dragStart(0, 0);
        panel.dragMove(50, 1000);
        panel.dragEnd(1010);
        expect(panel.clickGuarded(1200)).toBe(true);
        expect(panel.clickGuarded(1400)).toBe(false);
    });

    test("one that didn't move doesn't hold taps back", () => {
        const panel = grownPanel();
        panel.dragStart(0, 0);
        panel.dragEnd(10);
        expect(panel.clickGuarded(20)).toBe(false);
    });
});

describe("a panel that stops growing (the emoji search's strip)", () => {
    test("goes back to rest and doesn't grow till it may again", () => {
        const panel = grownPanel();
        panel.setExpandable(false);
        expect(panel.open).toBe(false);
        expect(panel.grown).toBe(0);
        panel.expand();
        expect(panel.open).toBe(false);
        panel.setExpandable(true);
        panel.setMaxGrow(MAX);
        panel.expand();
        expect(panel.grown).toBe(MAX);
    });
});
