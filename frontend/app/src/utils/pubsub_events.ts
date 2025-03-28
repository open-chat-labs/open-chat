import type { ChatSummary, DirectChatIdentifier, EnhancedReplyContext } from "openchat-client";

export type PubSubEvents = {
    startVideoCall: { chat: ChatSummary; join: boolean };
    hangup: undefined;
    askToSpeak: undefined;
    chatWith: DirectChatIdentifier;
    showInviteGroupUsers: boolean;
    replyPrivatelyTo: EnhancedReplyContext;
    showGroupMembers: undefined;
};
