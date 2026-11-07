import {
    lastRightPanelState,
    messageIndexStore,
    rightPanelHistory,
    selectedChatIdStore,
    setRightPanelHistory,
    threadMessageIndexStore,
    threadOpenStore,
    type ChatIdentifier,
    type ChatListScope,
    type RightPanelContent,
} from "@client";
import { isRouteThread, threadClosedPath, threadOpenPath } from "@src/logic/threads/threadUrl";
import { navigate } from "@src/utils/navigation";
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

/** What a change of the right column's panel does to the column (`openOnNewPanel`). */
export type ColumnChange = "none" | "open" | "show_thread" | "thread_closed";

/**
 * What the right column does when its panel changes from `previous` (undefined: what it held when
 * this started, which doesn't open it) to `next`. A thread shows whether or not the column was
 * open, and the column goes back to how the user had it when the thread goes; any other new panel
 * opens it, as the old UI shows its right panel whenever its history has one (the old desktop's
 * thread replaced the history, and its panel went with it).
 */
export function columnChange(
    previous: RightPanelContent | undefined,
    next: RightPanelContent,
): ColumnChange {
    if (previous === undefined || next === previous) return "none";
    if (next.kind === "message_thread_panel") return "show_thread";
    if (next.kind !== "no_panel") return "open";
    // the thread went, and nothing was under it (opening one replaces the history)
    return previous.kind === "message_thread_panel" ? "thread_closed" : "none";
}

/**
 * Opens the right column whenever a new panel is asked for (details, members …), and shows it for
 * a thread, docked or as the modal, even when the user had closed it, until the thread closes
 * (`columnChange`). Returns the unsubscribe.
 */
export function openOnNewPanel(column: RightColumnState): () => void {
    let last: RightPanelContent | undefined;
    return lastRightPanelState.subscribe((panel) => {
        switch (columnChange(last, panel)) {
            case "open":
                column.open = true;
                break;
            case "show_thread":
                column.showThread();
                break;
            case "thread_closed":
                column.threadClosed();
                break;
        }
        last = panel;
    });
}

/**
 * Opens the right column on `panel` alone, whatever it showed before, as the old header's chat name
 * (the chat's details) and pin icon (its pinned messages) did.
 */
export function showInRightColumn(column: RightColumnState, panel: RightPanelContent): void {
    setRightPanelHistory([panel]);
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

/**
 * Closes the open thread: it goes from the right column's history, and from the URL (`/:tmi` and
 * `?open`, keeping the rest of the query: ROUTES.md, "Threads"), as the old right panel closed it.
 * TODO(phase 7): the call's thread state (the old panel's `activeVideoCall.threadOpen(false)`).
 */
export function closeThread(): void {
    // not setRightPanelHistory, which takes `?open` off the URL itself (a second navigation)
    rightPanelHistory.update((history) =>
        history.filter((panel) => panel.kind !== "message_thread_panel"),
    );
    navigate(threadClosedPath(location.pathname, location.search, threadMessageIndexStore.value));
}

/**
 * Opens a thread in the right column: at its root's own path (`threadOpenPath`, keeping the list
 * of threads), which shows the column (`openOnNewPanel`). The thread already open doesn't change
 * the route, so the column is shown here: the user may have closed it over the thread.
 */
export function openThreadInColumn(
    column: RightColumnState,
    scope: ChatListScope["kind"],
    chatId: ChatIdentifier,
    threadRootMessageIndex: number,
): void {
    const route = {
        open: threadOpenStore.value,
        chatId: selectedChatIdStore.value,
        messageIndex: messageIndexStore.value,
    };
    if (isRouteThread(route, chatId, threadRootMessageIndex)) {
        column.showThread();
        return;
    }
    navigate(threadOpenPath(scope, chatId, threadRootMessageIndex, location.search));
}
