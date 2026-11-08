import { pullTakesPanel } from "./panelDrag";
import { KeyboardPanelState } from "./panelState.svelte";

const MAX = 500;

function grownPanel(): KeyboardPanelState {
    const panel = new KeyboardPanelState(true);
    panel.setMaxGrow(MAX);
    panel.expand();
    return panel;
}

describe("a pull on a grown panel's content", () => {
    test("hands over only at the content's top, moving down, the panel grown", () => {
        expect(pullTakesPanel({ open: true, scrollTop: 0, dy: 4 })).toBe(true);
        expect(pullTakesPanel({ open: true, scrollTop: 30, dy: 4 })).toBe(false);
        expect(pullTakesPanel({ open: true, scrollTop: 0, dy: -4 })).toBe(false);
        expect(pullTakesPanel({ open: false, scrollTop: 0, dy: 4 })).toBe(false);
    });

    test("scrolls the content first, then drags the panel from where the finger was", () => {
        const panel = grownPanel();
        panel.pullStart(100);
        // the content still scrolled: it scrolls
        expect(panel.pullMove(140, 10, 60)).toBe(false);
        expect(panel.pullMove(180, 20, 20)).toBe(false);
        expect(panel.grown).toBe(MAX);
        // at its top: the panel takes the rest of the pull, without a jump
        expect(panel.pullMove(190, 30, 0)).toBe(true);
        expect(panel.dragging).toBe(true);
        expect(panel.grown).toBe(MAX - 10);
        // and keeps it, the content's scroll no longer asked
        expect(panel.pullMove(290, 40, 0)).toBe(true);
        expect(panel.grown).toBe(MAX - 110);
    });

    test("let go, settles as the handle's drag does", () => {
        // a short slow pull: stays open
        let panel = grownPanel();
        panel.pullStart(0);
        panel.pullMove(5, 0, 0);
        panel.pullMove(100, 1000, 0);
        expect(panel.pullEnd(1010)).toBe("open");

        // past f 0.7: back to rest
        panel = grownPanel();
        panel.pullStart(0);
        panel.pullMove(5, 0, 0);
        panel.pullMove(300, 1000, 0);
        expect(panel.pullEnd(1010)).toBe("rest");
        expect(panel.open).toBe(false);

        // a flick down: back to rest
        panel = grownPanel();
        panel.pullStart(0);
        panel.pullMove(5, 0, 0);
        panel.pullMove(80, 50, 0);
        expect(panel.pullEnd(55)).toBe("rest");

        // on through rest and 80px past it: closes
        panel = grownPanel();
        panel.pullStart(0);
        panel.pullMove(5, 0, 0);
        panel.pullMove(5 + MAX + 100, 2000, 0);
        expect(panel.pullEnd(2010)).toBe("close");
        expect(panel.closing).toBe(true);
    });

    test("at rest, only scrolls", () => {
        const panel = new KeyboardPanelState(true);
        panel.setMaxGrow(MAX);
        panel.pullStart(0);
        expect(panel.pullMove(50, 10, 0)).toBe(false);
        expect(panel.pullEnd(20)).toBeUndefined();
        expect(panel.dragging).toBe(false);
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
