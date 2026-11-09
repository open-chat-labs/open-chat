import {
    CLOSED,
    composerPlacement,
    inputFocused,
    keyboardMissed,
    keyboardMoved,
    keyboardReport,
    PANEL_REST,
    PANEL_REST_WEB_ATTACH,
    restingHeight,
    searchChanged,
    slotHeight,
    togglePanel,
    type Slot,
} from "./keyboardSlot";

const down = { up: 0, known: 300, panel: 300 };
const up = { up: 320, known: 320, panel: 320 };
// mobile web: the keyboard's height isn't reported, a panel takes the design's
const unreported = { up: 0, known: 0, panel: 304 };
const emoji: Slot = { ...CLOSED, panel: "emoji" };

describe("the slot under the composer", () => {
    test("is the keyboard while it's up, with no panel", () => {
        expect(slotHeight(CLOSED, up)).toBe(320);
    });

    test("is a panel's resting height, a keyboard reported meanwhile being one that's leaving", () => {
        expect(slotHeight(emoji, down)).toBe(300);
        expect(slotHeight({ ...CLOSED, panel: "attach" }, unreported)).toBe(304);
        expect(slotHeight({ ...CLOSED, panel: "attach" }, { ...up, panel: 300 })).toBe(300);
    });

    test("keeps the keyboard's height while it's on its way, so the composer doesn't jump", () => {
        expect(slotHeight({ ...CLOSED, expecting: true }, down)).toBe(300);
        // nothing to keep where it isn't reported
        expect(slotHeight({ ...CLOSED, expecting: true }, unreported)).toBe(0);
    });

    test("is nothing with neither", () => {
        expect(slotHeight(CLOSED, down)).toBe(0);
    });

    test("searching emoji, is the keyboard (or the one coming): the strip sits over the composer", () => {
        const strip: Slot = { ...emoji, search: "strip" };
        expect(slotHeight(strip, up)).toBe(320);
        expect(slotHeight({ ...strip, expecting: true }, down)).toBe(300);
        // unreported, the platform lifts the page
        expect(slotHeight(strip, unreported)).toBe(0);
    });

    test("searching GIFs, is the keyboard under the grown panel, else the panel's rest", () => {
        const grown: Slot = { ...emoji, search: "grown" };
        expect(slotHeight(grown, up)).toBe(320);
        expect(slotHeight(grown, unreported)).toBe(304);
    });
});

describe("a panel's resting height", () => {
    test("is the keyboard's last height, where it's been seen", () => {
        const known = { keyboard: 310, safeBottom: 24, gallery: true };
        expect(restingHeight("emoji", known)).toBe(310);
        expect(restingHeight("attach", known)).toBe(310);
    });

    test("else is the design's, over the safe area", () => {
        const known = { keyboard: undefined, safeBottom: 24, gallery: true };
        expect(restingHeight("emoji", known)).toBe(PANEL_REST + 24);
        expect(restingHeight("attach", known)).toBe(PANEL_REST + 24);
    });

    test("on mobile web, is the attach panel's own, without a gallery strip", () => {
        const known = { keyboard: undefined, safeBottom: 0, gallery: false };
        expect(restingHeight("attach", known)).toBe(PANEL_REST_WEB_ATTACH);
        expect(restingHeight("emoji", known)).toBe(PANEL_REST);
    });
});

describe("a panel's button", () => {
    test("opens its panel in the keyboard's place, the keyboard going down", () => {
        expect(togglePanel(CLOSED, "emoji", true)).toEqual({ slot: emoji, input: "blur" });
        // one panel in place of the other
        expect(togglePanel(emoji, "attach", true).slot.panel).toBe("attach");
    });

    test("emoji's keyboard glyph brings the keyboard back, held for where it's reported", () => {
        expect(togglePanel(emoji, "emoji", true)).toEqual({
            slot: { ...CLOSED, expecting: true },
            input: "focus",
        });
        expect(togglePanel(emoji, "emoji", false).slot).toEqual(CLOSED);
    });

    test("+'s × just closes its panel", () => {
        expect(togglePanel({ ...CLOSED, panel: "attach" }, "attach", true)).toEqual({
            slot: CLOSED,
            input: "none",
        });
    });
});

describe("the emoji panel's search", () => {
    test("takes the keyboard as a strip (emoji) or grown (GIFs), the keyboard expected", () => {
        expect(searchChanged(emoji, "strip", true, false)).toEqual({
            ...emoji,
            search: "strip",
            expecting: true,
        });
        expect(searchChanged(emoji, "grown", true, true)).toEqual({ ...emoji, search: "grown" });
        expect(searchChanged({ ...emoji, search: "strip" }, "none", true, true)).toEqual(emoji);
    });

    test("is the emoji panel's only", () => {
        const attach: Slot = { ...CLOSED, panel: "attach" };
        expect(searchChanged(attach, "strip", true, false)).toBe(attach);
    });
});

describe("a keyboard report", () => {
    test("the height the slot has: nothing to do", () => {
        expect(keyboardReport(CLOSED, 336, 336)).toBe("ignore");
    });

    test("down: at once, unless the keyboard's on its way again (the last move's down)", () => {
        expect(keyboardReport(CLOSED, 336, 0)).toBe("apply");
        expect(keyboardReport({ ...CLOSED, expecting: true }, 336, 0)).toBe("ignore");
    });

    test("up from nothing held: at once", () => {
        expect(keyboardReport(CLOSED, 0, 336)).toBe("apply");
    });

    test("up while held, or another height: once it has settled", () => {
        expect(keyboardReport({ ...CLOSED, expecting: true }, 0, 370)).toBe("settle");
        expect(keyboardReport(CLOSED, 336, 370)).toBe("settle");
    });
});

describe("the keyboard", () => {
    test("takes a panel's place when the text box is focused", () => {
        expect(inputFocused(true, false)).toEqual({ ...CLOSED, expecting: true });
        expect(inputFocused(true, true)).toEqual(CLOSED);
        expect(inputFocused(false, false)).toEqual(CLOSED);
    });

    test("up, is no longer expected", () => {
        expect(keyboardMoved({ ...CLOSED, expecting: true }, true)).toEqual(CLOSED);
        expect(keyboardMoved(emoji, true)).toBe(emoji);
    });

    test("down, ends a search, the emoji panel staying", () => {
        expect(keyboardMoved({ ...emoji, search: "strip" }, false)).toEqual(emoji);
        expect(keyboardMoved(emoji, false)).toBe(emoji);
    });

    test("not coming after all, isn't held for; a search goes on", () => {
        expect(keyboardMissed({ ...emoji, search: "strip", expecting: true })).toEqual({
            ...emoji,
            search: "strip",
        });
        expect(keyboardMissed(emoji)).toBe(emoji);
    });
});

describe("the composer's buttons", () => {
    test("are + · text · emoji on iOS, emoji · text · + on Android (notes §2)", () => {
        expect(composerPlacement("ios")).toEqual({ plus: "start", emoji: "end" });
        expect(composerPlacement("android")).toEqual({ plus: "end", emoji: "start" });
    });
});
