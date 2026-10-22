import { captureRulesAcceptanceStore, routerReadyStore } from "@client";
import { navigate } from "@src/utils/navigation";
import { answerNavigations, DialogHost } from "./dialogHost.svelte";

const pageMock = vi.hoisted(() => Object.assign(vi.fn(), { replace: vi.fn() }));
// navigation.ts builds its route matchers with page.Route at import
vi.mock("page", async (importOriginal) => {
    const real = (await importOriginal<typeof import("page")>()).default;
    return { default: Object.assign(pageMock, { Route: real.Route }) };
});

// every navigation page.js was asked for, pushed or replaced
function navigations(): unknown[] {
    return [...pageMock.mock.calls, ...pageMock.replace.mock.calls].map((c) => c[0]);
}

describe("the dialog host", () => {
    let host: DialogHost;
    let unsubscribe = () => {};

    beforeEach(() => {
        vi.clearAllMocks();
        routerReadyStore.set(true);
        host = new DialogHost(() => "/chats");
        // as the router subscribes it
        unsubscribe = answerNavigations(host);
    });
    afterEach(() => unsubscribe());

    test("invariant 1: navigate() with a dialog open closes it, then makes exactly the navigation asked for, once", () => {
        host.show({
            kind: "user",
            clicked: { userId: "u1", chatButton: true, inGlobalContext: false },
        });
        navigate("/communities", "auto");
        expect(host.open).toBeUndefined();
        expect(navigations()).toEqual(["/communities"]);
    });

    test("invariant 1: a dialog's own close navigation never replaces or repeats it", () => {
        // closing this one by hand goes to the default scope ("/chats")
        host.show({ kind: "app_event", dialog: { kind: "not_found" } });
        const cancelled = vi.fn();
        host.holdPrompt(cancelled);
        navigate("/communities", "auto");
        expect(host.open).toBeUndefined();
        expect(cancelled).toHaveBeenCalledOnce();
        expect(navigations()).toEqual(["/communities"]);
    });

    test("invariant 4: a navigation declines an open rules prompt, so a message is never sent with another chat's rules accepted", () => {
        const stopWatching = host.watchRulesPrompt(captureRulesAcceptanceStore);
        // as the client's prompt does: answering it clears the store
        const resolve = vi.fn(() => captureRulesAcceptanceStore.set(undefined));
        captureRulesAcceptanceStore.set({ resolve });
        navigate("/communities", "auto");
        expect(resolve).toHaveBeenCalledExactlyOnceWith(false);
        expect(navigations()).toEqual(["/communities"]);
        stopWatching();
    });
});
