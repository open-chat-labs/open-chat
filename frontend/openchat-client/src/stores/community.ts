import { Writable, derived, writable } from "svelte/store";
import { setsAreEqual } from "../utils/set";
import { createChatSpecificObjectStore, createDerivedPropStore } from "./dataByChatFactory";
import {
    CommunityMap,
    type Community,
    type CommunityPermissions,
    type CommunitySpecificState,
    CommunityIdentifier,
} from "openchat-shared";

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

function createDummyCommunity(
    id: string,
    name = `Community name ${id}`,
    url = "../assets/unknownUserAvatar.svg",
    memberCount = 2000
): Community {
    return {
        name,
        id: { kind: "community", communityId: id },
        description:
            "This is an awsome community with lots of interesting things to see and do. Blah blah blah, it _even supports markdown_. Not financial advice. HODL.",
        memberCount,
        avatar: { blobUrl: url },
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

const testCommunities: Community[] = [
    createDummyCommunity("1", "OpenChat community", "../assets/evil-robot.svg", 30515),
    createDummyCommunity("2", "SNS1 fans", "../assets/sns1_medium.png"),
    createDummyCommunity("3", "ckBTC Enthusiasts", "../assets/ckbtc_nobackground.png", 1286),
    createDummyCommunity("4", "8Year Gang"),
    createDummyCommunity("5", "/biz Community"),
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

// these are all the communities that exist (this would come from the back end during explore)
export const allCommunities = writable<Community[]>(testCommunities);

// these are the communities I am in
export const communities: Writable<CommunityMap<Community>> = writable(
    CommunityMap.fromList(testCommunities.slice(0, 5))
);

export const communitiesList = derived(communities, ($communities) => {
    return Object.values($communities);
});

export const communityStateStore = createChatSpecificObjectStore<CommunitySpecificState>(() => ({
    members: [],
    blockedUsers: new Set<string>(),
    invitedUsers: new Set<string>(),
}));

export const currentCommunityMembers = createDerivedPropStore<CommunitySpecificState, "members">(
    communityStateStore,
    "members",
    () => []
);

export const currentCommunityBlockedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "blockedUsers"
>(communityStateStore, "blockedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityInvitedUsers = createDerivedPropStore<
    CommunitySpecificState,
    "invitedUsers"
>(communityStateStore, "invitedUsers", () => new Set<string>(), setsAreEqual);

export const currentCommunityRules = createDerivedPropStore<CommunitySpecificState, "rules">(
    communityStateStore,
    "rules",
    () => undefined
);

export const selectedCommunityId = writable<CommunityIdentifier | undefined>({
    kind: "community",
    communityId: "1",
});

export const selectedCommunity = derived(
    [communities, selectedCommunityId],
    ([$communities, $selectedCommunityId]) => {
        if ($selectedCommunityId === undefined) return undefined;
        return $communities.get($selectedCommunityId);
    }
);

export function setSelectedCommunity(id: CommunityIdentifier): void {
    selectedCommunityId.set(id);
    // communityStateStore.clear(id);
}
