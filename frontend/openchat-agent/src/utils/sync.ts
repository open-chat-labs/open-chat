import type {
    ChatIdentifier,
    ChatStateFull,
    ChitEvent,
    CommunitySummary,
    DirectChatSummary,
    GroupChatSummary,
    OptionUpdate,
    UpdatedEvent,
    UpdatesResult,
} from "@shared";
import { ChatMap, chatIdentifierToKey } from "@shared";

/**
 * The versioning behind the cache -> UI sync pull (see `domain/sync.ts` in openchat-shared).
 *
 * Each chat is a row of its own carrying the version it was last written at, and a removed chat
 * leaves a tombstone row at the version it went, so a pull reads only the chats written since
 * its cursor. Everything else is one record of global fields, and their versions live beside it
 * in a `SyncStamps` record written in the same transaction: a version per global field, per
 * updated event and per batch of chit events. The functions here are pure so the rules can be
 * tested without IndexedDB.
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

/** The chat state minus the chats, which live one per row */
export type ChatGlobals = Omit<ChatStateFull, "directChats" | "groupChats" | "communities">;

export type ChatRow =
    | { kind: "direct_chat"; version: number; summary: DirectChatSummary }
    | { kind: "group_chat"; version: number; summary: GroupChatSummary }
    | { kind: "community"; version: number; summary: CommunitySummary };

export type ChatRowKind = ChatRow["kind"];

export type ChatTombstone = { kind: ChatRowKind; id: string; version: number };

export type RemovedChats = { directChats: string[]; groupChats: string[]; communities: string[] };

/** The globals, the chats written after a version and the chats removed after it */
export type ChatsSince = { state: ChatStateFull; removed: RemovedChats };

type ChatRowSummary = ChatRow["summary"];

// A direct chat and a group chat can share an id, so the kind is part of the key
export function chatRowKey(kind: ChatRowKind, id: string): string {
    return `${kind}|${id}`;
}

function rowId(chat: ChatRowSummary): string {
    switch (chat.kind) {
        case "direct_chat":
            return chat.id.userId;
        case "group_chat":
            return chat.id.groupId;
        case "community":
            return chat.id.communityId;
    }
}

function touchedIds(touched: SyncTouched, kind: ChatRowKind): Set<string> {
    switch (kind) {
        case "direct_chat":
            return touched.directChats;
        case "group_chat":
            return touched.groupChats;
        case "community":
            return touched.communities;
    }
}

/**
 * The rows a write of `state` has to touch, given the keys already cached. A chat the writer
 * touched, or one with no row yet, is written; every other row is left as it is, which is what
 * keeps a pass that changed one chat from rewriting them all. A cached row whose chat is not in
 * `state` is removed and leaves a tombstone.
 *
 * `rewriteAll` is for a write with no cached globals (first write, or the cache was found
 * unusable): the rows still there are not to be trusted, so every chat is written.
 */
export function chatRowsToWrite(
    state: ChatStateFull,
    touched: SyncTouched,
    cachedKeys: Set<string>,
    rewriteAll: boolean,
): {
    put: { key: string; isNew: boolean; summary: ChatRowSummary }[];
    removed: { key: string; kind: ChatRowKind; id: string }[];
} {
    const put: { key: string; isNew: boolean; summary: ChatRowSummary }[] = [];
    const present = new Set<string>();
    const chats: ChatRowSummary[] = [
        ...state.directChats,
        ...state.groupChats,
        ...state.communities,
    ];
    for (const summary of chats) {
        const id = rowId(summary);
        const key = chatRowKey(summary.kind, id);
        present.add(key);
        const isNew = !cachedKeys.has(key);
        if (rewriteAll || isNew || touchedIds(touched, summary.kind).has(id)) {
            put.push({ key, isNew, summary });
        }
    }
    const removed: { key: string; kind: ChatRowKind; id: string }[] = [];
    for (const key of cachedKeys) {
        if (!present.has(key)) {
            const separator = key.indexOf("|");
            removed.push({
                key,
                kind: key.slice(0, separator) as ChatRowKind,
                id: key.slice(separator + 1),
            });
        }
    }
    return { put, removed };
}

/** Puts the globals and the chat rows back together as the state the updates loop works on */
export function stateFromRows(globals: ChatGlobals, rows: ChatRow[]): ChatStateFull {
    const state: ChatStateFull = { ...globals, directChats: [], groupChats: [], communities: [] };
    for (const row of rows) {
        switch (row.kind) {
            case "direct_chat":
                state.directChats.push(row.summary);
                break;
            case "group_chat":
                state.groupChats.push(row.summary);
                break;
            case "community":
                state.communities.push(row.summary);
                break;
        }
    }
    return state;
}

export function removedFromTombstones(tombstones: ChatTombstone[]): RemovedChats {
    const removed: RemovedChats = { directChats: [], groupChats: [], communities: [] };
    for (const t of tombstones) {
        switch (t.kind) {
            case "direct_chat":
                removed.directChats.push(t.id);
                break;
            case "group_chat":
                removed.groupChats.push(t.id);
                break;
            case "community":
                removed.communities.push(t.id);
                break;
        }
    }
    return removed;
}

export function globalsOf(state: ChatStateFull): ChatGlobals {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { directChats, groupChats, communities, ...globals } = state;
    return globals;
}

// An updated event is only interesting to a UI whose cursor is behind it, and every UI pulls to
// the head within seconds of it moving. These bounds only matter for a tab that has been wedged
// for hundreds of versions, and the events are marked dirty in the cache anyway so a re-read
// heals the display.
//
// The stamps record is rewritten whole on every pass, so the updated-event log is the one that
// costs anything: each entry carries a chat identifier, and a busy account would otherwise sit
// permanently at the cap. It is bounded twice - by how far behind the head an entry is, which is
// what keeps the steady state small, and by count as a backstop.
//
// Tombstones are never dropped. Nothing marks a removed chat dirty, so a dropped tombstone would
// leave a lagging UI showing that chat until it happened to change again, which for a deleted
// chat is never. They are a small row each and go when the chat comes back, so the store only
// grows by the chats the user has left and not rejoined.
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
 * The stamps to store alongside a write committed at `version`. A touched field, or one with no
 * stamp yet, is stamped with `version`; every other field keeps its stamp. The chats carry their
 * versions in their own rows (see `chatRowsToWrite`).
 */
export function nextSyncStamps(
    prev: SyncStamps | undefined,
    touched: SyncTouched,
    version: number,
): SyncStamps {
    const p = prev ?? emptySyncStamps();

    const fields: Partial<Record<SyncedField, number>> = {};
    for (const field of SYNCED_FIELDS) {
        const previous = p.fields[field];
        fields[field] = touched.fields.has(field) || previous === undefined ? version : previous;
    }

    return {
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
    // `chatIdentifierToKey` rather than `chatIdentifierToString`: the latter drops the kind, and a
    // direct chat and a group chat are separate namespaces
    return `${chatIdentifierToKey(chatId)}|${threadRootMessageIndex ?? ""}|${eventIndex}`;
}

/**
 * Everything written after `since`, in the shape the UI already folds. The chats and removals
 * come already filtered by their rows' versions; the fields and updated events are filtered
 * here by their stamps. The chat summaries are returned as cached, so the caller hydrates them.
 */
export function updatesSince(
    { state, removed }: ChatsSince,
    stamps: SyncStamps,
    since: number,
): UpdatesResult {
    // A field with no stamp is carried rather than skipped: a duplicate is harmless, a hole never heals
    const field = (name: SyncedField) => (stamps.fields[name] ?? Number.MAX_SAFE_INTEGER) > since;
    const ifField = <T>(name: SyncedField, value: T): T | undefined =>
        field(name) ? value : undefined;
    const ifOption = <T>(name: SyncedField, value: T | undefined): OptionUpdate<T> =>
        field(name) ? (value === undefined ? "set_to_none" : { value }) : undefined;

    const updatedEvents = new ChatMap<UpdatedEvent[]>();
    for (const stamp of stamps.updatedEvents) {
        if (stamp.version > since) {
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
        directChatsAddedUpdated: state.directChats,
        directChatsRemoved: removed.directChats,
        groupsAddedUpdated: state.groupChats,
        groupsRemoved: removed.groupChats,
        communitiesAddedUpdated: state.communities,
        communitiesRemoved: removed.communities,
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

/** The whole cached state in the shape the UI folds: the boot snapshot */
export function snapshotOf(state: ChatStateFull): UpdatesResult {
    const option = <T>(value: T | undefined): OptionUpdate<T> =>
        value === undefined ? undefined : { value };
    return {
        ...emptyUpdatesResult(),
        directChatsAddedUpdated: state.directChats,
        groupsAddedUpdated: state.groupChats,
        communitiesAddedUpdated: state.communities,
        avatarId: option(state.avatarId),
        blockedUsers: state.blockedUsers,
        pinnedChats: state.pinnedChats,
        pinnedChannels: state.pinnedChannels,
        pinnedFavouriteChats: state.pinnedFavouriteChats,
        favouriteChats: state.favouriteChats,
        pinNumberSettings: option(state.pinNumberSettings),
        achievements: state.achievements,
        chitState: state.chitState,
        referrals: state.referrals,
        walletConfig: state.walletConfig,
        messageActivitySummary: state.messageActivitySummary,
        installedBots: state.installedBots,
        bitcoinAddress: state.bitcoinAddress,
        oneSecAddress: state.oneSecAddress,
        streakInsurance: option(state.streakInsurance),
        premiumItems: state.premiumItems,
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
