import type { AccessGate, ActiveLeafGate } from "@shared";
import { describe, expect, test } from "vitest";
import { editableGates, gateWithHidden } from "./accessGates";

const unique: ActiveLeafGate = { kind: "unique_person_gate" };
const referred: ActiveLeafGate = { kind: "referred_by_member_gate" };
const diamond: ActiveLeafGate = { kind: "diamond_gate" };
const chit: ActiveLeafGate = { kind: "chit_earned_gate", minEarned: 100 };

describe("editable gates", () => {
    // 4a invariant 3: the gates editor never shows a unique-person gate, and a config read and
    // written back keeps a dormant one unchanged
    test("never shows a unique-person gate, and writing the shown gates back keeps it", () => {
        const configs: AccessGate[] = [
            unique,
            { kind: "composite_gate", operator: "or", gates: [diamond, unique, chit] },
        ];
        for (const gate of configs) {
            const { shown, operator } = editableGates(gate);
            expect(shown.map((g) => g.kind)).not.toContain("unique_person_gate");
            const back = gateWithHidden(shown, operator, gate);
            const kinds = (g: AccessGate) =>
                (g.kind === "composite_gate" ? g.gates : [g]).map((l) => l.kind).sort();
            expect(kinds(back)).toEqual(kinds(gate));
        }
    });

    test("a unique-person gate the editor hands back is dropped unless one was already there", () => {
        expect(gateWithHidden([diamond, unique], "and", { kind: "no_gate" })).toEqual(diamond);
    });

    test("keeps a referred-by-member gate it doesn't show, and removing every shown gate leaves only it", () => {
        const gate: AccessGate = {
            kind: "composite_gate",
            operator: "and",
            gates: [chit, referred],
        };
        expect(editableGates(gate).shown).toEqual([chit]);
        expect(gateWithHidden([], "and", gate)).toEqual(referred);
        expect(gateWithHidden([], "and", diamond)).toEqual({ kind: "no_gate" });
    });
});
