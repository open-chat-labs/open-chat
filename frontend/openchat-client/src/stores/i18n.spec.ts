import { _, addMessages, init, locale } from "svelte-i18n";
import { get } from "svelte/store";
import { applyTranslationCorrection } from "./i18n";

addMessages("en", { some: { thing: "yes", other: "no" } });
addMessages("xx", { some: { thing: "oui", other: "non" } });

init({
    fallbackLocale: "en",
});

describe("applying a translation correction", () => {
    test("to a language", async () => {
        await locale.set("xx");
        expect(get(_)("some.thing")).toBe("oui");

        applyTranslationCorrection("xx", "some.thing", "ouais");

        expect(get(_)("some.thing")).toBe("ouais");
        expect(get(_)("some.other")).toBe("non");
    });

    // Translations are registered per language, so the dialect has none of its own until now
    test("to a dialect shows for that dialect, which keeps its language's other messages", async () => {
        await locale.set("xx-YY");
        expect(get(_)("some.thing")).toBe("ouais");

        applyTranslationCorrection("xx-YY", "some.thing", "mais oui");

        expect(get(_)("some.thing")).toBe("mais oui");
        expect(get(_)("some.other")).toBe("non");
    });
});
