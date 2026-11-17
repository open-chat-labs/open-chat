import { callOffer, type VideoCallType } from "@client";

/**
 * The conversation header's call buttons: none, or one button (and the voice button beside it for
 * a new call in a private chat). `label` is an app string key.
 */
export type HeaderCall =
    | { show: false }
    | {
          show: true;
          label: string;
          icon: "video" | "phone";
          primary: { kind: "start"; callType: VideoCallType; join: boolean } | { kind: "return" };
          voice: boolean;
      };

/**
 * What the header offers for a chat (`callOffer`): audio or video for a new call in a private
 * chat, a broadcast in a public one, joining the call going on, or back to the user's own call
 * once minimised; nothing while it shows, as the call view has its own controls. The user's own
 * call in the chat (`activeCall`) counts as the call going on there before the chat's summary
 * says so, which it does a moment later.
 */
export function headerCall({
    canStart,
    isPublic,
    chatCall,
    activeCall,
}: {
    canStart: boolean;
    isPublic: boolean;
    /** The call the chat's summary says is going on. */
    chatCall: VideoCallType | undefined;
    /** The user's own call, when it's in this chat. */
    activeCall: { callType: VideoCallType; showing: boolean } | undefined;
}): HeaderCall {
    const offer = callOffer({
        canStart,
        isPublic,
        inProgress: chatCall ?? activeCall?.callType,
        inCall: activeCall !== undefined,
        canStartBroadcast: true,
    });
    const icon = (callType: VideoCallType) => (callType === "audio" ? "phone" : "video");
    switch (offer.kind) {
        case "none":
            return { show: false };
        case "choose":
            return {
                show: true,
                label: "videoCall.startVideo",
                icon: "video",
                primary: { kind: "start", callType: "default", join: false },
                voice: true,
            };
        case "broadcast":
            return {
                show: true,
                label: "videoCall.startBroadcast",
                icon: "video",
                primary: { kind: "start", callType: "broadcast", join: false },
                voice: false,
            };
        case "join":
            return {
                show: true,
                label: offer.callType === "audio" ? "videoCall.joinAudio" : "videoCall.joinVideo",
                icon: icon(offer.callType),
                primary: { kind: "start", callType: offer.callType, join: true },
                voice: false,
            };
        case "leave":
            return activeCall === undefined || activeCall.showing
                ? { show: false }
                : {
                      show: true,
                      label: "videoCall.join",
                      icon: icon(activeCall.callType),
                      primary: { kind: "return" },
                      voice: false,
                  };
    }
}
