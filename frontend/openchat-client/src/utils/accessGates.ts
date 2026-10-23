import { isCompositeGate, type AccessGate, type ActiveLeafGate, type LeafGate } from "@shared";

/** A gate config's leaves, split into those an editor shows and those it keeps but never shows. */
export type EditableGates = {
    shown: ActiveLeafGate[];
    // the suspended unique-person gate, and gates the editor has no row for (referred by a
    // member, NFT): written back unchanged
    hidden: ActiveLeafGate[];
    operator: "and" | "or";
};

function isHidden(gate: LeafGate): boolean {
    return (
        gate.kind === "unique_person_gate" ||
        gate.kind === "referred_by_member_gate" ||
        gate.kind === "nft_gate"
    );
}

function leaves(gate: AccessGate): ActiveLeafGate[] {
    const all = isCompositeGate(gate) ? gate.gates : [gate];
    return all.filter((g): g is ActiveLeafGate => g.kind !== "no_gate");
}

export function editableGates(gate: AccessGate): EditableGates {
    const all = leaves(gate);
    return {
        shown: all.filter((g) => !isHidden(g)),
        hidden: all.filter(isHidden),
        operator: isCompositeGate(gate) ? gate.operator : "and",
    };
}

/**
 * The gate an editor's leaves make, with the original's hidden gates put back, so editing never
 * removes a gate the editor couldn't show. A unique-person gate the editor hands back is dropped:
 * that gate is suspended, and only one already there survives.
 */
export function gateWithHidden(
    shown: ActiveLeafGate[],
    operator: "and" | "or",
    original: AccessGate,
): AccessGate {
    const gates = [...shown.filter((g) => !isHidden(g)), ...editableGates(original).hidden];
    if (gates.length === 0) return { kind: "no_gate" };
    if (gates.length === 1) return gates[0];
    return { kind: "composite_gate", gates, operator };
}
