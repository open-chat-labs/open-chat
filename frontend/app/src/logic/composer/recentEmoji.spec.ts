import {
    pickedRecently,
    RECENT_EMOJI,
    STARTING_RECENT,
    storedRecent,
    storeRecent,
} from "./recentEmoji";

function memory(): Pick<Storage, "getItem" | "setItem"> {
    const held = new Map<string, string>();
    return {
        getItem: (k) => held.get(k) ?? null,
        setItem: (k, v) => void held.set(k, v),
    };
}

describe("the recent emoji", () => {
    test("a pick moves to the front, without a duplicate", () => {
        expect(pickedRecently(["😂", "❤️", "👍"], "👍")).toEqual(["👍", "😂", "❤️"]);
        expect(pickedRecently(["😂", "❤️"], "🥳")).toEqual(["🥳", "😂", "❤️"]);
    });

    test("keeps sixteen, the oldest falling off", () => {
        const full = Array.from({ length: RECENT_EMOJI }, (_, i) =>
            String.fromCodePoint(0x1f600 + i),
        );
        const next = pickedRecently(full, "🦄");
        expect(next).toHaveLength(RECENT_EMOJI);
        expect(next[0]).toBe("🦄");
        expect(next).not.toContain(full[RECENT_EMOJI - 1]);
    });

    test("start from the design's eight", () => {
        expect(storedRecent(memory(), "me")).toEqual([...STARTING_RECENT]);
    });

    test("are kept per user", () => {
        const storage = memory();
        storeRecent(storage, "me", ["🥳", "😂"]);
        expect(storedRecent(storage, "me")).toEqual(["🥳", "😂"]);
        expect(storedRecent(storage, "someone else")).toEqual([...STARTING_RECENT]);
    });

    test("kept wrong, start again", () => {
        const storage = memory();
        storage.setItem("openchat_recent_emoji_me", "{not json");
        expect(storedRecent(storage, "me")).toEqual([...STARTING_RECENT]);
        storage.setItem("openchat_recent_emoji_me", JSON.stringify([1, 2]));
        expect(storedRecent(storage, "me")).toEqual([...STARTING_RECENT]);
    });
});
