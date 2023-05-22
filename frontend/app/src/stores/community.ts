import type { Community } from "openchat-client";
import { writable } from "svelte/store";

function createDummyCommunity(id: string) {
    return {
        name: `Community name ${id}`,
        id,
        description:
            "This is an awsome community with lots of interesting things to see and do. Not too much racism. Not financial advice. HODL.",
        memberCount: 2000,
    };
}

export const dummyCommunities = writable<Community[]>([
    createDummyCommunity("1"),
    createDummyCommunity("2"),
    createDummyCommunity("3"),
    createDummyCommunity("4"),
    createDummyCommunity("5"),
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
