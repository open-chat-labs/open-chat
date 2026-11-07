import { vi } from "vitest";
import { ScreenModules, type ModuleLoader } from "./screenModules";

type Kind = "chats" | "you" | "settings" | "wallet";

function deferred() {
    let resolve!: (value: { default: string }) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<{ default: string }>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function loaderOf(name: string) {
    return vi.fn<ModuleLoader<string>>(async () => ({ default: name }));
}

describe("the screens' chunks", () => {
    test("a screen shows at once once its chunk is in, and never before", async () => {
        const modules = new ScreenModules<Kind, string>({ you: loaderOf("You") });
        expect(modules.loaded("you")).toBeUndefined();
        expect(modules.ready(["you"])).toBe(false);
        expect(await modules.load("you")).toBe("You");
        expect(modules.loaded("you")).toBe("You");
        expect(modules.ready(["you"])).toBe(true);
    });

    test("a kind with no screen yet is ready (its placeholder needs no chunk)", async () => {
        const modules = new ScreenModules<Kind, string>({ wallet: undefined });
        expect(modules.has("wallet")).toBe(false);
        expect(modules.ready(["wallet"])).toBe(true);
        expect(await modules.load("wallet")).toBeUndefined();
    });

    test("loads a chunk once, however many ask for it meanwhile", async () => {
        const chunk = deferred();
        const loader = vi.fn(() => chunk.promise);
        const modules = new ScreenModules<Kind, string>({ settings: loader });
        const a = modules.load("settings");
        const b = modules.load("settings");
        chunk.resolve({ default: "Settings" });
        expect(await a).toBe("Settings");
        expect(await b).toBe("Settings");
        await modules.load("settings");
        expect(loader).toHaveBeenCalledTimes(1);
    });

    test("tries a chunk that didn't load again the next time", async () => {
        const loader = vi
            .fn<ModuleLoader<string>>()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce({ default: "You" });
        const modules = new ScreenModules<Kind, string>({ you: loader });
        await expect(modules.load("you")).rejects.toThrow("offline");
        expect(modules.ready(["you"])).toBe(false);
        expect(await modules.load("you")).toBe("You");
    });

    test("waits for a stack's screens together", async () => {
        const modules = new ScreenModules<Kind, string>({
            you: loaderOf("You"),
            settings: loaderOf("Settings"),
        });
        await modules.loadAll(["you", "settings", "wallet"]);
        expect(modules.ready(["you", "settings", "wallet"])).toBe(true);
    });

    test("preloads every screen, the tabs' roots first, past one that doesn't load", async () => {
        const order: string[] = [];
        const track = (name: string, fails = false) =>
            vi.fn(async () => {
                order.push(name);
                if (fails) throw new Error("offline");
                return { default: name };
            });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const modules = new ScreenModules<Kind, string>(
            {
                settings: track("Settings"),
                wallet: undefined,
                you: track("You", true),
                chats: track("Chats"),
            },
            ["chats", "you"],
        );
        await modules.preload();
        expect(order).toEqual(["Chats", "You", "Settings"]);
        expect(modules.ready(["chats", "settings"])).toBe(true);
        expect(modules.ready(["you"])).toBe(false);
        warn.mockRestore();
    });
});
