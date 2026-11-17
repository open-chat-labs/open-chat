import {
    allUsersStore,
    communitiesStore,
    currentUserStore,
    type ChatIdentifier,
    type OpenChat,
    type UserSummary,
} from "@client";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import { i18nKey } from "@src/i18n/i18n";
import { swatchFor } from "@src/logic/chats/chatRow";
import { videoCallChat } from "@src/logic/video/callChat";
import type { CallFace } from "@src/logic/video/callPeople";
import { CallSession, type CallFrameOptions } from "@src/logic/video/callSession.svelte";
import { videoCameraOn, videoMicOn, videoSpeakerView } from "@src/stores/settings";
import { toastStore } from "@src/stores/toast";

/**
 * The new UI's call: one session for the app's lifetime (AppScreen), so a call outlives the screen
 * that started it. It makes its calls with Daily's call object, never the prebuilt frame (#10124).
 */
export function createWebCall(client: OpenChat): CallSession {
    const options = (chatId: ChatIdentifier): CallFrameOptions => {
        const chat = client.lookupChatSummary(chatId);
        return {
            title:
                chat === undefined
                    ? ""
                    : videoCallChat(client, chat, allUsersStore.value, communitiesStore.value).name,
            username: currentUserStore.value.username,
            speakerView: videoSpeakerView.value,
            cameraOn: videoCameraOn.value,
            micOn: videoMicOn.value,
            // the frame's colours, which a call object has no use for
            theme: { colors: {} },
        };
    };
    return new CallSession(
        client,
        options,
        () => toastStore.showSuccessToast(i18nKey("videoCall.noAnswer")),
        "call_object",
    );
}

/** A participant as the call view draws them without video: their name and swatch. */
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
        };
    };
}
