import { routerReadyStore, subscribe } from "@client";
import { flushPendingNavigation, navigate } from "@src/utils/navigation";
import { closeOnNavigation, DialogStack } from "./dialogStack.svelte";

// page.js itself, apart from its navigations (pushed or replaced, as navigationMode decides), which
// go to `navigation.went`. navigation.ts reads its Route at import.
const navigation = vi.hoisted(() => ({ went: (_path: string) => {} }));
vi.mock("page", async (importOriginal) => {
    const real = (await importOriginal<typeof import("page")>()).default;
    const went = (path: string) => navigation.went(path);
    return { default: Object.assign(went, real, { replace: went }) };
});

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

describe("the dialogs and a navigation", () => {
    test("navigate() with a dialog open closes it, then makes exactly the navigation asked for, once", () => {
        routerReadyStore.set(true);
        const stack = new DialogStack<{ name: string }>();
        stack.open({ name: "card" });
        const stopClosing = closeOnNavigation(stack);
        // as the router does
        const stopFlushing = subscribe("closeModalStack", flushPendingNavigation);
        // the dialogs are closed by the time it goes
        const navigated: string[] = [];
        navigation.went = (path) => navigated.push(`${path} with ${stack.items.length} open`);

        navigate("/notifications");

        expect(navigated).toEqual(["/notifications with 0 open"]);
        stopFlushing();
        stopClosing();
    });

    test("Back closes them", () => {
        const stack = new DialogStack<{ name: string }>();
        stack.open({ name: "card" });
        const stop = closeOnNavigation(stack);
        window.dispatchEvent(new PopStateEvent("popstate"));
        expect(stack.items).toEqual([]);
        stop();
    });
});
