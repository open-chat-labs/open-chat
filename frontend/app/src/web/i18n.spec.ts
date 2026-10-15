import { _, init, json, locale, waitLocale } from "svelte-i18n";
import { addUiMessages, uiTranslate } from "./i18n";

// The current value of one of svelte-i18n's stores
function read<T>(store: { subscribe(run: (value: T) => void): () => void }): T {
    let value!: T;
    store.subscribe((v) => (value = v))();
    return value;
}

describe("the @openchat/ui translator", () => {
    beforeAll(async () => {
        addUiMessages();
        init({ fallbackLocale: "en", initialLocale: "en" });
        await waitLocale();
    });

    const t = (key: string, params?: Record<string, string | number>) =>
        uiTranslate(read(_), read(json), key, params, read(locale) ?? "en");

    test("resolves the library's keys through svelte-i18n", () => {
        expect(t("ui.common.cancel")).toBe("Cancel");
    });

    test("formats ICU params in the library's messages", () => {
        expect(t("ui.duration.hours", { count: 2 })).toBe("2 hours");
    });

    test("passes literal text through, filling its placeholders", () => {
        expect(t("General chat")).toBe("General chat");
        expect(t("Hi {name}", { name: "Ana" })).toBe("Hi Ana");
    });

    test("falls back to the library's English in a locale without its keys", async () => {
        addUiMessages();
        await locale.set("fr");
        expect(t("ui.common.cancel")).toBe("Cancel");
        await locale.set("en");
    });
});
