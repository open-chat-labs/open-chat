/**
 * We need to make sure that we have one and only one video call in progress at any one time. For this reason we will keep the
 * DailyCall object in a store
 */

import {
    type DailyCall,
    type DailyEventObjectAppMessage,
    type DailyThemeConfig,
} from "@daily-co/daily-js";
import { type ChatIdentifier } from "openchat-client";
import { writable } from "svelte/store";
import { createLocalStorageStore } from "../utils/store";

export type InterCallMessage = RequestToSpeakMessage | RequestToSpeakMessageResponse;

export type RequestToSpeak = {
    kind: "ask_to_speak";
    participantId: string;
    userId: string;
};

export type RequestToSpeakResponse = {
    kind: "ask_to_speak_response";
    participantId: string;
    userId: string;
    approved: boolean;
};

export type RequestToSpeakMessage = DailyEventObjectAppMessage<RequestToSpeak>;
export type RequestToSpeakMessageResponse = DailyEventObjectAppMessage<RequestToSpeakResponse>;

const previousCalls = new Set<bigint>();

export type IncomingVideoCall = {
    chatId: ChatIdentifier;
    userId: string;
    messageId: bigint;
};

export type VideoCallView = "fullscreen" | "minimised" | "default";

export type ActiveVideoCall = {
    status: "joining" | "joined";
    chatId: ChatIdentifier;
    call?: DailyCall;
    view: VideoCallView;
    threadOpen: boolean;
    accessRequests: RequestToSpeak[];
};

// there are now several ways that we can be notified of an incoming call so we want to be sure that if we decline via one mechanism we are not prompted a second time via another

const activeStore = writable<ActiveVideoCall | undefined>(undefined);
export const incomingStore = writable<IncomingVideoCall | undefined>(undefined);

export const microphone = writable<boolean>(false);
export const hasPresence = writable<boolean>(false);
export const camera = writable<boolean>(false);
export const sharing = writable<boolean>(false);
export const selectedRingtone = createLocalStorageStore("openchat_ringtone", "boring");

export const incomingVideoCall = {
    subscribe: incomingStore.subscribe,
    set: (call: IncomingVideoCall | undefined) => {
        if (call === undefined) {
            incomingStore.set(undefined);
        } else {
            // only register an incoming call if we have not already done so. This prevents us ringing twice via a different mechanism for the same call.
            if (!previousCalls.has(call.messageId)) {
                incomingStore.set(call);
                previousCalls.add(call.messageId);
            }
        }
    },
};

export const activeVideoCall = {
    subscribe: activeStore.subscribe,
    setCall: (chatId: ChatIdentifier, call: DailyCall) => {
        return activeStore.set({
            status: "joined",
            chatId,
            call,
            view: "default",
            threadOpen: false,
            accessRequests: [],
        });
    },
    setView: (view: VideoCallView) => {
        return activeStore.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      view,
                  };
        });
    },
    rejectAccessRequest: (req: RequestToSpeak) => {
        return activeStore.update((current) => {
            if (current === undefined) return undefined;
            if (current.call) {
                current.call.sendAppMessage(
                    {
                        kind: "ask_to_speak_response",
                        participantId: req.participantId,
                        userId: req.userId,
                        approved: false,
                    },
                    req.participantId,
                );
            }
            return {
                ...current,
                accessRequests: current.accessRequests.filter(
                    (r) => r.participantId !== req.participantId,
                ),
            };
        });
    },
    approveAccessRequest: (req: RequestToSpeak) => {
        return activeStore.update((current) => {
            if (current === undefined) return undefined;
            if (current.call) {
                current.call.updateParticipant(req.participantId, {
                    updatePermissions: {
                        hasPresence: true,
                        canSend: true,
                    },
                });
                current.call.sendAppMessage(
                    {
                        kind: "ask_to_speak_response",
                        participantId: req.participantId,
                        userId: req.userId,
                        approved: true,
                    },
                    req.participantId,
                );
            }
            return {
                ...current,
                accessRequests: current.accessRequests.filter(
                    (r) => r.participantId !== req.participantId,
                ),
            };
        });
    },
    captureAccessRequest: (req: RequestToSpeak) => {
        return activeStore.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      accessRequests: [...current.accessRequests, req],
                  };
        });
    },
    threadOpen: (threadOpen: boolean) => {
        return activeStore.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      threadOpen,
                  };
        });
    },
    endCall: () => {
        return activeStore.update((current) => {
            current?.call?.destroy();
            microphone.set(false);
            camera.set(false);
            sharing.set(false);
            hasPresence.set(false);
            return undefined;
        });
    },
    changeTheme: (theme: DailyThemeConfig) => {
        return activeStore.update((current) => {
            current?.call?.setTheme(theme);
            return current;
        });
    },
    joining: (chatId: ChatIdentifier) => {
        return activeStore.set({
            status: "joining",
            chatId,
            view: "default",
            threadOpen: false,
            accessRequests: [],
        });
    },
};

export const ringtoneUrls: Record<RingtoneKey, string> = {
    boring: "/assets/ringtones/ringring_boring.mp3",
    pleasant: "/assets/ringtones/tinkle.mp3",
    boomboom: "/assets/ringtones/ringring.mp3",
    garage: "/assets/ringtones/garage.mp3",
    siren: "/assets/ringtones/sirens.mp3",
};

export type RingtoneKey = "boring" | "pleasant" | "boomboom" | "garage" | "siren";

export class Ringtone {
    audio: HTMLAudioElement;
    playing: boolean;
    url: string;

    constructor(
        public key: RingtoneKey,
        public name: string,
    ) {
        this.url = ringtoneUrls[key];
        this.audio = new Audio(ringtoneUrls[key]);
        this.audio.loop = true;
        this.playing = false;
    }

    toggle() {
        this.playing = !this.playing;
        if (this.playing) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
    }

    stop() {
        this.playing = false;
        this.audio.pause();
    }
}
