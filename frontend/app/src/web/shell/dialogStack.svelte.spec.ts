import { DialogStack } from "./dialogStack.svelte";

describe("the app's own dialogs", () => {
    test("open on top of each other", () => {
        const stack = new DialogStack<{ name: string }>();
        const first = { name: "first" };
        const second = { name: "second" };
        stack.open(first);
        stack.open(second);
        expect(stack.items).toEqual([first, second]);
    });

    test("close one at a time, whichever it is", () => {
        const stack = new DialogStack<{ name: string }>();
        const first = { name: "first" };
        const second = { name: "second" };
        stack.open(first);
        stack.open(second);
        stack.close(first);
        expect(stack.items).toEqual([second]);
    });

    test("one takes the place of those it replaces, on top", () => {
        const stack = new DialogStack<{ kind: string; name: string }>();
        const card = { kind: "card", name: "alice" };
        const other = { kind: "other", name: "other" };
        stack.open(card);
        stack.open(other);
        const next = { kind: "card", name: "bob" };
        stack.replace(next, (open) => open.kind === "card");
        expect(stack.items).toEqual([other, next]);
    });

    test("all close together before a navigation", () => {
        const stack = new DialogStack<{ name: string }>();
        stack.open({ name: "first" });
        stack.open({ name: "second" });
        stack.closeAll();
        expect(stack.items).toEqual([]);
    });
});
