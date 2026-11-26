import { describe, expect, test } from "vitest";
import { assetOf, GateEntryDraft } from "./gateEntryDraft.svelte";

describe("the gate entry being added or changed", () => {
    test("a new one has nothing picked; changing one starts from its token", () => {
        const draft = new GateEntryDraft();
        const pay = {
            kind: "payment_gate" as const,
            ledgerCanister: "icp",
            amount: 1n,
            fee: 0n,
        };
        draft.startEdit(pay);
        expect(draft.editing).toBe(pay);
        expect(draft.asset).toBe("icp");
        draft.startNew();
        expect(draft.editing).toBeUndefined();
        expect(draft.asset).toBeUndefined();
    });

    test("an entry's token or nervous system", () => {
        expect(
            assetOf({
                kind: "neuron_gate",
                governanceCanister: "gov",
                minDissolveDelay: undefined,
                minStakeE8s: undefined,
            }),
        ).toBe("gov");
        expect(assetOf({ kind: "diamond_gate" })).toBeUndefined();
    });
});
