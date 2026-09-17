import type {
    ChatIdentifier,
    ChatStateFull,
    ChitEvent,
    OptionUpdate,
    SyncWindow,
    UpdatedEvent,
    UpdatesResult,
} from "@shared";
import { ChatMap, chatIdentifierToString, chatIdentifiersEqual } from "@shared";

/**
 * The versioning behind the cache -> UI sync pull (see `domain/sync.ts` in openchat-shared).
 *
 * The chats blob is one record, so the per-item versions live beside it in a `SyncStamps`
 * record written in the same transaction: a version per chat, per removed chat (a tombstone,
 * so a pull can carry the removal), per global field, per updated event and per batch of chit
 * events. Both functions here are pure so the rules can be tested without IndexedDB.
 */

export const SYNCED_FIELDS = [
    "avatarId",
    "blockedUsers",
    "pinnedChats",
    "pinnedFavouriteChats",
    "pinnedChannels",
    "favouriteChats",
    "pinNumberSettings",
    "achievements",
    "chitState",
    "referrals",
    "walletConfig",
    "messageActivitySummary",
    "installedBots",
    "bitcoinAddress",
    "oneSecAddress",
    "streakInsurance",
    "premiumItems",
] as const satisfies readonly (keyof ChatStateFull)[];

export type SyncedField = (typeof SYNCED_FIELDS)[number];

export type UpdatedEventStamp = {
    chatId: ChatIdentifier;
    threadRootMessageIndex: number | undefined;
    eventIndex: number;
    timestamp: bigint;
    version: number;
};

export type SyncStamps = {
    directChats: Record<string, number>;
    groupChats: Record<string, number>;
    communities: Record<string, number>;
    removedDirectChats: Record<string, number>;
    removedGroupChats: Record<string, number>;
    removedCommunities: Record<string, number>;
    fields: Partial<Record<SyncedField, number>>;
    updatedEvents: UpdatedEventStamp[];
    chitEvents: { version: number; events: ChitEvent[] }[];
    // the version at which the user's suspension last changed
    suspension: number | undefined;
};

/** What a write pass changed, in the writer's own terms. Anything not listed keeps its stamp. */
export type SyncTouched = {
    directChats: Set<string>;
    groupChats: Set<string>;
    communities: Set<string>;
    fields: Set<SyncedField>;
    updatedEvents: ChatMap<UpdatedEvent[]>;
    chitEvents: ChitEvent[];
    suspensionChanged: boolean;
};

// A removal or an updated event is only interesting to a UI whose cursor is behind it, and every
// UI pulls to the head within seconds of it moving. These bounds only matter for a tab that has
// been wedged for hundreds of versions, and the events are marked dirty in the cache anyway so a
// re-read heals the display.
//
// The stamps record is rewritten whole on every pass, so the updated-event log is the one that
// costs anything: each entry carries a chat identifier, and a busy account would otherwise sit
// permanently at the cap. It is bounded twice - by how far behind the head an entry is, which is
// what keeps the steady state small, and by count as a backstop. Tombstones are a string and a
// number each, and dropping one loses a removal for good (nothing marks a removed chat dirty),
// so they are bounded generously and by count alone.
const MAX_TOMBSTONES = 1000;
const MAX_UPDATED_EVENT_STAMPS = 1000;
// ~500 passes behind the head, which no UI still folding answers can be
const MAX_UPDATED_EVENT_VERSION_LAG = 500;
const MAX_CHIT_EVENT_BATCHES = 20;

/** The fields whose Updatable was marked updated by this pass */
export function touchedFields(fields: Record<SyncedField, { updated: boolean }>): Set<SyncedField> {
    return new Set(SYNCED_FIELDS.filter((field) => fields[field].updated));
}

export function emptySyncStamps(): SyncStamps {
    return {
        directChats: {},
        groupChats: {},
        communities: {},
        removedDirectChats: {},
        removedGroupChats: {},
        removedCommunities: {},
        fields: {},
        updatedEvents: [],
        chitEvents: [],
        suspension: undefined,
    };
}

export function emptyTouched(): SyncTouched {
    return {
        directChats: new Set(),
        groupChats: new Set(),
        communities: new Set(),
        fields: new Set(),
        updatedEvents: new ChatMap(),
        chitEvents: [],
        suspensionChanged: false,
    };
}

/**
 * The stamps to store alongside `state`, which is about to be committed at `version`.
 *
 * A chat the writer touched, or one with no stamp yet, is stamped with `version`; every other
 * chat keeps its stamp. A chat that was stamped before but is not in `state` gets a tombstone at
 * `version`; a tombstone whose chat is back is dropped. Fields work the same way as chats.
 */
export function nextSyncStamps(
    prev: SyncStamps | undefined,
    state: ChatStateFull,
    touched: SyncTouched,
    version: number,
): SyncStamps {
    const p = prev ?? emptySyncStamps();

    const [directChats, removedDirectChats] = stampList(
        state.directChats.map((c) => c.id.userId),
        p.directChats,
        p.removedDirectChats,
        touched.directChats,
        version,
    );
    const [groupChats, removedGroupChats] = stampList(
        state.groupChats.map((g) => g.id.groupId),
        p.groupChats,
        p.removedGroupChats,
        touched.groupChats,
        version,
    );
    const [communities, removedCommunities] = stampList(
        state.communities.map((c) => c.id.communityId),
        p.communities,
        p.removedCommunities,
        touched.communities,
        version,
    );

    const fields: Partial<Record<SyncedField, number>> = {};
    for (const field of SYNCED_FIELDS) {
        const previous = p.fields[field];
        fields[field] = touched.fields.has(field) || previous === undefined ? version : previous;
    }

    return {
        directChats,
        groupChats,
        communities,
        removedDirectChats,
        removedGroupChats,
        removedCommunities,
        fields,
        updatedEvents: mergeUpdatedEventStamps(p.updatedEvents, touched.updatedEvents, version),
        chitEvents:
            touched.chitEvents.length > 0
                ? [...p.chitEvents, { version, events: touched.chitEvents }].slice(
                      -MAX_CHIT_EVENT_BATCHES,
                  )
                : p.chitEvents,
        suspension: touched.suspensionChanged ? version : p.suspension,
    };
}

function stampList(
    ids: string[],
    prevStamps: Record<string, number>,
    prevRemoved: Record<string, number>,
    touched: Set<string>,
    version: number,
): [Record<string, number>, Record<string, number>] {
    const present = new Set(ids);
    const stamps: Record<string, number> = {};
    for (const id of ids) {
        const previous = prevStamps[id];
        stamps[id] = touched.has(id) || previous === undefined ? version : previous;
    }

    const removed: Record<string, number> = {};
    for (const [id, v] of Object.entries(prevRemoved)) {
        if (!present.has(id)) {
            removed[id] = v;
        }
    }
    for (const id of Object.keys(prevStamps)) {
        if (!present.has(id)) {
            removed[id] = version;
        }
    }

    return [stamps, boundByVersion(removed, MAX_TOMBSTONES)];
}

function boundByVersion(stamps: Record<string, number>, max: number): Record<string, number> {
    const entries = Object.entries(stamps);
    if (entries.length <= max) return stamps;
    entries.sort(([, a], [, b]) => b - a);
    return Object.fromEntries(entries.slice(0, max));
}

/**
 * Stamps a batch of updated events at `version`. Merged rather than appended: an event updated
 * again only needs to be pulled once, at its newest version, since the fold re-reads the event.
 */
export function mergeUpdatedEventStamps(
    prev: UpdatedEventStamp[],
    updated: ChatMap<UpdatedEvent[]>,
    version: number,
): UpdatedEventStamp[] {
    if (updated.size === 0) return prev;

    const byKey = new Map<string, UpdatedEventStamp>();
    for (const stamp of prev) {
        byKey.set(updatedEventKey(stamp), stamp);
    }
    for (const [chatId, events] of updated.entries()) {
        for (const e of events) {
            const stamp: UpdatedEventStamp = {
                chatId,
                threadRootMessageIndex: e.threadRootMessageIndex,
                eventIndex: e.eventIndex,
                timestamp: e.timestamp,
                version,
            };
            byKey.set(updatedEventKey(stamp), stamp);
        }
    }

    const oldest = version - MAX_UPDATED_EVENT_VERSION_LAG;
    const all = [...byKey.values()].filter((stamp) => stamp.version > oldest);
    if (all.length <= MAX_UPDATED_EVENT_STAMPS) return all;
    all.sort((a, b) => b.version - a.version);
    return all.slice(0, MAX_UPDATED_EVENT_STAMPS);
}

function updatedEventKey({
    chatId,
    threadRootMessageIndex,
    eventIndex,
}: UpdatedEventStamp): string {
    return `${chatIdentifierToString(chatId)}|${threadRootMessageIndex ?? ""}|${eventIndex}`;
}

/**
 * Everything in `state` stamped after `since`, in the shape the UI already folds, plus the
 * updated events stamped after `since` that fall inside `windows` (once each where windows
 * overlap). The chat summaries are returned as cached, so the caller hydrates them.
 */
export function updatesSince(
    state: ChatStateFull,
    stamps: SyncStamps,
    since: number,
    windows: SyncWindow[],
): UpdatesResult {
    // A record with no stamp is carried rather than skipped: a duplicate is harmless, a hole never heals
    const after = (record: Record<string, number>, id: string) =>
        (record[id] ?? Number.MAX_SAFE_INTEGER) > since;
    const field = (name: SyncedField) => (stamps.fields[name] ?? Number.MAX_SAFE_INTEGER) > since;
    const ifField = <T>(name: SyncedField, value: T): T | undefined =>
        field(name) ? value : undefined;
    const ifOption = <T>(name: SyncedField, value: T | undefined): OptionUpdate<T> =>
        field(name) ? (value === undefined ? "set_to_none" : { value }) : undefined;

    const updatedEvents = new ChatMap<UpdatedEvent[]>();
    for (const stamp of stamps.updatedEvents) {
        if (stamp.version > since && windows.some((w) => inWindow(stamp, w))) {
            const existing = updatedEvents.get(stamp.chatId);
            const event: UpdatedEvent = {
                eventIndex: stamp.eventIndex,
                threadRootMessageIndex: stamp.threadRootMessageIndex,
                timestamp: stamp.timestamp,
            };
            if (existing === undefined) {
                updatedEvents.set(stamp.chatId, [event]);
            } else {
                existing.push(event);
            }
        }
    }

    return {
        directChatsAddedUpdated: state.directChats.filter((c) =>
            after(stamps.directChats, c.id.userId),
        ),
        directChatsRemoved: removedSince(stamps.removedDirectChats, since),
        groupsAddedUpdated: state.groupChats.filter((g) => after(stamps.groupChats, g.id.groupId)),
        groupsRemoved: removedSince(stamps.removedGroupChats, since),
        communitiesAddedUpdated: state.communities.filter((c) =>
            after(stamps.communities, c.id.communityId),
        ),
        communitiesRemoved: removedSince(stamps.removedCommunities, since),
        avatarId: ifOption("avatarId", state.avatarId),
        blockedUsers: ifField("blockedUsers", state.blockedUsers),
        pinnedChats: ifField("pinnedChats", state.pinnedChats),
        pinnedChannels: ifField("pinnedChannels", state.pinnedChannels),
        pinnedFavouriteChats: ifField("pinnedFavouriteChats", state.pinnedFavouriteChats),
        favouriteChats: ifField("favouriteChats", state.favouriteChats),
        pinNumberSettings: ifOption("pinNumberSettings", state.pinNumberSettings),
        achievements: ifField("achievements", state.achievements),
        chitState: ifField("chitState", state.chitState),
        referrals: ifField("referrals", state.referrals),
        walletConfig: ifField("walletConfig", state.walletConfig),
        messageActivitySummary: ifField("messageActivitySummary", state.messageActivitySummary),
        installedBots: ifField("installedBots", state.installedBots),
        bitcoinAddress: ifField("bitcoinAddress", state.bitcoinAddress),
        oneSecAddress: ifField("oneSecAddress", state.oneSecAddress),
        streakInsurance: ifOption("streakInsurance", state.streakInsurance),
        premiumItems: ifField("premiumItems", state.premiumItems),
        updatedEvents: updatedEvents.toMap() as Map<string, UpdatedEvent[]>,
        suspensionChanged:
            stamps.suspension !== undefined && stamps.suspension > since ? true : undefined,
        newAchievements: stamps.chitEvents
            .filter((batch) => batch.version > since)
            .flatMap((batch) => batch.events),
    };
}

export function emptyUpdatesResult(): UpdatesResult {
    return {
        directChatsAddedUpdated: [],
        directChatsRemoved: [],
        groupsAddedUpdated: [],
        groupsRemoved: [],
        communitiesAddedUpdated: [],
        communitiesRemoved: [],
        avatarId: undefined,
        blockedUsers: undefined,
        pinnedChats: undefined,
        pinnedChannels: undefined,
        pinnedFavouriteChats: undefined,
        favouriteChats: undefined,
        pinNumberSettings: undefined,
        achievements: undefined,
        chitState: undefined,
        referrals: undefined,
        walletConfig: undefined,
        messageActivitySummary: undefined,
        installedBots: undefined,
        bitcoinAddress: undefined,
        oneSecAddress: undefined,
        streakInsurance: undefined,
        premiumItems: undefined,
        updatedEvents: new Map(),
        suspensionChanged: undefined,
        newAchievements: [],
    };
}

function removedSince(removed: Record<string, number>, since: number): string[] {
    return Object.entries(removed)
        .filter(([, version]) => version > since)
        .map(([id]) => id);
}

function inWindow(stamp: UpdatedEventStamp, window: SyncWindow): boolean {
    return (
        chatIdentifiersEqual(stamp.chatId, window.chatId) &&
        stamp.threadRootMessageIndex === window.threadRootMessageIndex &&
        stamp.eventIndex >= window.from &&
        (window.to === undefined || stamp.eventIndex <= window.to)
    );
}
