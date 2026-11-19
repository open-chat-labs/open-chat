import { interpolate } from "@i18n/i18n";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import de from "../../i18n/de.json";
import en from "../../i18n/en.json";
import { visibilityLabel } from "./visibility";

const locales = import.meta.glob<Record<string, unknown>>("../../i18n/*.json", {
    eager: true,
    import: "default",
});

function lookup(strings: Record<string, unknown>, key: string): unknown {
    return key
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], strings);
}

// svelte-i18n's formatter, over one locale's strings
function formatter(strings: Record<string, unknown>, locale: string) {
    return (key: string, options?: { values?: Record<string, string> }): string => {
        const message = lookup(strings, key);
        if (typeof message !== "string") return key;
        return String(new IntlMessageFormat(message, locale).format(options?.values));
    };
}

const kinds = [
    [true, "group"],
    [false, "group"],
    [true, "channel"],
    [false, "channel"],
    [true, "community"],
    [false, "community"],
] as const;

describe("visibilityLabel", () => {
    test.each([
        [true, "group", "Public group"],
        [false, "group", "Private group"],
        [true, "channel", "Public channel"],
        [false, "channel", "Private channel"],
        [true, "community", "Public community"],
        [false, "community", "Private community"],
    ] as const)("public: %s, a %s, reads %s", (isPublic, level, text) => {
        const label = visibilityLabel({ public: isPublic, level });
        const format = formatter(en, "en") as Parameters<typeof interpolate>[0];
        expect(interpolate(format, label)).toBe(text);
    });

    test("is a whole phrase, so another language can make the adjective agree", () => {
        const format = formatter(de, "de") as Parameters<typeof interpolate>[0];
        expect(interpolate(format, visibilityLabel({ public: true, level: "channel" }))).toBe(
            "Öffentlicher Kanal",
        );
        expect(interpolate(format, visibilityLabel({ public: false, level: "group" }))).toBe(
            "Private Gruppe",
        );
    });

    test("every locale translates every kind", () => {
        expect(Object.keys(locales).length).toBeGreaterThan(1);
        for (const [file, strings] of Object.entries(locales)) {
            for (const [isPublic, level] of kinds) {
                const { key } = visibilityLabel({ public: isPublic, level });
                expect(typeof lookup(strings, key), `${file}: ${key}`).toBe("string");
            }
        }
    });
});
