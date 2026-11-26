import type { CandidateTranslations, OpenChat } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    TRANSLATING_PLACEHOLDER,
    TRANSLATION_UNAVAILABLE,
    TranslationCorrections,
    flattenCorrections,
    requiredLocales,
} from "./translationCorrections.svelte";

type CorrectionsClient = Pick<
    OpenChat,
    | "getProposedTranslationCorrections"
    | "refreshTranslationsBalance"
    | "approveTranslationCorrection"
    | "rejectTranslationCorrection"
    | "translateText"
>;

const candidates: CandidateTranslations[] = [
    {
        locale: "fr",
        key: "zebra",
        deploymentCount: 0,
        candidates: [{ id: 1n, value: "zèbre", proposedBy: "u1", proposedAt: 10n }],
    },
    {
        locale: "de",
        key: "apple",
        deploymentCount: 0,
        candidates: [
            { id: 2n, value: "Apfel", proposedBy: "u2", proposedAt: 20n },
            { id: 3n, value: "Äpfel", proposedBy: "u3", proposedAt: 30n },
        ],
    },
    {
        locale: "fr",
        key: "banana",
        deploymentCount: 0,
        candidates: [{ id: 4n, value: "banane", proposedBy: "u1", proposedAt: 40n }],
    },
] as CandidateTranslations[];

function client(overrides: Partial<CorrectionsClient> = {}): CorrectionsClient {
    return {
        getProposedTranslationCorrections: async () => candidates,
        refreshTranslationsBalance: async () => 123n,
        approveTranslationCorrection: async () => true,
        rejectTranslationCorrection: async () => true,
        translateText: async () => "in English",
        ...overrides,
    };
}

describe("flattenCorrections", () => {
    test("one row per candidate, with its group's locale and key, sorted by key", () => {
        const rows = flattenCorrections(candidates);
        expect(rows.map((r) => [r.key, r.locale, r.id])).toEqual([
            ["apple", "de", 2n],
            ["apple", "de", 3n],
            ["banana", "fr", 4n],
            ["zebra", "fr", 1n],
        ]);
        expect(rows[0]).toEqual({
            id: 2n,
            locale: "de",
            key: "apple",
            value: "Apfel",
            proposedBy: "u2",
            proposedAt: 20n,
        });
    });
});

describe("requiredLocales", () => {
    test("each locale once", () => {
        expect(requiredLocales(flattenCorrections(candidates))).toEqual(["de", "fr"]);
    });
});

describe("TranslationCorrections", () => {
    test("load loads the corrections' locales before showing them", async () => {
        const order: string[] = [];
        const corrections = new TranslationCorrections(client(), async (locales) => {
            order.push(`locales ${locales.join(",")}`);
        });
        const loading = corrections.load();
        expect(corrections.corrections).toEqual([]);
        expect(corrections.status).toBe("loading");
        await loading;
        expect(order).toEqual(["locales de,fr"]);
        expect(corrections.corrections).toHaveLength(4);
        expect(corrections.status).toBe("ready");
    });

    test("a list that can't be loaded says so", async () => {
        const failing = {
            ...client(),
            getProposedTranslationCorrections: async () => {
                throw new Error("offline");
            },
        };
        const corrections = new TranslationCorrections(failing, async () => undefined);
        await corrections.load();
        expect(corrections.status).toBe("failed");
        expect(corrections.corrections).toEqual([]);
    });

    test("an approved correction leaves the list; one that fails stays and says so", async () => {
        const approve = vi.fn(async (id: bigint) => id === 2n);
        const corrections = new TranslationCorrections(
            client({ approveTranslationCorrection: approve }),
            async () => undefined,
        );
        await corrections.load();
        const [first, second] = corrections.corrections;

        const pending = corrections.approve(first);
        expect(corrections.processing.has(2n)).toBe(true);
        expect(await pending).toEqual({ kind: "success" });
        expect(corrections.processing.has(2n)).toBe(false);
        expect(corrections.corrections.map((c) => c.id)).toEqual([3n, 4n, 1n]);

        const failed = await corrections.approve(second);
        expect(failed).toEqual({
            kind: "failed",
            message: expect.objectContaining({
                key: "Sorry we were unable to approve this correction",
            }),
        });
        expect(corrections.corrections.map((c) => c.id)).toEqual([3n, 4n, 1n]);
    });

    test("reject passes the reason on", async () => {
        const reject = vi.fn(async () => false);
        const corrections = new TranslationCorrections(
            client({ rejectTranslationCorrection: reject }),
            async () => undefined,
        );
        await corrections.load();
        const outcome = await corrections.reject(corrections.corrections[0], "too_long");
        expect(reject).toHaveBeenCalledWith(2n, "too_long");
        expect(outcome.kind).toBe("failed");
        expect(corrections.corrections).toHaveLength(4);
    });

    test("verify shows a placeholder, then the English, translated once", async () => {
        const translate = vi.fn(async () => "Apple");
        const corrections = new TranslationCorrections(
            client({ translateText: translate }),
            async () => undefined,
        );
        await corrections.load();
        const row = corrections.corrections[0];

        const verifying = corrections.verify(row);
        expect(corrections.proposedValue(row)).toBe(TRANSLATING_PLACEHOLDER);
        expect(corrections.proposedValue(corrections.corrections[1])).toBe("Äpfel");
        await verifying;
        expect(corrections.isVerifying(row)).toBe(true);
        expect(corrections.proposedValue(row)).toBe("Apple");

        corrections.showProposed();
        expect(corrections.proposedValue(row)).toBe("Apfel");

        await corrections.verify(row);
        expect(translate).toHaveBeenCalledTimes(1);
        expect(translate).toHaveBeenCalledWith("Apfel", "en");
    });

    test("verify says so when there's no translation", async () => {
        const corrections = new TranslationCorrections(
            client({ translateText: async () => undefined }),
            async () => undefined,
        );
        await corrections.load();
        await corrections.verify(corrections.corrections[0]);
        expect(corrections.proposedValue(corrections.corrections[0])).toBe(TRANSLATION_UNAVAILABLE);
    });

    test("refreshBalance spins while it runs", async () => {
        const corrections = new TranslationCorrections(client(), async () => undefined);
        const refreshing = corrections.refreshBalance();
        expect(corrections.refreshing).toBe(true);
        await refreshing;
        expect(corrections.refreshing).toBe(false);
        expect(corrections.chatBalance).toBe(123n);
    });
});
