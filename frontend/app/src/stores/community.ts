import type { Community, CommunityPermissions } from "openchat-client";
import { writable } from "svelte/store";

// TODO - come back and decide on default permissions
const defaultPermissions: CommunityPermissions = {
    changePermissions: "owner",
    changeRoles: "owner",
    inviteUsers: "owner",
    removeMembers: "owner",
    blockUsers: "owner",
    updateDetails: "owner",
    createPublicChannel: "owner",
    createPrivateChannel: "owner",
};

function createDummyCommunityChannel(id: string) {
    return {
        name: `Channel ${id}`,
        description:
            "This is a nice channel that belongs to this community. It might have some _markdown_ or even some `code samples`.",
    };
}

export const dummyCommunityChannels = writable<{ name: string; description: string }[]>([
    createDummyCommunityChannel("1"),
    createDummyCommunityChannel("2"),
    createDummyCommunityChannel("3"),
    createDummyCommunityChannel("4"),
    createDummyCommunityChannel("5"),
    createDummyCommunityChannel("6"),
    createDummyCommunityChannel("7"),
    createDummyCommunityChannel("8"),
    createDummyCommunityChannel("9"),
    createDummyCommunityChannel("10"),
    createDummyCommunityChannel("11"),
    createDummyCommunityChannel("12"),
    createDummyCommunityChannel("13"),
    createDummyCommunityChannel("14"),
]);

export function createCandidateCommunity(id: string): Community {
    return {
        id: { kind: "community", id },
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
        },
    };
}
