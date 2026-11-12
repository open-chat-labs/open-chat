import {
    afterMenu,
    CLOSED,
    composerPlacement,
    holdForMenu,
    inputFocused,
    keyboardIsUp,
    keyboardMissed,
    keyboardMoved,
    keyboardReport,
    PANEL_REST,
    PANEL_REST_WEB,
    released,
    reportToReplay,
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
        expect(restingHeight({ keyboard: 310, safeBottom: 24, gallery: true })).toBe(310);
        expect(restingHeight({ keyboard: 310, safeBottom: 24, gallery: false })).toBe(310);
    });

    test("else is the design's over the safe area, the same for both panels", () => {
        expect(restingHeight({ keyboard: undefined, safeBottom: 24, gallery: true })).toBe(
            PANEL_REST + 24,
        );
        // mobile web, without the gallery strip
        expect(restingHeight({ keyboard: undefined, safeBottom: 0, gallery: false })).toBe(
            PANEL_REST_WEB,
        );
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
        expect(keyboardReport({ ...CLOSED, expecting: true }, 0, 0)).toBe("ignore");
    });

    test("the height the slot has while the keyboard's on its way: it's come, taken", () => {
        // the emoji search's keyboard up, the keyboard glyph tapped: the composer's comes the same
        expect(keyboardReport({ ...CLOSED, expecting: true }, 336, 336)).toBe("apply");
        expect(keyboardMoved({ ...CLOSED, expecting: true }, true)).toEqual(CLOSED);
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
        expect(inputFocused(emoji, true, false)).toEqual({ ...CLOSED, expecting: true });
        expect(inputFocused(emoji, true, true)).toEqual(CLOSED);
        expect(inputFocused(emoji, false, false)).toEqual(CLOSED);
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

describe("a report the slot didn't take while the keyboard was on its way", () => {
    const expecting: Slot = { ...CLOSED, expecting: true };

    test("is taken once it's no longer expected: a down ignored is the keyboard going down", () => {
        expect(reportToReplay(expecting, CLOSED, 336, 0)).toBe(0);
        // not coming after all (a search goes on)
        const strip: Slot = { ...emoji, search: "strip" };
        expect(
            reportToReplay(
                { ...strip, expecting: true },
                keyboardMissed({ ...strip, expecting: true }),
                336,
                0,
            ),
        ).toBe(0);
        // taken as a report then: down, at once
        expect(keyboardReport(CLOSED, 336, 0)).toBe("apply");
    });

    test("isn't, while it's still expected, or when the slot has it", () => {
        expect(reportToReplay(expecting, expecting, 336, 0)).toBeUndefined();
        expect(reportToReplay(expecting, CLOSED, 336, 336)).toBeUndefined();
        expect(reportToReplay(CLOSED, CLOSED, 336, 0)).toBeUndefined();
    });
});

describe("whether the keyboard's up, for a focus", () => {
    test("is the slot having its height, not reported down since", () => {
        expect(keyboardIsUp(336, 336)).toBe(true);
        // a down ignored while it was on its way
        expect(keyboardIsUp(336, 0)).toBe(false);
        // one coming up, not settled yet
        expect(keyboardIsUp(0, 370)).toBe(false);
    });
});

describe("the composer's buttons", () => {
    test("are + · text · emoji on iOS, emoji · text · + on Android (notes §2)", () => {
        expect(composerPlacement("ios")).toEqual({ plus: "start", emoji: "end" });
        expect(composerPlacement("android")).toEqual({ plus: "end", emoji: "start" });
    });
});

describe("the keyboard's space, for a message's menu", () => {
    const held: Slot = { ...CLOSED, held: true };

    test("is kept as the menu opens over the composer's keyboard", () => {
        expect(holdForMenu(CLOSED, true, true, true)).toEqual(held);
        expect(holdForMenu(held, true, true, true)).toBe(held);
    });

    test("isn't, with the keyboard down, a panel, the search's keyboard, or one not reported", () => {
        expect(holdForMenu(CLOSED, true, false, true)).toBe(CLOSED);
        expect(holdForMenu(emoji, true, true, true)).toBe(emoji);
        expect(holdForMenu(CLOSED, true, true, false)).toBe(CLOSED);
        expect(holdForMenu(CLOSED, false, true, true)).toBe(CLOSED);
    });

    test("stays at the keyboard's height as it goes down, so nothing moves", () => {
        expect(slotHeight(held, up)).toBe(320);
        expect(keyboardReport(held, 336, 0)).toBe("apply");
        expect(keyboardMoved(held, false)).toBe(held);
        expect(slotHeight(held, down)).toBe(300);
        // a sheet's field (the forward sheet's search) raising the keyboard meanwhile
        expect(keyboardMoved(held, true)).toBe(held);
    });

    test("back in the conversation, the text box is focused again: held until the keyboard's up", () => {
        expect(afterMenu(held, "conversation")).toBe("refocus");
        const coming = inputFocused(held, true, false);
        expect(coming).toEqual({ ...CLOSED, expecting: true, held: true });
        expect(slotHeight(coming, down)).toBe(300);
        // a down from the keyboard leaving for the menu, late: ignored
        expect(keyboardReport(coming, 0, 0)).toBe("ignore");
        expect(keyboardMoved(coming, true)).toEqual(CLOSED);
    });

    test("is let go if the keyboard doesn't come after all", () => {
        expect(keyboardMissed({ ...CLOSED, expecting: true, held: true })).toEqual(CLOSED);
    });

    test("is let go on another screen", () => {
        expect(afterMenu(held, "away")).toBe("release");
        expect(released(held)).toEqual(CLOSED);
        expect(released(CLOSED)).toBe(CLOSED);
    });

    test("with nothing held, the menu closing changes nothing", () => {
        expect(afterMenu(CLOSED, "conversation")).toBe("none");
        expect(afterMenu(CLOSED, "away")).toBe("none");
    });

    test("isn't kept past a panel's button or a focus with the keyboard up", () => {
        expect(togglePanel(held, "emoji", true).slot.held).toBe(false);
        expect(inputFocused(held, true, true)).toEqual(CLOSED);
    });
});
