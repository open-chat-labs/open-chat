import type { Community } from "openchat-client";
import { writable } from "svelte/store";

function createDummyCommunity(
    id: string,
    name = `Community name ${id}`,
    url = "../assets/unknownUserAvatar.svg",
    memberCount = 2000,
    groupCount = 15,
    unreadCount = 0
) {
    return {
        name,
        id,
        description:
            "This is an awsome community with lots of interesting things to see and do. Not too much racism. Not financial advice. HODL.",
        memberCount,
        groupCount,
        unreadCount,
        blobUrl: url,
    };
}

function createDummyCommunityGroup(id: string) {
    return {
        name: `Group ${id}`,
        description:
            "This is a nice groups that belongs to this community. It might have some _markdown_ or even some `code samples`.",
    };
}

export const dummyCommunities = writable<Community[]>([
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
]);

export const dummyCommunityGroups = writable<{ name: string; description: string }[]>([
    createDummyCommunityGroup("1"),
    createDummyCommunityGroup("2"),
    createDummyCommunityGroup("3"),
    createDummyCommunityGroup("4"),
    createDummyCommunityGroup("5"),
    createDummyCommunityGroup("6"),
    createDummyCommunityGroup("7"),
    createDummyCommunityGroup("8"),
    createDummyCommunityGroup("9"),
    createDummyCommunityGroup("10"),
    createDummyCommunityGroup("11"),
    createDummyCommunityGroup("12"),
    createDummyCommunityGroup("13"),
    createDummyCommunityGroup("14"),
]);
