import { haptic } from "tauri-plugin-oc-api";
import { hostHaptics } from "./haptics";

vi.mock("tauri-plugin-oc-api", () => ({ haptic: vi.fn(async () => {}) }));

describe("the native root's haptics", () => {
    beforeEach(() => {
        vi.mocked(haptic).mockClear();
    });

    test("are the plugin's light tap in the apps", () => {
        hostHaptics(true)("light");
        expect(haptic).toHaveBeenCalledTimes(1);
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
