import { _, addMessages, init, json, locale, waitLocale } from "svelte-i18n";
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
        uiTranslate(read(json), key, params, read(locale) ?? "en");

    afterEach(() => {
        vi.restoreAllMocks();
    });

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
    });

    test("formats in the current locale, whichever locale a message was first formatted in", async () => {
        addMessages("en", {
            ui: { test: { hours: "{count, plural, one {# hour} other {# hours}}" } },
        });
        addMessages("de", {});
        expect(t("ui.test.hours", { count: 1234 })).toBe("1,234 hours");
        await locale.set("de");
        expect(t("ui.test.hours", { count: 1234 })).toBe("1.234 hours");
        await locale.set("en");
    });

    test("writes boolean and date params the way the library's own interpolation does", () => {
        addMessages("en", { ui: { test: { flag: "Flag {b} end" } } });
        const date = new Date(0);
        expect(t("ui.test.flag", { b: true })).toBe("Flag true end");
        expect(t("ui.test.flag", { b: false })).toBe("Flag false end");
        expect(t("ui.test.flag", { b: date })).toBe(`Flag ${String(date)} end`);
    });

    test("logs a broken translation and shows what the library's interpolation makes of it", () => {
        addMessages("en", { ui: { test: { broken: "Hello {name" } } });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(t("ui.test.broken", { name: "Ana" })).toBe("Hello {name");
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining(`"ui.test.broken"`),
            expect.anything(),
        );
    });

    test("passes literal text through, filling its placeholders", () => {
        expect(t("General chat")).toBe("General chat");
        expect(t("Hi {name}", { name: "Ana" })).toBe("Hi Ana");
    });

    test("leaves literal text alone when it matches one of the app's own keys", () => {
        addMessages("en", { home: "Home" }); // one of the app's keys
        expect(read(_)("home")).toBe("Home");
        expect(uiTranslate(read(json), "home", undefined, "en")).toBe("home");
    });

    test("uses the library's bundled English when svelte-i18n has no locale", () => {
        const noLocale = () => undefined;
        expect(uiTranslate(noLocale, "ui.common.cancel", undefined, "en")).toBe("Cancel");
        expect(uiTranslate(noLocale, "ui.duration.hours", { count: 2 }, "en")).toBe("2 hours");
    });

    test("falls back to the library's English in a locale without its keys", async () => {
        addUiMessages();
        await locale.set("fr");
        expect(t("ui.common.cancel")).toBe("Cancel");
        await locale.set("en");
    });
});
