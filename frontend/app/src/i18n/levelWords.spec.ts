import type { Level, MessageFormatter } from "@client";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import { i18nKey, interpolate, interpolateNewUi } from "./i18n";

type Messages = { [key: string]: string | Messages };

const locales = import.meta.glob<Messages>("./*.json", { import: "default", eager: true });

function messages(code: string): Messages {
    return locales[`./${code}.json`];
}

// svelte-i18n's lookup and formatting, over one locale's real translations
function formatter(code: string): MessageFormatter {
    return (id, options) => {
        let message: string | Messages | undefined = messages(code);
        for (const part of id.split(".")) {
            message = typeof message === "object" ? message[part] : undefined;
        }
        if (typeof message !== "string") return id;
        return String(new IntlMessageFormat(message, code).format(options?.values));
    };
}

const levels: Level[] = ["group", "channel", "community"];

/** Invariant: every locale has the new UIs' noun for each level. */
describe("levelNoun", () => {
    test.each(Object.keys(locales).map((path) => path.slice(2, -5)))("%s has all three", (code) => {
        const nouns = messages(code).levelNoun as Messages;
        for (const level of levels) {
            expect(typeof nouns[level]).toBe("string");
            expect((nouns[level] as string).trim()).not.toBe("");
        }
    });
});

/** Invariant: the new UIs' {level} comes from levelNoun.*; the old trees' from level.*, as before. */
describe("a resource key's {level}", () => {
    const fr = formatter("fr");
    const de = formatter("de");
    const en = formatter("en");

    test("the new UIs name a channel in French with the noun, capitalised or not", () => {
        expect(interpolateNewUi(fr, i18nKey("joinGroup", undefined, "channel", true))).toBe(
            "Rejoindre canal",
        );
        expect(interpolateNewUi(fr, i18nKey("deleteGroupSuccess", undefined, "channel"))).toBe(
            "Canal supprimé avec succès",
        );
    });

    test("the old trees still show what they did", () => {
        expect(interpolate(fr, i18nKey("joinGroup", undefined, "channel", true))).toBe(
            "Rejoindre canaliser",
        );
        expect(interpolate(fr, i18nKey("deleteGroupSuccess", undefined, "channel"))).toBe(
            "Canaliser supprimé avec succès",
        );
        expect(interpolate(de, i18nKey("joinGroup", undefined, "group", true))).toBe(
            "gruppe Beitreten",
        );
        expect(interpolate(en, i18nKey("deleteGroup", undefined, "community"))).toBe(
            "Delete Community",
        );
    });

    test("a German noun keeps its capital mid-sentence in the new UIs", () => {
        expect(interpolateNewUi(de, i18nKey("joinGroup", undefined, "group", true))).toBe(
            "Gruppe Beitreten",
        );
    });

    test("English reads the same in both", () => {
        for (const level of levels) {
            for (const lowercase of [true, false]) {
                const key = i18nKey("deleteGroup", undefined, level, lowercase);
                expect(interpolateNewUi(en, key)).toBe(interpolate(en, key));
            }
        }
    });

    test("a key without a level is the same in both", () => {
        const key = i18nKey("leaveGroup", { level: "x" });
        expect(interpolateNewUi(fr, key)).toBe(interpolate(fr, key));
    });
});
