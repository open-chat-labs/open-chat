import {
    ownUserAvatarUrl,
    threadOpenStore,
    type ChatIdentifier,
    type CommunitySummary,
    type OpenChat,
    type UserSummary,
} from "@client";
import type { CallSpeakRequest } from "@openchat/ui/src/features/components/CallPanel.svelte";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import { i18nKey } from "@src/i18n/i18n";
import { swatchFor } from "@src/logic/chats/chatRow";
import type { CallFace } from "@src/logic/video/callPeople";
import { callFrameOptions } from "@src/logic/video/callFrameOptions";
import { CallSession } from "@src/logic/video/callSession.svelte";
import { videoCallChat } from "@src/logic/video/callChat";
import { activeVideoCall, type RequestToSpeak } from "@src/stores/video";
import { toastStore } from "@src/stores/toast";
import type { Box, WindowSize } from "../../shell/bottomPlacement";
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

/** The call's chat as the call shows it: its name, and when the call started, if the chat says. */
export function callHeading(
    client: Pick<
        OpenChat,
        "lookupChatSummary" | "displayName" | "userAvatarUrl" | "groupAvatarUrl"
    >,
    chatId: ChatIdentifier,
    users: ReadonlyMap<string, UserSummary>,
    communities: {
        get(id: { kind: "community"; communityId: string }): CommunitySummary | undefined;
    },
): { title: string; started: number | undefined } | undefined {
    const chat = client.lookupChatSummary(chatId);
    if (chat === undefined) return undefined;
    return {
        title: videoCallChat(client, chat, users, communities).name,
        started:
            chat.videoCallInProgress === undefined
                ? undefined
                : Number(chat.videoCallInProgress.started),
    };
}

/** A broadcast host's requests to speak, as the call view and the minimised call show them. */
export function speakRequestCards(
    requests: RequestToSpeak[],
    users: ReadonlyMap<string, UserSummary>,
    face: (userId: string, userName: string) => CallFace,
): CallSpeakRequest[] {
    return requests.map((r) => ({
        id: r.participantId,
        ...face(r.userId, users.get(r.userId)?.username ?? ""),
    }));
}

/** The host lets the one asking speak, or not. */
export function answerSpeakRequest(requests: RequestToSpeak[], id: string, approve: boolean) {
    const request = requests.find((r) => r.participantId === id);
    if (request === undefined) return;
    if (approve) activeVideoCall.approveAccessRequest(request);
    else activeVideoCall.rejectAccessRequest(request);
}

/** Where the minimised call floats: a box on the window, and how far from its top and bottom. */
export type MiniCallArea = {
    left: number;
    top: number;
    width: number;
    height: number;
    safeTop?: number;
    safeBottom?: number;
};

// the gap between the minimised call and the header or composer it keeps clear of
const MINI_GAP = 16;

/**
 * The minimised call's area: the middle panel (the window without one), clear of the chat's
 * header above and its composer below while there's a chat open.
 */
export function miniCallArea(
    win: WindowSize,
    middle: Box | undefined,
    header: Box | undefined,
    composer: Box | undefined,
): MiniCallArea {
    const box = middle ?? { left: 0, top: 0, width: win.width, height: win.height };
    return {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        safeTop: header === undefined ? undefined : header.top + header.height - box.top + MINI_GAP,
        safeBottom:
            composer === undefined ? undefined : box.top + box.height - composer.top + MINI_GAP,
    };
}
