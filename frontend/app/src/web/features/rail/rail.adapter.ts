import {
    type CombinedUnreadCounts,
    type CommunityIdentifier,
    type CommunitySummary,
    type ReadonlyMap,
    type UnreadCounts,
} from "@client";
import type NavRail from "@openchat/ui/src/features/components/NavRail.svelte";
import type { ComponentProps } from "svelte";
import { swatchFor } from "@src/logic/swatch";
import type { RailItem } from "../../router/regions";

type Pin = ComponentProps<typeof NavRail>["pins"][number];
type Item = ComponentProps<typeof NavRail>["items"][number];

/**
 * Whether a count lights the rail: unread messages not muted, or a mention (as the old mobile
 * bottom bar, and the native tab bar).
 */
function lit({ unmuted, mentions }: UnreadCounts): boolean {
    return unmuted > 0 || mentions;
}

/**
 * The user's communities as the rail's pins, in the order they're sorted in
 * (sortedCommunitiesStore): each with its own picture, none (the swatch) without one, as a
 * person or group without a picture shows its swatch everywhere in the new web UI (the user's
 * decision, 2026-11-10); and a dot while one of its channels is unread (`unread`:
 * unreadCommunityChannelCountsStore, its channels' counts, not their threads').
 */
export function pinsFor(
    communities: CommunitySummary[],
    unread: ReadonlyMap<CommunityIdentifier, CombinedUnreadCounts>,
): Pin[] {
    return communities.map((community) => {
        const counts = unread.get(community.id);
        return {
            id: community.id.communityId,
            name: community.name,
            avatarUrl: community.avatar.blobUrl,
            // its swatch, as in its panel and a profile's communities (swatchFor)
            color: swatchFor(community.id.communityId),
            dot: counts !== undefined && lit(counts.chats),
        };
    });
}

/** What the rail's items count as unread (the stores of the same names). */
export type RailUnread = {
    /** unreadDirectAndGroupCountsStore */
    directAndGroup: CombinedUnreadCounts;
    /** unreadFavouriteCountsStore */
    favourite: CombinedUnreadCounts;
    /** messageActivitySummaryStore's unreadCount */
    activity: number;
};

/**
 * A rail item's unread mark: a dot while collapsed and the count while expanded. Chats and
 * Favourites count their chats' unmuted unread messages, not their threads' (as the native tab
 * bar and the old mobile bottom bar, N5a's decision), lit by a mention alone too; Notifications its
 * unread activity; the wallet nothing.
 */
export function railItemUnread(
    id: RailItem["id"],
    unread: RailUnread,
): Pick<Item, "dot" | "count"> {
    switch (id) {
        case "chats":
            return chatsUnread(unread.directAndGroup.chats);
        case "favourites":
            return chatsUnread(unread.favourite.chats);
        case "notifications":
            return unread.activity > 0 ? { dot: true, count: unread.activity } : { dot: false };
        case "wallet":
            return { dot: false };
    }
}

// a mention alone shows the dot, and an empty count while expanded
function chatsUnread(counts: UnreadCounts): Pick<Item, "dot" | "count"> {
    if (!lit(counts)) return { dot: false };
    return counts.unmuted > 0 ? { dot: true, count: counts.unmuted } : { dot: true };
}
