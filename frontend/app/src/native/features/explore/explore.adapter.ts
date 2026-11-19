import type { CommunityMatch } from "@client";
import { swatchFor, type Swatch } from "@src/logic/swatch";

// Explore (N8b PR 4, native plan 12 "Explore", Design Notes §3.8): the communities found as the
// design's rows, and what browsing shows: Featured, then the shelves, each hidden under 3
// communities, or one plain list when that leaves no shelf (a language with few communities).
// The backend has one ranking, most members first (#10405), so Featured is its top and Popular the
// rest; the design's other shelves (Fastest growing, Most active, Recently added) wait for it.

/** A community found, as the rows and the Featured cards show it. */
export type ExploreRow = {
    id: string;
    name: string;
    about: string;
    avatarUrl: string | undefined;
    coverUrl: string | undefined;
    color: Swatch;
    members: number;
    /** It has a gate (the lock). */
    gated: boolean;
    /** The user is in it ("· Joined"). */
    joined: boolean;
    /** Its language's code ("" for none). */
    language: string;
    /** Its place in the ranking, from 1. */
    rank: number;
};

export type ExploreShelfKey = "popular";

export type ExploreShelf = {
    key: ExploreShelfKey;
    rows: ExploreRow[];
    /** Its rows 3 to a column, swiped across. */
    columns: ExploreRow[][];
};

export type ExploreBrowse =
    | { kind: "shelves"; featured: ExploreRow[]; shelves: ExploreShelf[] }
    /** No shelf has 3: every community found, in one list. */
    | { kind: "plain"; rows: ExploreRow[] };

const FEATURED = 3;
const SHELF_MIN = 3;
const SHELF_SIZE = 9;
const COLUMN = 3;

/** Enough of the ranking for Featured and a full shelf. */
export const EXPLORE_PAGE_SIZE = FEATURED + SHELF_SIZE;

/** The communities found, in the ranking's order; `joined`: the ids of those the user is in. */
export function exploreRows(
    matches: readonly CommunityMatch[],
    joined: ReadonlySet<string>,
): ExploreRow[] {
    return matches.map((match, i) => ({
        id: match.id.communityId,
        name: match.name,
        about: match.description,
        avatarUrl: match.avatar.blobUrl,
        coverUrl: match.banner.blobUrl,
        color: swatchFor(match.id.communityId),
        members: match.memberCount,
        gated: match.gateConfig.gate.kind !== "no_gate",
        joined: joined.has(match.id.communityId),
        language: match.primaryLanguage,
        rank: i + 1,
    }));
}

/**
 * What browsing shows: Featured (the top communities the user isn't in), then Popular (the rest
 * of the ranking), hidden with fewer than 3; with no shelf left, every community in one list, so
 * none is out of reach.
 */
export function exploreBrowse(rows: readonly ExploreRow[]): ExploreBrowse {
    const featured = rows.filter((r) => !r.joined).slice(0, FEATURED);
    const popular = rows.filter((r) => !featured.includes(r)).slice(0, SHELF_SIZE);
    const shelves = [shelf("popular", popular)].filter((s) => s.rows.length >= SHELF_MIN);
    return shelves.length === 0
        ? { kind: "plain", rows: [...rows] }
        : { kind: "shelves", featured, shelves };
}

function shelf(key: ExploreShelfKey, rows: ExploreRow[]): ExploreShelf {
    const columns: ExploreRow[][] = [];
    for (let i = 0; i < rows.length; i += COLUMN) columns.push(rows.slice(i, i + COLUMN));
    return { key, rows, columns };
}

/** A member count as the rows show it, short ("12.9k"), in the app's language. */
export function compactCount(n: number, locale: string | null | undefined): string {
    try {
        return new Intl.NumberFormat(locale ?? "en", {
            notation: "compact",
            maximumFractionDigits: 1,
        }).format(n);
    } catch {
        return String(n);
    }
}
