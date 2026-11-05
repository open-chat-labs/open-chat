import { nativeOs } from "./platform";

const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

describe("the native tree's platform", () => {
    test("is the app's own in the Tauri apps, whatever the user agent says", () => {
        expect(nativeOs("android", IPHONE_SAFARI)).toBe("android");
        expect(nativeOs("ios", ANDROID_CHROME)).toBe("ios");
    });

    test("is the user agent's in a browser", () => {
        expect(nativeOs(undefined, ANDROID_CHROME)).toBe("android");
        expect(nativeOs(undefined, IPHONE_SAFARI)).toBe("ios");
    });

    test("is iOS for a browser that isn't Android", () => {
        expect(nativeOs(undefined, "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("ios");
        expect(nativeOs(undefined, "")).toBe("ios");
    });
});
