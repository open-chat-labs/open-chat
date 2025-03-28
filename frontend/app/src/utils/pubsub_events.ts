import type { ChatSummary, DirectChatIdentifier } from "openchat-client";

export type PubSubEvents = {
    startVideoCall: { chat: ChatSummary; join: boolean };
    hangup: undefined;
    askToSpeak: undefined;
    chatWith: DirectChatIdentifier;
};
