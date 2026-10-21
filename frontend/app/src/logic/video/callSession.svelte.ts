// The state and logic for starting, joining and leaving a call, so that the components in both
// trees can be as purely presentational as possible. It returns outcomes; each tree shows them.

import type { DailyCall, DailyThemeConfig } from "@daily-co/daily-js";
import {
    currentUserIdStore,
    joinedCallType,
    startVideoOff,
    type ChatIdentifier,
    type OpenChat,
    type VideoCallOutcome,
    type VideoCallRoom,
    type VideoCallType,
} from "@client";
import { setCallRingback } from "@utils/native/call_bridge";
import {
    activeVideoCall,
    camera,
    hasPresence,
    microphone,
    sharing,
    type InterCallMessage,
} from "@stores/video";
import {
    armRingOut,
    peerLeftEndsCall,
    ringOutApplies,
    type RingOutHandle,
} from "@utils/callRingOut";
import type { Theme } from "@src/theme/types";

export type CallRequest = { chatId: ChatIdentifier; callType: VideoCallType; join: boolean };

export type StartCallOutcome = VideoCallOutcome | { kind: "confirm_switch" };

// How the call's frame starts, read when the user enters the call
export type CallFrameOptions = {
    // the name the call is shown under, e.g. on the phone's ongoing call notification
    title: string;
    username: string;
    speakerView: boolean;
    cameraOn: boolean;
    micOn: boolean;
    theme: DailyThemeConfig;
};

export function dailyTheme(theme: Theme): DailyThemeConfig {
    return {
        colors: {
            accent: `${theme.daily.accent}`,
            accentText: `${theme.daily.accentText}`,
            background: `${theme.daily.background}`,
            backgroundAccent: `${theme.daily.backgroundAccent}`,
            baseText: `${theme.daily.baseText}`,
            border: `${theme.daily.border}`,
            mainAreaBg: `${theme.daily.mainAreaBg}`,
            mainAreaBgAccent: `${theme.daily.mainAreaBgAccent}`,
            mainAreaText: `${theme.daily.mainAreaText}`,
            supportiveText: `${theme.daily.supportiveText}`,
        },
    };
}

export class CallSession {
    #client: OpenChat;
    #frameOptions: (chatId: ChatIdentifier) => CallFrameOptions;
    #onNoAnswer: () => void;
    #call: DailyCall | undefined;
    // Ends a direct call this client started if nobody joins within the ring window
    #ringOut: RingOutHandle | undefined;

    // A call the user asked for while already in another, waiting for them to confirm the switch
    confirmSwitchTo = $state<CallRequest>();
    hostEnded = $state(false);
    denied = $state(false);
    askedToSpeak = $state(false);

    /**
     * `onNoAnswer` is called when a direct call this user started ends because nobody answered.
     */
    constructor(
        client: OpenChat,
        frameOptions: (chatId: ChatIdentifier) => CallFrameOptions,
        onNoAnswer: () => void,
    ) {
        this.#client = client;
        this.#frameOptions = frameOptions;
        this.#onNoAnswer = onNoAnswer;
    }

    // Starts a call in the chat, or joins the one there, in the given element
    async startOrJoin(container: HTMLElement, request: CallRequest): Promise<StartCallOutcome> {
        const { chatId, join } = request;
        const callType = join
            ? joinedCallType(
                  request.callType,
                  this.#client.lookupChatSummary(chatId)?.videoCallInProgress?.callType,
              )
            : request.callType;

        if (activeVideoCall.current() !== undefined) {
            this.confirmSwitchTo = { chatId, callType, join };
            return { kind: "confirm_switch" };
        }

        // close any threads we have open in the right panel
        this.#client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");

        activeVideoCall.joining(chatId, callType);

        const outcome = await this.#client.startOrJoinVideoCall(chatId, callType, join, (room) =>
            this.#enterRoom(container, chatId, room),
        );
        if (outcome.kind !== "joined") {
            activeVideoCall.endCall();
        }
        return outcome;
    }

    // Leaves the current call for the one the user asked for
    async switchCall(container: HTMLElement): Promise<StartCallOutcome | undefined> {
        const request = this.confirmSwitchTo;
        this.confirmSwitchTo = undefined;
        if (request === undefined) return;
        activeVideoCall.endCall();
        await new Promise((resolve) => window.setTimeout(resolve, 100));
        return this.startOrJoin(container, request);
    }

    cancelSwitch() {
        this.confirmSwitchTo = undefined;
    }

    askToSpeak() {
        activeVideoCall.askToSpeak(currentUserIdStore.value);
        this.askedToSpeak = true;
    }

    hangup() {
        this.#leave(false);
    }

    // `lastOneHere` when the caller already knows nobody else is in the call (the other
    // party of a direct call left), so the end does not depend on presence having been
    // reported yet
    #leave(lastOneHere: boolean) {
        const active = activeVideoCall.current();
        if (active?.call) {
            if (lastOneHere || activeVideoCall.present() === 1) {
                // I must be the last person left in the call
                this.#client.endVideoCall(active.chatId, active.messageId);
            }

            // this will trigger the left-meeting event which will in turn end the call
            active.call.leave();
            this.#client.popRightPanelHistory();
        }
    }

    async #enterRoom(container: HTMLElement, chatId: ChatIdentifier, room: VideoCallRoom) {
        const { callType, messageId } = room;
        const options = this.#frameOptions(chatId);

        if (this.#call !== undefined) {
            await this.#call.destroy();
            this.#call = undefined;
        }

        // daily-js is only loaded when a call actually starts so it stays out of the initial bundle
        const { default: daily } = await import("@daily-co/daily-js");

        const call = daily.createFrame(container, {
            token: room.token,
            activeSpeakerMode: callType === "broadcast" ? true : options.speakerView,
            showLeaveButton: false,
            showFullscreenButton: false,
            startVideoOff: startVideoOff(callType, options.cameraOn),
            startAudioOff: !options.micOn,
            iframeStyle: {
                width: "100%",
                height: "100%",
            },
            url: `https://openchat.daily.co/${room.roomName}`,
            userName: options.username,
            theme: options.theme,
        });
        this.#call = call;

        call.on("app-message", (ev: InterCallMessage | undefined) => {
            if (chatId.kind === "direct_chat") return;

            if (ev && ev.action === "app-message") {
                if (ev.data.kind === "ask_to_speak") {
                    activeVideoCall.captureAccessRequest(ev.data);
                }
                if (ev.data.kind === "demote_participant") {
                    const me = call.participants().local.session_id;
                    if (
                        ev.data.participantId === me &&
                        currentUserIdStore.value === ev.data.userId
                    ) {
                        this.askedToSpeak = false;
                        this.#client.setVideoCallPresence(chatId, messageId, "hidden");
                    }
                }
                if (ev.data.kind === "ask_to_speak_response") {
                    const me = call.participants().local.session_id;
                    if (
                        ev.data.participantId === me &&
                        currentUserIdStore.value === ev.data.userId
                    ) {
                        this.askedToSpeak = false;
                        this.denied = !ev.data.approved;
                        if (ev.data.approved) {
                            this.#client.setVideoCallPresence(chatId, messageId, "default");
                        }
                    }
                }
            }
        });

        // this only fires when *I* leave the meeting
        call.on("left-meeting", () => {
            this.#ringOut?.cancel();
            // at this point I have already left the meeting and so participantCount will always report 0
            // so we can't use it.
            activeVideoCall.endCall();
        });

        // A fatal error, such as "Meeting has ended" when the bridge deletes the room
        // because the other side declined. The call object is finished; end the call here
        // rather than leave Daily reporting an unhandled error.
        call.on("error", (ev) => {
            console.warn("Video call ended with an error", ev?.errorMsg);
            this.#ringOut?.cancel();
            activeVideoCall.endCall();
        });

        // this fires when a remote participant leaves the meeting
        call.on("participant-left", (ev) => {
            // if the owner leaves, end the call
            if (ev?.participant.owner && !ev.participant.local && callType === "broadcast") {
                this.hangup();
                this.hostEnded = true;
            } else if (ev && peerLeftEndsCall(chatId, ev.participant.local)) {
                this.#leave(true);
            }
        });

        call.on("participant-joined", (ev) => {
            if (!ev?.participant.local) this.#ringOut?.cancel();
        });

        call.on("joined-meeting", (ev) => {
            const me = ev?.participants?.local;
            if (!me) return;
            if (me.owner) {
                activeVideoCall.isOwner(true);
            }
        });

        call.on("participant-updated", (ev) => {
            if (ev?.participant.local) {
                microphone.set(ev?.participant.tracks.audio.state !== "off");
                camera.set(ev?.participant.tracks.video.state !== "off");
                sharing.set(ev?.participant.tracks.screenVideo.state !== "off");
                hasPresence.set(ev?.participant.permissions.hasPresence);
            } else {
                if (ev?.participant.user_name === options.username) {
                    // this means that I have joined the call from somewhere else e.g. another device
                    this.hangup();
                }
            }
        });

        await call.join();

        activeVideoCall.setCall(chatId, messageId, call, options.title, (kind) =>
            this.#client.getVideoCallTeardownToken(chatId, kind),
        );

        if (ringOutApplies(chatId, room.joining)) {
            this.#ringOut?.cancel();
            this.#ringOut = armRingOut(
                () => (call.participantCounts().present ?? 1) > 1,
                () => {
                    this.#onNoAnswer();
                    this.hangup();
                },
                setCallRingback,
            );
        }
    }
}
