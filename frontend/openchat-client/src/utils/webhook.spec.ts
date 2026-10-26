import { describe, expect, test } from "vitest";
import en from "../../../app/src/i18n/en.json";
import { webhookChanges, webhookFailure } from "./webhook";

const original = { id: "w", name: "alerts", avatarUrl: "data:image/png;base64,AAA" };

describe("a webhook edit", () => {
    // an edit sends only what the user changed, and nothing when they changed nothing
    test("sends only the name or avatar that changed", () => {
        expect(webhookChanges(original, "alerts", original.avatarUrl)).toBeUndefined();
        expect(webhookChanges(original, "pings", original.avatarUrl)).toEqual({
            name: "pings",
            avatar: undefined,
        });
        expect(webhookChanges(original, "alerts", "data:image/png;base64,BBB")).toEqual({
            name: undefined,
            avatar: { value: "data:image/png;base64,BBB" },
        });
        expect(webhookChanges(original, "alerts", undefined)).toEqual({
            name: undefined,
            avatar: "set_to_none",
        });
    });

    // 4b invariant 3: a failed webhook save (or regenerate) maps to a message with words
    test("each failure has its message", () => {
        const words = (key: string) =>
            key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
        for (const what of ["register", "update", "regenerate"] as const) {
            expect(words(webhookFailure(what).key)).toEqual(expect.any(String));
        }
    });
});
