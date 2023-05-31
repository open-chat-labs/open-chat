import type { Community, CommunityPermissions } from "openchat-client";
import { writable } from "svelte/store";

// TODO - come back and decide on default permissions
const defaultPermissions: CommunityPermissions = {
    changePermissions: "owner",
    changeRoles: "owner",
    inviteUsers: "owner",
    removeMembers: "owner",
    updateDetails: "owner",
    createPublicChannel: "owner",
    createPrivateChannel: "owner",
};

function createDummyCommunity(
    id: string,
    name = `Community name ${id}`,
    url = "../assets/unknownUserAvatar.svg",
    memberCount = 2000,
    channelCount = 15,
    unreadCount = 0
): Community {
    return {
        name,
        id,
        description:
            "This is an awsome community with lots of interesting things to see and do. Not too much racism. Not financial advice. HODL.",
        memberCount,
        channelCount,
        unreadCount,
        avatar: { blobUrl: url },
        banner: {},
        gate: { kind: "no_gate" },
        public: true,
        permissions: defaultPermissions,
        myRole: "owner",
    };
}

function createDummyCommunityChannel(id: string) {
    return {
        name: `Channel ${id}`,
        description:
            "This is a nice channel that belongs to this community. It might have some _markdown_ or even some `code samples`.",
    };
}

const allCommunities: Community[] = [
    createDummyCommunity("1", "OpenChat community", "../assets/evil-robot.svg", 30515, 20, 5),
    createDummyCommunity("2", "SNS1 Idiots", "../assets/sns1_medium.png"),
    createDummyCommunity(
        "3",
        "ckBTC Enthusiasts",
        "../assets/ckbtc_nobackground.png",
        1286,
        10,
        1000
    ),
    createDummyCommunity("4", "8Year Gang"),
    createDummyCommunity("5", "/biz Nazis"),
    createDummyCommunity("6"),
    createDummyCommunity("7"),
    createDummyCommunity("8"),
    createDummyCommunity("9"),
    createDummyCommunity("10"),
    createDummyCommunity("11"),
    createDummyCommunity("12"),
    createDummyCommunity("13"),
    createDummyCommunity("14"),
];

export const selectedCommunity = writable<Community>(allCommunities[0]);

export const dummyCommunities = writable<Community[]>(allCommunities);

export const myCommunities = writable<Community[]>(allCommunities.slice(0, 5));

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
        id,
        name: "",
        description: "",
        memberCount: 0,
        channelCount: 0,
        unreadCount: 0,
        avatar: {},
        banner: {},
        gate: { kind: "no_gate" },
        public: true,
        permissions: defaultPermissions,
        myRole: "owner",
    };
}
