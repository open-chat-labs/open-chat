import type { Community } from "openchat-client";
import { writable } from "svelte/store";

function createDummyCommunity(
    id: string,
    name = `Community name ${id}`,
    url = "../assets/unknownUserAvatar.svg",
    memberCount = 2000,
    channelCount = 15,
    unreadCount = 0
) {
    return {
        name,
        id,
        description:
            "This is an awsome community with lots of interesting things to see and do. Not too much racism. Not financial advice. HODL.",
        memberCount,
        channelCount,
        unreadCount,
        blobUrl: url,
    };
}

function createDummyCommunityChannel(id: string) {
    return {
        name: `Channel ${id}`,
        description:
            "This is a nice channel that belongs to this community. It might have some _markdown_ or even some `code samples`.",
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
