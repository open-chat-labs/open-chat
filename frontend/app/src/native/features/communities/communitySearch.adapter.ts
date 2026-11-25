import type { ChannelIdentifier, ChannelMatch } from "@client";
import { resultSection, splitAtMatch, type ResultSection } from "@src/logic/chats/chatSearch";
import { canReadChannel, otherChannels } from "@src/logic/communities/otherChannels";
import { swatchFor } from "@src/logic/swatch";
import type { ResultRow } from "../chats/chats.adapter";

// A community's search, from its details' Search tile: its channels, the user's (matched by name
// on what's held) and those they're not in that they can read (the community canister's
// explore_channels, the old desktop's Browse channels), in the Chats tab's search's rows and
// sections. The app has no search of a community's messages (a chat's search is one chat's).

type Channel = { id: ChannelIdentifier; name: string; memberCount: number };

/** A channel's key: its row's id. */
export function channelKey(id: ChannelIdentifier): string {
    return `${id.communityId}/${id.channelId}`;
}

function channelRow(channel: Channel, term: string, members: (count: number) => string): ResultRow {
    const key = channelKey(channel.id);
    return {
        id: key,
        title: splitAtMatch(channel.name, term),
        sub: members(channel.memberCount),
        subMarkdown: false,
        kind: "channel",
        color: swatchFor(key),
    };
}

/** The user's channels whose names hold the term (lower-cased, `searchTerm`), by name. */
export function joinedChannelRows(
    channels: readonly Channel[],
    term: string,
    members: (count: number) => string,
): ResultRow[] {
    return channels
        .filter((c) => term !== "" && c.name.toLowerCase().includes(term))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => channelRow(c, term, members));
}

/**
 * The channels found that the user isn't in and can read (public, or invited to: canReadChannel,
 * as the community page's "Not joined" rows), in the order found.
 */
export function otherChannelRows(
    found: readonly ChannelMatch[],
    joined: { has: (id: ChannelIdentifier) => boolean },
    term: string,
    members: (count: number) => string,
): ResultRow[] {
    return otherChannels(found, joined)
        .filter(canReadChannel)
        .map((c) => channelRow(c, term, members));
}

export const COMMUNITY_SEARCH_SECTIONS = ["joined", "others"] as const;
export type CommunitySearchSectionId = (typeof COMMUNITY_SEARCH_SECTIONS)[number];

/** How many of a section's rows show until Show all. */
export const COMMUNITY_SEARCH_CAP = 5;

/** The sections with something in them, in order (Your channels, Other channels). */
export function communitySearchSections(
    rows: Record<CommunitySearchSectionId, readonly ResultRow[]>,
    expanded: Partial<Record<string, boolean>>,
): { id: CommunitySearchSectionId; section: ResultSection<ResultRow> }[] {
    return COMMUNITY_SEARCH_SECTIONS.map((id) => ({
        id,
        section: resultSection(rows[id], COMMUNITY_SEARCH_CAP, expanded[id] ?? false),
    })).filter(({ section }) => section.total > 0);
}
