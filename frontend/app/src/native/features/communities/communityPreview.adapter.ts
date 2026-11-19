import {
    i18nKey,
    isCompositeGate,
    type AccessGate,
    type EnhancedAccessGate,
    type EnhancedTokenDetails,
    type ReadonlyMap,
    type ResourceKey,
} from "@client";
import { gateLeaves } from "@src/logic/access/gateEvaluation.svelte";
import { durationParts, ttlDurationId } from "@src/logic/chats/disappearingMessages";
import { sheetRows, type SheetRow, type SheetRowState } from "../join/joinSheet.adapter";

// A community's preview (N8b PR 3, native plan 12 "Preview and join"): the Requirements card, each
// requirement joining asks for with the user's status. The rows are the requirements sheet's
// (joinSheet.adapter), so the card and the sheet never disagree; the card shows them all, met ones
// included, where the sheet moves past a level once it's met.

/** A requirement's row on the card: the sheet's, with its status in words. */
export type RequirementRow = SheetRow & { status: ResourceKey };

export type RequirementCard = {
    rows: RequirementRow[];
    /** Under the card: whether every requirement or any one lets you in, and how often members are re-checked. */
    notes: ResourceKey[];
};

const STATUS: Record<SheetRowState, string> = {
    met: "native.community.preview.met",
    pay: "native.community.preview.onJoin",
    short: "native.community.preview.notMet",
    todo: "native.community.preview.toDo",
};

/**
 * The card for the gate joining a community asks for (`accessGatesForCommunity`), with what the
 * client knows the user meets, their tokens, and whether this is a store build (as the sheet).
 */
export function requirementCard(
    gate: EnhancedAccessGate,
    meets: (gate: AccessGate) => boolean,
    tokens: ReadonlyMap<string, EnhancedTokenDetails>,
    store: boolean,
): RequirementCard {
    const leaves = gateLeaves(gate).map((leaf) => ({ ...leaf, satisfied: meets(leaf) }));
    const rows = sheetRows(leaves, tokens, false, store).map((row) => ({
        ...row,
        status: i18nKey(STATUS[row.state]),
    }));
    const notes: ResourceKey[] = [];
    if (isCompositeGate(gate) && rows.length > 1) {
        notes.push(
            i18nKey(
                gate.operator === "and"
                    ? "native.community.preview.all"
                    : "native.community.preview.any",
            ),
        );
    }
    const recheck =
        gate.expiry === undefined || gate.expiry <= 0n
            ? undefined
            : durationParts(ttlDurationId(gate.expiry));
    if (recheck !== undefined) {
        notes.push(
            i18nKey(`native.community.preview.recheck.${recheck.unit}`, { count: recheck.count }),
        );
    }
    return { rows, notes };
}
