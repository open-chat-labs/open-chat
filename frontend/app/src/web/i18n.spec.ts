import { _, addMessages, getMessageFormatter, init, json, locale, waitLocale } from "svelte-i18n";
import type { I18nParams } from "@openchat/ui/src/lib/i18n";
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

    const t = (key: string, params?: I18nParams) =>
        uiTranslate(getMessageFormatter, read(json), key, params, read(locale) ?? "en");

    test("resolves the library's keys through svelte-i18n", () => {
        expect(t("ui.common.cancel")).toBe("Cancel");
    });

    test("formats ICU params in the library's messages", () => {
        expect(t("ui.duration.hours", { count: 2 })).toBe("2 hours");
    });

    test("formats the rest of a message when one of its params has no value", () => {
        addMessages("en", {
            ui: {
                test: { joined: "{name} joined {count, plural, one {# group} other {# groups}}" },
            },
        });
        const warn = vi.spyOn(console, "warn");
        expect(t("ui.test.joined", { name: undefined, count: 2 })).toBe("{name} joined 2 groups");
        expect(t("ui.test.joined", { name: null, count: 1 })).toBe("{name} joined 1 group");
        expect(t("ui.test.joined", { count: 2 })).toBe("{name} joined 2 groups");
        expect(t("ui.test.joined", { name: "Ana", count: 2 })).toBe("Ana joined 2 groups");
        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    test("passes literal text through, filling its placeholders", () => {
        expect(t("General chat")).toBe("General chat");
        expect(t("Hi {name}", { name: "Ana" })).toBe("Hi Ana");
    });

    test("leaves literal text alone when it matches one of the app's own keys", () => {
        addMessages("en", { home: "Home" }); // one of the app's keys
        expect(read(_)("home")).toBe("Home");
        expect(uiTranslate(getMessageFormatter, read(json), "home", undefined, "en")).toBe("home");
    });

    test("uses the library's bundled English when svelte-i18n has no locale", () => {
        const noLocale = () => undefined;
        const formatter = () => {
            throw new Error("svelte-i18n can't format without a locale");
        };
        expect(uiTranslate(formatter, noLocale, "ui.common.cancel", undefined, "en")).toBe(
            "Cancel",
        );
        expect(uiTranslate(formatter, noLocale, "ui.duration.hours", { count: 2 }, "en")).toBe(
            "2 hours",
        );
    });

    test("falls back to the library's English in a locale without its keys", async () => {
        addUiMessages();
        await locale.set("fr");
        expect(t("ui.common.cancel")).toBe("Cancel");
        await locale.set("en");
    });
});
