import { haptic } from "tauri-plugin-oc-api";
import { hostHaptics } from "./haptics";

vi.mock("tauri-plugin-oc-api", () => ({ haptic: vi.fn(async () => {}) }));

describe("the native root's haptics", () => {
    beforeEach(() => {
        vi.mocked(haptic).mockClear();
    });

    test("are the plugin's in the apps, in the style asked for", () => {
        const haptics = hostHaptics(true);
        haptics("light");
        expect(haptic).toHaveBeenLastCalledWith("light");
        haptics("medium");
        expect(haptic).toHaveBeenLastCalledWith("medium");
        expect(haptic).toHaveBeenCalledTimes(2);
    });

    test("are none on mobile web", () => {
        const vibrate = vi.fn();
        vi.stubGlobal("navigator", { vibrate });
        hostHaptics(false)("light");
        expect(haptic).not.toHaveBeenCalled();
        expect(vibrate).not.toHaveBeenCalled();
        vi.unstubAllGlobals();
    });

    test("drop a shell's refusal", async () => {
        vi.mocked(haptic).mockRejectedValueOnce(new Error("unknown command"));
        expect(() => hostHaptics(true)("light")).not.toThrow();
        // the rejection is handled, so nothing goes unhandled
        await Promise.resolve();
    });
});
