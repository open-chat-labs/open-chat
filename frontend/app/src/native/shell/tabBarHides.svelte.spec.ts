import { TabBarHides } from "./tabBarHides.svelte";

describe("a screen hiding the tab bar", () => {
    test("hides it until it shows it again", () => {
        const hides = new TabBarHides();
        const chats = hides.for("chats");
        expect(hides.hidden("chats")).toBe(false);
        chats(true);
        expect(hides.hidden("chats")).toBe(true);
        chats(true);
        expect(hides.hidden("chats")).toBe(true);
        chats(false);
        expect(hides.hidden("chats")).toBe(false);
    });

    test("is each screen's own: another tab's root doesn't hide it", () => {
        const hides = new TabBarHides();
        hides.for("chats")(true);
        expect(hides.hidden("chats")).toBe(true);
        expect(hides.hidden("communities")).toBe(false);
        expect(hides.hidden(undefined)).toBe(false);
    });

    test("isn't shown again by a screen going for another at the same key", () => {
        const hides = new TabBarHides();
        const going = hides.for("chats");
        const coming = hides.for("chats");
        going(true);
        coming(true);
        going(false);
        expect(hides.hidden("chats")).toBe(true);
        coming(false);
        expect(hides.hidden("chats")).toBe(false);
    });
});
