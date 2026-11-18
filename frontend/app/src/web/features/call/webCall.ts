import { threadOpenStore, type OpenChat } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { callFrameOptions } from "@src/logic/video/callFrameOptions";
import { CallSession } from "@src/logic/video/callSession.svelte";
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
