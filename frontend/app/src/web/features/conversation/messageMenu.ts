import { i18nKey, publish, routeForChatIdentifier, type MessageMenuAction } from "@client";
import {
    messageAction,
    type MessageActionTarget,
    type MessageMenuDialog,
} from "@src/logic/conversation/messageAction";
import { toastStore } from "@src/stores/toast";
import { navigate } from "@src/utils/navigation";

export { deleteMessage } from "@src/logic/conversation/messageAction";

// What each of a message's actions does in the conversation or a thread (MessageActions, the
// hover bar and the swipes): the shared `messageAction`, and what came of it shown the web's way.
// One that needs the user first comes back as the dialog to show.

export type MessageMenuTarget = MessageActionTarget & {
    /** Opens the message's thread (by its index) in the right column (`openThreadInColumn`). */
    openThread: (threadRootMessageIndex: number) => void;
};

/**
 * Does what the action says to the message, or says which dialog to show first. Each action is
 * only run where `messageMenu` offered it.
 */
export async function runMessageAction(
    action: MessageMenuAction,
    target: MessageMenuTarget,
): Promise<MessageMenuDialog | undefined> {
    const outcome = await messageAction(action, target);
    switch (outcome.kind) {
        case "ask":
            return outcome.dialog;
        case "succeeded":
            toastStore.showSuccessToast(outcome.message);
            return;
        case "failed":
            toastStore.showFailureToast(outcome.message);
            return;
        case "open_chat":
            navigate(routeForChatIdentifier("chats", outcome.chatId));
            return;
        case "not_found":
            publish("notFound");
            return;
        case "upgrade":
            publish("upgrade");
            return;
        case "open_thread":
            target.openThread(outcome.threadRootMessageIndex);
            return;
        case "link_copied":
            if (outcome.ok) toastStore.showSuccessToast(i18nKey("messageUrlCopiedToClipboard"));
            else {
                toastStore.showFailureToast(
                    i18nKey("failedToCopyUrlToClipboard", { url: outcome.url }),
                );
            }
            return;
        case "shared":
            if (!outcome.ok) toastStore.showFailureToast(i18nKey("failedToShareMessage"));
            return;
        // copying says nothing, and a delete shows at once (and comes back if it fails)
        case "copied":
        case "deleted":
        case "done":
            return;
    }
}
