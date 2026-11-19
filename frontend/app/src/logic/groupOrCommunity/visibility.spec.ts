import { interpolate } from "@i18n/i18n";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import en from "../../i18n/en.json";
import { visibilityLabel } from "./visibility";

// svelte-i18n's formatter, over the English strings
function format(key: string, options?: { values?: Record<string, string> }): string {
    const message = key
        .split(".")
        .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en);
    if (typeof message !== "string") return key;
    return String(new IntlMessageFormat(message, "en").format(options?.values));
}

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
        expect(interpolate(format as Parameters<typeof interpolate>[0], label)).toBe(text);
    });

    test("reuses the old details' keys, the kind in lower case", () => {
        expect(visibilityLabel({ public: false, level: "channel" })).toEqual({
            kind: "resource_key",
            key: "group.privateGroup",
            params: undefined,
            level: "channel",
            lowercase: true,
        });
    });
});
