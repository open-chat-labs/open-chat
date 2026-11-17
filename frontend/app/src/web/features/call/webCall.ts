import { ownUserAvatarUrl, threadOpenStore, type OpenChat, type UserSummary } from "@client";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import { i18nKey } from "@src/i18n/i18n";
import { swatchFor } from "@src/logic/chats/chatRow";
import type { CallFace } from "@src/logic/video/callPeople";
import { callFrameOptions } from "@src/logic/video/callFrameOptions";
import { CallSession } from "@src/logic/video/callSession.svelte";
import { toastStore } from "@src/stores/toast";
import { closeThread } from "../app/rightPanel";

/**
 * The new UI's call: one session for the app's lifetime (the web App), so a call outlives every
 * screen and route. It makes its calls with Daily's call object, never the prebuilt frame (#10124).
 * A thread open in the right column closes when a call starts; the call opens nothing there, so
 * leaving it goes back from nothing.
 */
export function createWebCall(client: OpenChat): CallSession {
    return new CallSession(
        client,
        // the frame's colours, which a call object has no use for
        (chatId) => callFrameOptions(client, chatId, { colors: {} }),
        () => toastStore.showSuccessToast(i18nKey("videoCall.noAnswer")),
        {
            mode: "call_object",
            rightPanel: {
                closeThread: () => {
                    if (threadOpenStore.value) closeThread();
                },
                afterLeave: () => undefined,
            },
        },
    );
}

/** A participant as the call view draws them without video: their name, swatch and own picture. */
export function callFace(
    client: Pick<OpenChat, "displayName">,
    users: ReadonlyMap<string, UserSummary>,
): (userId: string, userName: string) => CallFace {
    return (userId, userName) => {
        const user = users.get(userId);
        const name = user === undefined ? userName : client.displayName(user);
        return {
            name,
            initial: name.slice(0, 1).toUpperCase(),
            grad: AVATAR_GRADIENTS[swatchFor(userId)],
            avatarUrl: ownUserAvatarUrl(user),
        };
    };
}
