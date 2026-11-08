// The emoji panel's Recent section (native plan 07 "Emoji tab"): the emoji the user picked last,
// newest first, no duplicates, sixteen at most, starting from the design's eight; kept on the
// device per user.

/** Recent, before anything has been picked. */
export const STARTING_RECENT: readonly string[] = ["😂", "❤️", "👍", "🔥", "🙏", "😮", "🎉", "👀"];

/** How many Recent keeps. */
export const RECENT_EMOJI = 16;

/** Recent after `emoji` is picked: it moves to the front, the oldest falling off past the most. */
export function pickedRecently(
    recent: readonly string[],
    emoji: string,
    most: number = RECENT_EMOJI,
): string[] {
    return [emoji, ...recent.filter((e) => e !== emoji)].slice(0, most);
}

const key = (userId: string) => `openchat_recent_emoji_${userId}`;

/** Read with the user's Recent as it was left (else the starting ones). */
export function storedRecent(storage: Pick<Storage, "getItem">, userId: string): string[] {
    try {
        const parsed: unknown = JSON.parse(storage.getItem(key(userId)) ?? "null");
        if (Array.isArray(parsed) && parsed.every((e) => typeof e === "string")) {
            return parsed.slice(0, RECENT_EMOJI);
        }
    } catch (err) {
        console.warn("Couldn't read the recent emoji", err);
    }
    return [...STARTING_RECENT];
}

/** Keeps the user's Recent for next time. */
export function storeRecent(
    storage: Pick<Storage, "setItem">,
    userId: string,
    recent: readonly string[],
): void {
    try {
        storage.setItem(key(userId), JSON.stringify(recent));
    } catch (err) {
        console.warn("Couldn't keep the recent emoji", err);
    }
}
