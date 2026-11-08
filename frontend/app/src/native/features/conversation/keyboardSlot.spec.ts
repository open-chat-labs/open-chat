import {
    CLOSED,
    composerPlacement,
    inputFocused,
    keyboardMoved,
    PANEL_REST,
    PANEL_REST_WEB_ATTACH,
    restingHeight,
    slotHeight,
    togglePanel,
    type Slot,
} from "./keyboardSlot";

const down = { up: 0, expected: 300, panel: 300 };
const up = { up: 320, expected: 320, panel: 320 };
// mobile web: the keyboard's height isn't reported, a panel takes the design's
const unreported = { up: 0, expected: 0, panel: 282 };

describe("the slot under the composer", () => {
    test("is the keyboard while it's up, whatever else", () => {
        expect(slotHeight(CLOSED, up)).toBe(320);
        expect(slotHeight({ ...CLOSED, panel: "attach" }, up)).toBe(320);
    });

    test("is a panel at the keyboard's height while the keyboard's down", () => {
        expect(slotHeight({ ...CLOSED, panel: "emoji" }, down)).toBe(300);
        expect(slotHeight({ ...CLOSED, panel: "attach" }, unreported)).toBe(282);
    });

    test("keeps the keyboard's height while it's on its way, so the composer doesn't jump", () => {
        expect(slotHeight({ ...CLOSED, expecting: true }, down)).toBe(300);
        // nothing to keep where it isn't reported
        expect(slotHeight({ ...CLOSED, expecting: true }, unreported)).toBe(0);
    });

    test("is nothing with neither", () => {
        expect(slotHeight(CLOSED, down)).toBe(0);
    });

    test("searching emoji, is the keyboard under the grown panel, else the panel's rest", () => {
        const searching: Slot = { panel: "emoji", expecting: false, searching: true };
        expect(slotHeight(searching, up)).toBe(320);
        expect(slotHeight(searching, unreported)).toBe(282);
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
        expect(togglePanel(CLOSED, "emoji", true)).toEqual({
            slot: { panel: "emoji", expecting: false, searching: false },
            input: "blur",
        });
        // one panel in place of the other
        expect(togglePanel({ ...CLOSED, panel: "emoji" }, "attach", true).slot.panel).toBe(
            "attach",
        );
    });

    test("emoji's keyboard glyph brings the keyboard back, held for where it's reported", () => {
        expect(togglePanel({ ...CLOSED, panel: "emoji" }, "emoji", true)).toEqual({
            slot: { ...CLOSED, expecting: true },
            input: "focus",
        });
        expect(togglePanel({ ...CLOSED, panel: "emoji" }, "emoji", false).slot).toEqual(CLOSED);
    });

    test("+'s × just closes its panel", () => {
        expect(togglePanel({ ...CLOSED, panel: "attach" }, "attach", true)).toEqual({
            slot: CLOSED,
            input: "none",
        });
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
        const panel: Slot = { ...CLOSED, panel: "emoji" };
        expect(keyboardMoved(panel, true)).toBe(panel);
    });

    test("down, ends a search, the emoji panel staying", () => {
        expect(keyboardMoved({ panel: "emoji", expecting: false, searching: true }, false)).toEqual(
            { ...CLOSED, panel: "emoji" },
        );
        expect(keyboardMoved({ ...CLOSED, expecting: true }, false)).toEqual(CLOSED);
    });
});

describe("the composer's buttons", () => {
    test("are + · text · emoji on iOS, emoji · text · + on Android (notes §2)", () => {
        expect(composerPlacement("ios")).toEqual({ plus: "start", emoji: "end" });
        expect(composerPlacement("android")).toEqual({ plus: "end", emoji: "start" });
    });
});
