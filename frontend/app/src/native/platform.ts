// The platform the native tree draws for (native design notes §2): iOS and Android differ in the back
// affordance, the kebab, the composer's order and the touch targets, all from the root's data-os.

export type NativeOs = "ios" | "android";

/**
 * The app's own platform in the Tauri apps; in a browser, the one its user agent says, with iOS
 * for anything that isn't Android (the design is iOS first, as the prototype's entry picks).
 */
export function nativeOs(app: NativeOs | undefined, userAgent: string): NativeOs {
    if (app !== undefined) return app;
    return /android/i.test(userAgent) ? "android" : "ios";
}
