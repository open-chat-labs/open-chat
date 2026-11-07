// Deleting the account, as the design's profile has it (the export's ProfileDialog, "Delete
// account"; the native prototype only says "deletion is a separate confirm screen in the real
// app"): three steps that say what goes with the account and offer to stay (the chats, the wallet,
// the CHIT), then the last one, which takes the user's @username typed out before it asks them to
// sign in again and deletes. The words come in from the screen.

/** The steps, from the first; `final` is the last, which deletes. */
export const DELETE_STEPS = ["chats", "wallet", "chit", "final"] as const;
export type DeleteStep = (typeof DELETE_STEPS)[number];

/**
 * Whether what's typed is the username (the last step's check): case aside, with or without its @,
 * and spaces around it.
 */
export function usernameTyped(typed: string, username: string): boolean {
    return typed.trim().replace(/^@/, "").toLowerCase() === username.toLowerCase();
}

// the streak's milestones, as the web's profile counts them
const MILESTONES = [14, 30, 100, 365];

/** How far the streak is from its next milestone, or that it has passed them all. */
export function nextMilestone(
    streak: number,
): { kind: "next"; days: number; milestone: number } | { kind: "all" } {
    const milestone = MILESTONES.find((m) => m > streak);
    return milestone === undefined
        ? { kind: "all" }
        : { kind: "next", days: milestone - streak, milestone };
}

/** Whether the CHIT step is the one for someone who's never earned any (nothing to lose). */
export function neverEarnedChit(balance: number, earned: number): boolean {
    return balance === 0 && earned === 0;
}

// what marks the emphasised parts of a translated text (one of them is put in, marked, as a value)
const MARK = "\u0001";

/** A value to put into a text, emphasised (`emphasised` finds it again). */
export function marked(value: string): string {
    return `${MARK}${value}${MARK}`;
}

/** A translated text split around its emphasised values (`marked`), in order. */
export function emphasised(text: string): { text: string; strong: boolean }[] {
    return text
        .split(MARK)
        .map((part, i) => ({ text: part, strong: i % 2 === 1 }))
        .filter((part) => part.text !== "");
}
