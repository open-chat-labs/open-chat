import {
    lastRightPanelState,
    rightPanelHistory,
    setRightPanelHistory,
    type RightPanelContent,
} from "@client";
import type { RightColumnState } from "../../shell/rightColumn.svelte";

/**
 * The entry the right column reads (with `rightPanelView`). With a thread open in the URL it's
 * that thread, and nothing until the thread is in the history (its root message loading), not
 * what the history held before. Otherwise it's the last entry, or the selected chat's details
 * when nothing was asked for: the docked column stays open by preference, where the old panel hid.
 */
export function rightColumnPanel(last: RightPanelContent, threadOpen: boolean): RightPanelContent {
    if (threadOpen) return last.kind === "message_thread_panel" ? last : { kind: "no_panel" };
    return last.kind === "no_panel" ? { kind: "group_details" } : last;
}

/**
 * The history with `panel` opened on top of what the column shows. With nothing asked for yet the
 * column shows the chat's details (rightColumnPanel), so they go first: closing `panel` goes back
 * to them rather than closing the column.
 */
export function historyWith(
    history: readonly RightPanelContent[],
    panel: RightPanelContent,
): RightPanelContent[] {
    return history.length === 0 ? [{ kind: "group_details" }, panel] : [...history, panel];
}

/** Opens `panel` on top of what the right column shows (historyWith). */
export function openPanelOver(panel: RightPanelContent): void {
    setRightPanelHistory(historyWith(rightPanelHistory.value, panel));
}

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
 * Opens the right column on the chat's details, whatever it showed before, as clicking the chat's
 * name in the old header did.
 */
export function openChatDetails(column: RightColumnState): void {
    setRightPanelHistory([{ kind: "group_details" }]);
    column.open = true;
}

/**
 * Closes the right column and clears its history, as closing the old floating panel did (which
 * also drops an open thread from the URL).
 */
export function closeRightColumn(column: RightColumnState): void {
    setRightPanelHistory([]);
    column.open = false;
}
