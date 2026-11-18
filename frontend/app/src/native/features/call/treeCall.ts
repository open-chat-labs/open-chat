import type { OpenChat } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { callFrameOptions } from "@src/logic/video/callFrameOptions";
import { CallSession } from "@src/logic/video/callSession.svelte";
import { toastStore } from "@src/stores/toast";

/**
 * The native tree's call (N14): one session for the app's lifetime, so a call outlives every tab
 * and screen. It asks for Daily's call object, never the prebuilt frame (#10124): in the Android
 * app and phones' browsers the tree draws the call itself; on iOS the session runs the call on the
 * native screen whatever the mode. Nothing here opens a thread, so there's no right panel to tidy.
 */
export function createNativeTreeCall(client: OpenChat): CallSession {
    return new CallSession(
        client,
        // the frame's colours, which a call object has no use for
        (chatId) => callFrameOptions(client, chatId, { colors: {} }),
        () => toastStore.showSuccessToast(i18nKey("videoCall.noAnswer")),
        {
            mode: "call_object",
            rightPanel: { closeThread: () => undefined, afterLeave: () => undefined },
        },
    );
}
