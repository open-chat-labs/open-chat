import type { DailyThemeConfig } from "@daily-co/daily-js";
import {
    allUsersStore,
    communitiesStore,
    currentUserStore,
    type ChatIdentifier,
    type OpenChat,
} from "@client";
import { videoCameraOn, videoMicOn, videoSpeakerView } from "@src/stores/settings";
import { videoCallChat } from "./callChat";
import type { CallFrameOptions } from "./callSession.svelte";

/**
 * How a call starts, as every tree reads it: the chat's name for the call, the user's name in it,
 * and the user's call settings.
 */
export function callFrameOptions(
    client: OpenChat,
    chatId: ChatIdentifier,
    theme: DailyThemeConfig,
): CallFrameOptions {
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
        theme,
    };
}
