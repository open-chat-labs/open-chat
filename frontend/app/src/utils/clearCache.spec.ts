import { invoke } from "@tauri-apps/api/core";
import { clearCacheAndRestart } from "./clearCache";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

describe("clearing the cache", () => {
    const reload = vi.fn();

    beforeEach(() => {
        vi.stubGlobal("location", { ...window.location, reload });
        reload.mockClear();
        vi.mocked(invoke).mockClear();
    });

    afterEach(() => vi.unstubAllGlobals());

    test("clears it, then reloads the page in a browser", async () => {
        const client = { clearCachedData: vi.fn(async () => undefined), isNativeApp: () => false };
        await clearCacheAndRestart(client);
        expect(client.clearCachedData).toHaveBeenCalled();
        expect(reload).toHaveBeenCalled();
        expect(invoke).not.toHaveBeenCalled();
    });

    test("restarts the native app", async () => {
        const client = { clearCachedData: vi.fn(async () => undefined), isNativeApp: () => true };
        await clearCacheAndRestart(client);
        expect(invoke).toHaveBeenCalledWith("plugin:oc|restart_app");
        expect(reload).not.toHaveBeenCalled();
    });
});
