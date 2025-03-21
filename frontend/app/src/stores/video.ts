/**
 * We need to make sure that we have one and only one video call in progress at any one time. For this reason we will keep the
 * DailyCall object in a store
 */

import {
    type DailyCall,
    type DailyEventObjectAppMessage,
    type DailyParticipantUpdateOptions,
    type DailyThemeConfig,
} from "@daily-co/daily-js";
import { type ChatIdentifier, type VideoCallType } from "openchat-client";
import { get, writable } from "svelte/store";
import { createLocalStorageStore } from "../utils/store";

export type InterCallMessage =
    | RequestToSpeakMessage
    | RequestToSpeakMessageResponse
    | DemoteParticipantMessage;

export type RequestToSpeak = {
    kind: "ask_to_speak";
    participantId: string;
    userId: string;
};

export type DemoteParticipant = {
    kind: "demote_participant";
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
export type DemoteParticipantMessage = DailyEventObjectAppMessage<DemoteParticipant>;

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
    participantsOpen: boolean;
    accessRequests: RequestToSpeak[];
    messageId?: bigint;
    isOwner: boolean;
    callType: VideoCallType;
};

const activeStore = writable<ActiveVideoCall | undefined>(undefined);
const incomingStore = writable<IncomingVideoCall | undefined>(undefined);

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

function updateCall(fn: (call: ActiveVideoCall) => ActiveVideoCall) {
    activeStore.update((current) => {
        return current === undefined ? undefined : fn(current);
    });
}

function findParticipantId(call: DailyCall, userId: string): string | undefined {
    const participants = call.participants();
    const p = Object.values(participants).find((v) => v.user_id === userId);
    if (p !== undefined) {
        return p.session_id;
    }
}

function updateParticipant(
    call: DailyCall,
    participantId: string,
    options: DailyParticipantUpdateOptions,
): Promise<DailyCall> {
    return new Promise((resolve) => {
        call.updateParticipant(participantId, options);
        window.setTimeout(() => resolve(call), 500);
    });
}

export type ActiveVideoCallStore = typeof activeVideoCall;

export const activeVideoCall = {
    subscribe: activeStore.subscribe,
    setCall: (chatId: ChatIdentifier, messageId: bigint, call: DailyCall) => {
        return updateCall((current) => ({
            ...current,
            chatId,
            call,
            messageId,
            status: "joined",
        }));
    },
    setView: (view: VideoCallView) => {
        return updateCall((current) => ({ ...current, view }));
    },

    askToSpeak: (userId: string) => {
        const current = get(activeStore);
        if (current?.call) {
            const participants = current.call.participants();
            const me = participants.local;
            Object.entries(participants).map(([key, val]) => {
                if (key !== "local") {
                    if (val.permissions.hasPresence && val.permissions.canAdmin) {
                        current.call?.sendAppMessage(
                            {
                                kind: "ask_to_speak",
                                participantId: me.session_id,
                                userId,
                            },
                            val.session_id,
                        );
                    }
                }
            });
        }
    },
    demote: (userId: string) => {
        const current = get(activeStore);
        if (current?.call) {
            const participantId = findParticipantId(current.call, userId);
            if (participantId) {
                updateParticipant(current.call, participantId, {
                    updatePermissions: {
                        hasPresence: false,
                        canSend: [],
                    },
                }).then((call) => {
                    call.sendAppMessage(
                        {
                            kind: "demote_participant",
                            participantId: participantId,
                            userId: userId,
                        },
                        participantId,
                    );
                });
            }
        }
    },
    rejectAccessRequest: (req: RequestToSpeak) => {
        return updateCall((current) => {
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
        return updateCall((current) => {
            if (current.call) {
                updateParticipant(current.call, req.participantId, {
                    updatePermissions: {
                        hasPresence: true,
                        canSend: new Set(["audio", "video"]),
                    },
                }).then((call) => {
                    call.sendAppMessage(
                        {
                            kind: "ask_to_speak_response",
                            participantId: req.participantId,
                            userId: req.userId,
                            approved: true,
                        },
                        req.participantId,
                    );
                });
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
        return updateCall((current) => ({
            ...current,
            accessRequests: [...current.accessRequests, req],
        }));
    },
    threadOpen: (threadOpen: boolean) => {
        return updateCall((current) => ({
            ...current,
            threadOpen,
            participantsOpen: false,
        }));
    },
    isOwner: (isOwner: boolean) => {
        return updateCall((current) => ({
            ...current,
            isOwner,
        }));
    },
    participantsOpen: (participantsOpen: boolean) => {
        return updateCall((current) => ({
            ...current,
            participantsOpen,
            threadOpen: false,
        }));
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
    joining: (chatId: ChatIdentifier, callType: VideoCallType) => {
        return activeStore.set({
            status: "joining",
            chatId,
            view: "default",
            threadOpen: false,
            participantsOpen: false,
            accessRequests: [],
            isOwner: false,
            callType,
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
