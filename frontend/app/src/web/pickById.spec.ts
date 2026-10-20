import { pickById } from "./pickById";

describe("picking a palette entry by id", () => {
    const palette = ["a", "b", "c", "d"] as const;

    test("always picks the same entry for an id", () => {
        expect(pickById("chat-1", palette)).toBe(pickById("chat-1", palette));
    });

    test("spreads ids over the palette", () => {
        const picked = new Set(Array.from({ length: 40 }, (_, i) => pickById(`id-${i}`, palette)));
        expect(picked.size).toBe(palette.length);
    });
});
