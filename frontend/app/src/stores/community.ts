import {
    type CommunitySummary,
    type CommunityPermissions,
    emptyChatMetrics,
    ROLE_ADMIN,
    ROLE_OWNER,
} from "openchat-client";

const defaultPermissions: CommunityPermissions = {
    changeRoles: ROLE_ADMIN,
    updateDetails: ROLE_ADMIN,
    inviteUsers: ROLE_ADMIN,
    removeMembers: ROLE_ADMIN,
    createPublicChannel: ROLE_ADMIN,
    createPrivateChannel: ROLE_ADMIN,
    manageUserGroups: ROLE_ADMIN,
};

export function createCandidateCommunity(id: string, index: number): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: id },
        name: "",
        description: "",
        memberCount: 1,
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
            role: ROLE_OWNER,
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
