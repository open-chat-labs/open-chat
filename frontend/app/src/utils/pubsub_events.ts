import type {
    ChatSummary,
    CommunityIdentifier,
    CommunitySummary,
    DirectChatIdentifier,
    EnhancedReplyContext,
    Level,
    MultiUserChatIdentifier,
    ResourceKey,
} from "openchat-client";

export type PubSubEvents = {
    startVideoCall: { chat: ChatSummary; join: boolean };
    hangup: undefined;
    askToSpeak: undefined;
    chatWith: DirectChatIdentifier;
    showInviteGroupUsers: boolean;
    replyPrivatelyTo: EnhancedReplyContext;
    showGroupMembers: undefined;
    upgrade: undefined;
    verifyHumanity: undefined;
    deleteGroup: {
        kind: "delete";
        chatId: MultiUserChatIdentifier;
        level: Level;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
        after?: () => void;
    };
    deleteCommunity: {
        kind: "delete_community";
        communityId: CommunityIdentifier;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
    };
    communityDetails: CommunitySummary;
    editCommunity: CommunitySummary;
    leaveCommunity: {
        kind: "leave_community";
        communityId: CommunityIdentifier;
    };
    makeProposal: undefined;
};
