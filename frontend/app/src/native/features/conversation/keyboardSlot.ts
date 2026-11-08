// The slot under the composer that the keyboard and the keyboard-area panels share (native
// design notes §3.3, locked 2026-10-23): one at a time, the panels at the keyboard's height, so
// switching between the keyboard and a panel doesn't move the composer. What the slot holds and how
// tall it is; `KeyboardSlot` (keyboardSlot.svelte.ts) keeps it for the conversation.

/** The panels that take the keyboard's place: emoji (and GIFs), and the attach panel. */
export type Panel = "emoji" | "attach";

/**
 * The emoji panel's search: none; the emoji search, a strip above the keyboard (the field and a
 * line of the emoji found, the composer above it); or the GIF search, the panel grown over the
 * chat with the keyboard under it.
 */
export type Search = "none" | "strip" | "grown";

export type Slot = {
    /** The panel showing. */
    panel: Panel | undefined;
    /**
     * The keyboard is on its way (the composer's text box, or the search field, was just focused):
     * until it's up, the slot keeps the height it will have (where the keyboard's height is
     * reported), and a "down" from the keyboard's last move is ignored.
     */
    expecting: boolean;
    /** The emoji panel's search field has the keyboard, and how the panel shows it. */
    search: Search;
};

export const CLOSED: Slot = { panel: undefined, expecting: false, search: "none" };

/**
 * A panel's resting height where the keyboard's isn't known (06 "Layout and size", the prototype's
 * value), above the safe area.
 */
export const PANEL_REST = 282;

/** The attach panel's on mobile web, which has no gallery strip (06 "Mobile web variant"). */
export const PANEL_REST_WEB_ATTACH = 264;

/**
 * The emoji search's strip above the keyboard: the handle (22), the field's row (40 and 8 under
 * it) and a line of emoji (44 and 8 under it).
 */
export const SEARCH_STRIP = 122;

/**
 * How long a keyboard height has to stay the same before the slot takes it: Android reports a
 * keyboard coming up at one height and then, about 200ms on, at its own (370px, then 336px).
 */
export const SETTLE_MS = 250;

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
    /** The keyboard while it's up (settled), where it's reported (the Android app); else 0. */
    up: number;
    /**
     * The keyboard's height to hold for it while it's on its way (its last, as the move started),
     * where it's reported; else 0.
     */
    known: number;
    /** The open panel's resting height (`restingHeight`). */
    panel: number;
};

/**
 * How tall the slot is. With a panel: its resting height (a keyboard reported meanwhile is one
 * leaving, or coming for a search); searching emoji, the keyboard and the strip above it;
 * searching GIFs, the keyboard under the grown panel. With none: the keyboard, or the height it's
 * coming up to; nothing otherwise.
 */
export function slotHeight(slot: Slot, keyboard: KeyboardHeights): number {
    const coming = keyboard.up > 0 ? keyboard.up : keyboard.known;
    if (slot.panel !== undefined) {
        if (slot.search === "strip") return coming + SEARCH_STRIP;
        if (slot.search === "grown") return keyboard.up > 0 ? keyboard.up : keyboard.panel;
        return keyboard.panel;
    }
    if (keyboard.up > 0) return keyboard.up;
    return slot.expecting ? keyboard.known : 0;
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
        return { slot: { panel, expecting: false, search: "none" }, input: "blur" };
    }
    if (panel === "emoji") {
        return { slot: { ...CLOSED, expecting: reported }, input: "focus" };
    }
    return { slot: CLOSED, input: "none" };
}

/** The composer's text box took focus: the keyboard takes the panel's place. */
export function inputFocused(reported: boolean, keyboardUp: boolean): Slot {
    return { panel: undefined, expecting: reported && !keyboardUp, search: "none" };
}

/** The emoji panel's search field took the keyboard (`search`), or gave it up ("none"). */
export function searchChanged(
    slot: Slot,
    search: Search,
    reported: boolean,
    keyboardUp: boolean,
): Slot {
    if (slot.panel !== "emoji" || slot.search === search) return slot;
    if (search === "none") return { ...slot, search, expecting: false };
    return { ...slot, search, expecting: reported && !keyboardUp };
}

/** What the slot does with a height the keyboard reports, `settled` being the one it has. */
export type KeyboardReport = "apply" | "settle" | "ignore";

/**
 * A keyboard report: the same height, nothing; down while the keyboard is on its way, the last
 * move's (stale), nothing; down otherwise, at once; up from nothing held, at once; any other
 * height once it has stayed for `SETTLE_MS`, the slot holding what it has meanwhile.
 */
export function keyboardReport(slot: Slot, settled: number, reported: number): KeyboardReport {
    if (reported === settled) return "ignore";
    if (reported === 0) return slot.expecting ? "ignore" : "apply";
    if (settled === 0 && !slot.expecting) return "apply";
    return "settle";
}

/**
 * The keyboard's height was taken: up, it's no longer expected; down, a search is over (the panel
 * stays, at rest).
 */
export function keyboardMoved(slot: Slot, up: boolean): Slot {
    if (up) return slot.expecting ? { ...slot, expecting: false } : slot;
    if (slot.search === "none" && !slot.expecting) return slot;
    return { ...slot, search: "none", expecting: false };
}

/** The keyboard didn't come after all (a hardware keyboard, a focus without one). */
export function keyboardMissed(slot: Slot, keyboardUp: boolean): Slot {
    if (!slot.expecting) return slot;
    return keyboardUp
        ? { ...slot, expecting: false }
        : { ...slot, expecting: false, search: "none" };
}

/** Which way the composer's buttons go (notes §2): + · text · emoji on iOS, the other way on Android. */
export function composerPlacement(os: "ios" | "android"): {
    plus: "start" | "end";
    emoji: "start" | "end";
} {
    return os === "android" ? { plus: "end", emoji: "start" } : { plus: "start", emoji: "end" };
}
