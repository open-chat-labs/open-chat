import type { ActiveLeafGate } from "@client";
import { GateEntryDraft } from "@src/logic/access/gateEntryDraft.svelte";
import type { UpdateGroupOrCommunityState } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
import {
    gateKey,
    gateRemovalLosses,
    operatorApplies,
    shownGates,
    withLossesRestored,
    withoutStaleExpiry,
} from "./settings.adapter";

// The Access gates page's draft, held while the page is open, for the screens it pushes over
// itself (a payment, minimum balance or neuron gate's entries: `gate_entries`), which edit the same
// gates. A local screen is pushed as data, so the draft can't go with it (as newGroupDraft). With
// it, the entry being added or changed.

export type HeldGates = { editor: UpdateGroupOrCommunityState; entry: GateEntryDraft };

let held: HeldGates[] = [];

/** Holds the gates page's `editor` for the screens it pushes; returns what lets it go. */
export function holdGatesEditor(editor: UpdateGroupOrCommunityState): () => void {
    const h: HeldGates = { editor, entry: new GateEntryDraft() };
    held = [...held, h];
    return () => {
        held = held.filter((x) => x !== h);
    };
}

/** The newest Access gates page's draft and entry, if one is open. */
export function gatesEditor(): HeldGates | undefined {
    return held[held.length - 1];
}

/**
 * Takes `gates` off the draft, with Undo (`toast` shows it, with what runs it): Undo puts back
 * those still gone, and what taking them off lost (how the gates combined, the re-check) unless
 * that's been set again, so what was done in between stays. Returns what takes the Undo down.
 */
export function takeOffGates(
    editor: UpdateGroupOrCommunityState,
    gates: ActiveLeafGate[],
    toast: (undo: () => void) => () => void,
): () => void {
    const before = $state.snapshot(editor.gateConfig);
    const removed = $state.snapshot(gates);
    for (const gate of gates) editor.deleteGate(gate);
    editor.candidate.gateConfig = withoutStaleExpiry($state.snapshot(editor.gateConfig));
    const losses = gateRemovalLosses(before, $state.snapshot(editor.gateConfig));
    return toast(() => {
        const current = $state.snapshot(editor.gateConfig);
        const there = shownGates(current).map(gateKey);
        const back = removed.filter((g) => !there.includes(gateKey(g)));
        if (back.length === 0) return;
        const wasComposite = operatorApplies(current);
        for (const gate of back) editor.addLeaf(gate);
        editor.candidate.gateConfig = withLossesRestored(
            $state.snapshot(editor.gateConfig),
            losses,
            wasComposite,
        );
    });
}
