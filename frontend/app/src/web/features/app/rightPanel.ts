import { lastRightPanelState, setRightPanelHistory, type RightPanelContent } from "@client";
import type { RightColumnState } from "../../shell/rightColumn.svelte";

/**
 * Opens the right column whenever a new panel is asked for (details, members, a thread …), as the
 * old UI shows its right panel whenever its history has one. What the history held when this
 * starts doesn't open it. Returns the unsubscribe.
 */
export function openOnNewPanel(column: RightColumnState): () => void {
    let last: RightPanelContent | undefined;
    return lastRightPanelState.subscribe((panel) => {
        if (last !== undefined && panel !== last && panel.kind !== "no_panel") {
            column.open = true;
        }
        last = panel;
    });
}

/**
 * Closes the right column and clears its history, as closing the old floating panel did (which
 * also drops an open thread from the URL).
 */
export function closeRightColumn(column: RightColumnState): void {
    setRightPanelHistory([]);
    column.open = false;
}
