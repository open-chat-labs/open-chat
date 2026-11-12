// The slot under the composer that the keyboard and the keyboard-area panels share (native
// design notes §3.3, locked 2026-10-23): one at a time, the panels at the keyboard's height, so
// switching between the keyboard and a panel doesn't move the composer. What the slot holds and how
// tall it is; `KeyboardSlot` (keyboardSlot.svelte.ts) keeps it for the conversation.

/** The panels that take the keyboard's place: emoji (and GIFs), and the attach panel. */
export type Panel = "emoji" | "attach";

/**
 * The emoji panel's search (07): none; the emoji search, a strip on top of the keyboard (the field
 * and a line of the emoji found) over the composer; or the GIF search, the panel grown over the
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
    /**
     * The keyboard went down for a message's long-press menu (the menu takes the focus), and its
     * space is kept, at its height, so the composer and the chat don't move under the menu's copy
     * of the message. Kept until the keyboard is back up (the composer's text box focused again as
     * the menu closes), or let go (the menu led to another screen).
     */
    held: boolean;
};

export const CLOSED: Slot = { panel: undefined, expecting: false, search: "none", held: false };

/**
 * A panel's resting height where the keyboard's isn't known (06 "Layout and size", the prototype's
 * value), above the safe area.
 */
export const PANEL_REST = 304;

/** On mobile web, which has no gallery strip (06 "Mobile web variant"; both panels). */
export const PANEL_REST_WEB = 264;

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
 * safe area: 304px in the apps, 264px on mobile web (06's). The emoji and attach panels rest at the
 * same height, so switching between them doesn't move the composer either.
 */
export function restingHeight(known: {
    keyboard: number | undefined;
    safeBottom: number;
    gallery: boolean;
}): number {
    return known.keyboard ?? (known.gallery ? PANEL_REST : PANEL_REST_WEB) + known.safeBottom;
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
 * How tall the slot is: the spacer under the composer. With a panel: its resting height; searching,
 * the keyboard (or the height it's coming up to), the sheet over it (06 "Sizes": the spacer is the
 * rest height, which is the keyboard's). With none: the keyboard, or the height it's coming up to,
 * or the height it had while it's held for a message's menu; nothing otherwise.
 */
export function slotHeight(slot: Slot, keyboard: KeyboardHeights): number {
    const coming = keyboard.up > 0 ? keyboard.up : keyboard.known;
    if (slot.panel !== undefined) {
        if (slot.search === "strip") return coming;
        if (slot.search === "grown") return keyboard.up > 0 ? keyboard.up : keyboard.panel;
        return keyboard.panel;
    }
    if (keyboard.up > 0) return keyboard.up;
    return slot.expecting || slot.held ? keyboard.known : 0;
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
        return { slot: { ...CLOSED, panel }, input: "blur" };
    }
    if (panel === "emoji") {
        return { slot: { ...CLOSED, expecting: reported }, input: "focus" };
    }
    return { slot: CLOSED, input: "none" };
}

/**
 * The composer's text box took focus: the keyboard takes the panel's place. Its space held for a
 * message's menu stays held until it's up.
 */
export function inputFocused(slot: Slot, reported: boolean, keyboardUp: boolean): Slot {
    const expecting = reported && !keyboardUp;
    return { ...CLOSED, expecting, held: expecting && slot.held };
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
 * A keyboard report: the same height, nothing, unless the keyboard's on its way (it's come, at
 * the height it had: taken, so it's no longer expected); down while the keyboard is on its way,
 * the last move's (stale), nothing; down otherwise, at once; up from nothing held, at once; any
 * other height once it has stayed for `SETTLE_MS`, the slot holding what it has meanwhile.
 */
export function keyboardReport(slot: Slot, settled: number, reported: number): KeyboardReport {
    if (reported === settled) return reported > 0 && slot.expecting ? "apply" : "ignore";
    if (reported === 0) return slot.expecting ? "ignore" : "apply";
    if (settled === 0 && !slot.expecting) return "apply";
    return "settle";
}

/**
 * The keyboard's height was taken: up, it's no longer expected; down, a search is over (the panel
 * stays, at rest).
 */
export function keyboardMoved(slot: Slot, up: boolean): Slot {
    if (up) return slot.expecting ? { ...slot, expecting: false, held: false } : slot;
    if (slot.search === "none" && !slot.expecting) return slot;
    return { ...slot, search: "none", expecting: false };
}

/**
 * The keyboard hasn't come after all (a hardware keyboard, a focus without one, or a slow
 * report): no longer held for. A search goes on while its field has the focus.
 */
export function keyboardMissed(slot: Slot): Slot {
    return slot.expecting ? { ...slot, expecting: false, held: false } : slot;
}

/**
 * The slot moved on from `before` to `after`: once the keyboard's no longer expected, the height
 * it last reported (`latest`), if the slot doesn't have it (`settled`), is taken as a report now:
 * a "down" ignored while it was on its way is then the keyboard going down. Else undefined.
 */
export function reportToReplay(
    before: Slot,
    after: Slot,
    settled: number,
    latest: number,
): number | undefined {
    return before.expecting && !after.expecting && latest !== settled ? latest : undefined;
}

/**
 * Whether the keyboard's up, for a focus: the slot has its height (`settled`), and it hasn't been
 * reported down since (`latest`, a "down" ignored while it was on its way).
 */
export function keyboardIsUp(settled: number, latest: number): boolean {
    return settled > 0 && latest > 0;
}

/**
 * A message's long-press menu is opening. The keyboard goes down (Android's long-press takes the
 * focus off the text box, and the menu takes it): where it's up for the composer (`composer`: the
 * composer shows, which it doesn't while searching the chat) with no panel, and its height is
 * reported (the Android app), its space is kept while the menu is open, so nothing under the
 * menu's copy of the message moves. Else (no keyboard, a panel, the search's keyboard, the iOS
 * app and phones' browsers) nothing changes.
 */
export function holdForMenu(
    slot: Slot,
    reported: boolean,
    keyboardUp: boolean,
    composer: boolean,
): Slot {
    if (slot.held || !reported || !keyboardUp || !composer || slot.panel !== undefined) return slot;
    return { ...slot, held: true };
}

/**
 * Where the reader is once a message's menu, and whatever it opened (a sheet, a confirm), has
 * closed: still in the conversation, or on another screen (Message info, another chat, Diamond).
 */
export type MenuExit = "conversation" | "away";

/**
 * What the slot does as a message's menu (and what it opened) closes, its space held for it:
 * back in the conversation, the composer's text box is focused again, so the keyboard comes back
 * up into the space kept for it (which is let go once it's up); gone to another screen, the space
 * is let go. Nothing held, nothing to do.
 */
export function afterMenu(slot: Slot, exit: MenuExit): "refocus" | "release" | "none" {
    if (!slot.held) return "none";
    return exit === "conversation" ? "refocus" : "release";
}

/** The space held for a message's menu, let go. */
export function released(slot: Slot): Slot {
    return slot.held ? { ...slot, held: false } : slot;
}

/** Which way the composer's buttons go (notes §2): + · text · emoji on iOS, the other way on Android. */
export function composerPlacement(os: "ios" | "android"): {
    plus: "start" | "end";
    emoji: "start" | "end";
} {
    return os === "android" ? { plus: "end", emoji: "start" } : { plus: "start", emoji: "end" };
}
