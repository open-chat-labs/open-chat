// The slot under the composer that the keyboard and the keyboard-area panels share (native
// design notes §3.3, locked 2026-10-23): one at a time, the panels at the keyboard's height, so
// switching between the keyboard and a panel doesn't move the composer. What the slot holds and how
// tall it is; `KeyboardSlot` (keyboardSlot.svelte.ts) keeps it for the conversation.

/** The panels that take the keyboard's place: emoji (and GIFs), and the attach panel. */
export type Panel = "emoji" | "attach";

export type Slot = {
    /** The panel showing, while the keyboard's down. */
    panel: Panel | undefined;
    /**
     * The composer's text box was just focused, so the keyboard is on its way: until it's up, the
     * slot keeps the height it will have (where the keyboard's height is reported), rather than
     * dropping the composer and lifting it again.
     */
    expecting: boolean;
    /** The emoji panel's search field has the keyboard: the panel is at full height, its results above it. */
    searching: boolean;
};

export const CLOSED: Slot = { panel: undefined, expecting: false, searching: false };

/**
 * A panel's resting height where the keyboard's isn't known (06 "Layout and size", the prototype's
 * value), above the safe area.
 */
export const PANEL_REST = 282;

/** The attach panel's on mobile web, which has no gallery strip (06 "Mobile web variant"). */
export const PANEL_REST_WEB_ATTACH = 264;

/**
 * How tall a panel rests, in CSS pixels: the keyboard's last height where it's been seen, so the
 * composer doesn't move between the keyboard and the panel; else the design's height above the
 * safe area (on mobile web, the attach panel's own, shorter one).
 */
export function restingHeight(
    panel: Panel,
    known: { keyboard: number | undefined; safeBottom: number; gallery: boolean },
): number {
    if (panel === "attach" && !known.gallery) return PANEL_REST_WEB_ATTACH + known.safeBottom;
    return known.keyboard ?? PANEL_REST + known.safeBottom;
}

/** What the slot's height is worked out from, in CSS pixels from the window's bottom. */
export type KeyboardHeights = {
    /** The keyboard while it's up, where it's reported (the Android app); else 0. */
    up: number;
    /** The keyboard about to come up, where it's reported; else 0. */
    expected: number;
    /** The panel's resting height (`restingHeight`). */
    panel: number;
};

/**
 * How tall the slot is: the keyboard while it's up (the emoji panel's search included: the panel
 * grows over the screen above it); a panel's resting height while the keyboard's down; the
 * keyboard expected while it's on its way; nothing otherwise.
 */
export function slotHeight(slot: Slot, keyboard: KeyboardHeights): number {
    if (keyboard.up > 0) return keyboard.up;
    if (slot.panel !== undefined) return keyboard.panel;
    if (slot.expecting) return keyboard.expected;
    return 0;
}

/** What the composer's text box does as a panel's button is pressed. */
export type InputMove = "focus" | "blur" | "none";

/**
 * The composer's + or emoji button: it opens its panel in the keyboard's place (the keyboard goes
 * down), or, open, closes it: the emoji button then shows the keyboard (its keyboard glyph), +
 * (its ×) just closes. `reported`: the keyboard's height is reported, so the slot can hold until it
 * comes up.
 */
export function togglePanel(
    slot: Slot,
    panel: Panel,
    reported: boolean,
): { slot: Slot; input: InputMove } {
    if (slot.panel !== panel) {
        return { slot: { panel, expecting: false, searching: false }, input: "blur" };
    }
    if (panel === "emoji") {
        return { slot: { ...CLOSED, expecting: reported }, input: "focus" };
    }
    return { slot: CLOSED, input: "none" };
}

/** The composer's text box took focus: the keyboard takes the panel's place. */
export function inputFocused(reported: boolean, keyboardUp: boolean): Slot {
    return { panel: undefined, expecting: reported && !keyboardUp, searching: false };
}

/**
 * The keyboard came up, or went down. Down, a search in the emoji panel is over (the panel stays,
 * at the keyboard's height), and whatever it was coming up for has gone.
 */
export function keyboardMoved(slot: Slot, up: boolean): Slot {
    if (up) return slot.expecting ? { ...slot, expecting: false } : slot;
    if (!slot.searching && !slot.expecting) return slot;
    return { ...slot, searching: false, expecting: false };
}

/** Which way the composer's buttons go (notes §2): + · text · emoji on iOS, the other way on Android. */
export function composerPlacement(os: "ios" | "android"): {
    plus: "start" | "end";
    emoji: "start" | "end";
} {
    return os === "android" ? { plus: "end", emoji: "start" } : { plus: "start", emoji: "end" };
}
