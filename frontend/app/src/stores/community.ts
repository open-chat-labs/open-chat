import {
    type CommunitySummary,
    type CommunityPermissions,
    emptyChatMetrics,
} from "openchat-client";

const defaultPermissions: CommunityPermissions = {
    changeRoles: "admin",
    updateDetails: "admin",
    inviteUsers: "admin",
    removeMembers: "admin",
    createPublicChannel: "admin",
    createPrivateChannel: "admin",
    manageUserGroups: "admin",
};

export function createCandidateCommunity(id: string, index: number): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: id },
        name: "",
        description: "",
        memberCount: 0,
        avatar: {},
        banner: {},
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
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
            index,
            displayName: undefined,
            rulesAccepted: false,
            lapsed: false,
        },
        primaryLanguage: "en",
        metrics: emptyChatMetrics(),
        userGroups: new Map(),
        localUserIndex: "",
        isInvited: false,
        verified: false,
    };
}
