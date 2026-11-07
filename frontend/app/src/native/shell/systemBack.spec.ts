import { vi } from "vitest";

type Handler = () => void;

const registered = vi.hoisted(() => ({
    tauri: [] as (() => void)[],
    oc: [] as (() => void)[],
    unregistered: [] as string[],
    ocFails: false,
}));

function listener(name: string) {
    return { unregister: vi.fn(async () => void registered.unregistered.push(name)) };
}

vi.mock("@tauri-apps/api/app", () => ({
    onBackButtonPress: vi.fn(async (handler: Handler) => {
        registered.tauri.push(handler);
        return listener("tauri");
    }),
}));

vi.mock("@utils/native/notification_channels", () => ({
    expectBackPress: vi.fn(async (handler: Handler) => {
        if (registered.ocFails) throw new Error("no plugin");
        registered.oc.push(handler);
        return listener("oc");
    }),
}));

const { listenForSystemBack } = await import("./systemBack");

beforeEach(() => {
    registered.tauri = [];
    registered.oc = [];
    registered.unregistered = [];
    registered.ocFails = false;
});

describe("Android's system back", () => {
    // Tauri's back callback takes the WebView back through its history unless something listens
    // for its event: a settings page pushed without a URL went back to the URL before it (Chats)
    test("listens for Tauri's back button, so the WebView doesn't go back by itself", async () => {
        const handler = vi.fn();
        await listenForSystemBack(handler);
        expect(registered.tauri).toHaveLength(1);
        registered.tauri[0]();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("and for MainActivity's, whichever of the two takes the press", async () => {
        const handler = vi.fn();
        await listenForSystemBack(handler);
        expect(registered.oc).toHaveLength(1);
        registered.oc[0]();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    test("stops listening to both", async () => {
        const stop = await listenForSystemBack(vi.fn());
        stop();
        await Promise.resolve();
        expect(registered.unregistered.sort()).toEqual(["oc", "tauri"]);
    });

    test("still listens to one when the other can't be listened to", async () => {
        registered.ocFails = true;
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        const handler = vi.fn();
        const stop = await listenForSystemBack(handler);
        registered.tauri[0]();
        expect(handler).toHaveBeenCalledTimes(1);
        stop();
        await Promise.resolve();
        expect(registered.unregistered).toEqual(["tauri"]);
        error.mockRestore();
    });
});
