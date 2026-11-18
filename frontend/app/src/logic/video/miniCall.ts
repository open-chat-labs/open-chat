import { chatIdentifiersEqual, routeForChatIdentifier, type ChatIdentifier } from "@client";
import type { VideoCallView } from "@src/stores/video";

// The minimised call (web 7c, and the old trees' call summaries): when it shows, and what going
// back to the call does. Minimised is local state, never the URL (ROUTES.md, "Not in the URL").

type Call = { chatId: ChatIdentifier; view: VideoCallView };

/**
 * #10126 invariant 2: the minimised call shows exactly when there is a call and it is minimised,
 * or its chat isn't the selected one (the call view is the chat's, so it can't show elsewhere).
 */
export function miniCallShows(
    call: Call | undefined,
    selected: ChatIdentifier | undefined,
): boolean {
    if (call === undefined) return false;
    return call.view === "minimised" || !chatIdentifiersEqual(call.chatId, selected);
}

/**
 * #10126 invariant 3: going back to the call sets its view to `default` and returns the route of
 * the call's chat to open, or undefined when that chat is already the selected one.
 */
export function backToCall(
    call: Call,
    selected: ChatIdentifier | undefined,
    setView: (view: VideoCallView) => void,
): string | undefined {
    setView("default");
    return chatIdentifiersEqual(call.chatId, selected)
        ? undefined
        : routeForChatIdentifier("none", call.chatId);
}
