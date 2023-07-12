import {
    type CommunitySummary,
    type CommunityPermissions,
    emptyChatMetrics,
} from "openchat-client";

const defaultPermissions: CommunityPermissions = {
    changeRoles: "owner",
    inviteUsers: "owner",
    removeMembers: "owner",
    blockUsers: "owner",
    updateDetails: "owner",
    createPublicChannel: "owner",
    createPrivateChannel: "owner",
};

export function createCandidateCommunity(id: string): CommunitySummary {
    return {
        id: { kind: "community", communityId: id },
        name: "",
        description: "",
        memberCount: 0,
        avatar: {},
        banner: {},
        gate: { kind: "no_gate" },
        public: true,
        permissions: defaultPermissions,
        historyVisible: true,
        frozen: false,
        level: "community",
        lastUpdated: BigInt(0),
        latestEventIndex: 0,
        channels: [],
        membership: {
            role: "owner",
            joined: BigInt(0),
            archived: false,
            pinned: [],
        },
        primaryLanguage: "en",
        metrics: emptyChatMetrics(),
    };
}
