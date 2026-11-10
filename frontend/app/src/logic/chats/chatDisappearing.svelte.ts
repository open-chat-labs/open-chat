import {
    chatIdentifierToString,
    disappearingLengthsStore,
    isDeletedUser,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type OpenChat,
    type UserSummary,
} from "@client";
import { Optimistic } from "@openchat/ui/src/lib/behaviours/optimistic.svelte";
import { canChangeDisappearing } from "@src/logic/groupOrCommunity/detailsPermissions";
import {
    DISAPPEARING_START,
    disappearingChoicesWith,
    durationMs,
    ttlDurationId,
} from "./disappearingMessages";
import { setDmDisappearing } from "./dmSettings";
import { setGroupDisappearing } from "./groupDisappearing";

// A chat's disappearing messages as the native screens set them (native plan 10 and 04): one
// setting, the chat's TTL, which the details' switch and lengths (the library's TimedToggle) and
// the conversation menu's submenu both read and write, each through a ChatDisappearing, and the
// length switching them on again goes back to, which both read from the client's
// disappearingLengthsStore.

/** On or off, and how long they last (a duration id: "1 day"). */
export type DisappearingSetting = { on: boolean; after: string };

/**
 * The setting a chat's TTL makes: on for its length, or off, showing `last` (the length to go
 * back to when it's switched on again).
 */
export function disappearingSetting(ttl: bigint | undefined, last: string): DisappearingSetting {
    return ttl === undefined || ttl <= 0n
        ? { on: false, after: last }
        : { on: true, after: ttlDurationId(ttl) };
}

/** The other side of a DM: who they are (once they're loaded), and whether the viewer blocked them. */
export type DmPeer = { user: UserSummary | undefined; blocked: boolean };

/**
 * Whether a DM's disappearing messages may be set: not with a bot (nothing said there is worth
 * timing out, and its DM can't be muted either), a deleted user, or someone the viewer blocked
 * (nothing more can be said there). Someone not loaded yet counts as a person.
 */
export function dmDisappearingAllowed(peer: DmPeer): boolean {
    return peer.user?.kind !== "bot" && !isDeletedUser(peer.user) && !peer.blocked;
}

/**
 * Whether the viewer may switch the chat's disappearing messages on and off and set how long:
 * either side of a DM, unless `dmDisappearingAllowed` says not (`peer`, a DM's other side); in a
 * group or channel, those its settings let (owners: `canChangeDisappearing`).
 */
export function canSetDisappearing(
    client: OpenChat,
    chat: ChatSummary,
    community: CommunitySummary | undefined,
    anon: boolean,
    peer: DmPeer,
): boolean {
    return chat.kind === "direct_chat"
        ? dmDisappearingAllowed(peer)
        : canChangeDisappearing(client, chat, community, anon);
}

/** Saves the setting: a DM's (`dmSettings`) or a group's or channel's (`groupDisappearing`). Rejects when it isn't saved. */
export function setChatDisappearing(
    client: OpenChat,
    chat: ChatSummary,
    setting: DisappearingSetting,
): Promise<void> {
    const afterMs = durationMs(setting.after);
    return chat.kind === "direct_chat"
        ? setDmDisappearing(client, chat, { on: setting.on, afterMs })
        : setGroupDisappearing(client, chat, { on: setting.on, afterMs });
}

/** Where each chat's last length is kept (its TTL, by `chatIdentifierToString`): the client's `disappearingLengthsStore`. */
export type DisappearingLengths = {
    get(key: string): bigint | undefined;
    insert(key: string, ttl: bigint): void;
};

/**
 * A chat's disappearing messages on a screen (the details' switch, the conversation menu): shown
 * at once and back as they were if it's refused (the library's Optimistic). Switched off, they go
 * back on at the length the chat's TTL last had this session (`lengths`, shared by every screen,
 * so it outlives this one): the details' or the menu's, or another device's; a chat that hasn't
 * had one starts at a day. Only the TTL sets that length, never a save as it finishes, so one
 * that finishes after a newer one can't change it. Call `sync` when the chat's TTL changes.
 */
export class ChatDisappearing {
    #key: string;
    #ttl: () => bigint | undefined;
    #save: (setting: DisappearingSetting) => Promise<void>;
    #lengths: DisappearingLengths;
    #value: Optimistic<DisappearingSetting>;

    constructor(
        chatId: ChatIdentifier,
        ttl: () => bigint | undefined,
        save: (setting: DisappearingSetting) => Promise<void>,
        lengths: DisappearingLengths = disappearingLengthsStore,
    ) {
        this.#key = chatIdentifierToString(chatId);
        this.#ttl = ttl;
        this.#save = save;
        this.#lengths = lengths;
        this.#remember();
        this.#value = new Optimistic(() => disappearingSetting(this.#ttl(), this.#last()));
    }

    get current(): DisappearingSetting {
        return this.#value.current;
    }

    /** The lengths to offer: the usual ones, and the current one where it's another. */
    get choices(): string[] {
        return disappearingChoicesWith(this.current.after);
    }

    /** The chat's TTL changed: follow it, and remember its length. */
    sync() {
        this.#remember();
        this.#value.sync();
    }

    /** Resolves true when it's saved; false when it's refused, and the setting is back as it was. */
    set(on: boolean, after: string): Promise<boolean> {
        return this.#value.set({ on, after }, (setting) => this.#save(setting));
    }

    // the length to go back to: the TTL's last this session, else the one they start at
    #last(): string {
        const ttl = this.#lengths.get(this.#key);
        return ttl === undefined ? DISAPPEARING_START : ttlDurationId(ttl);
    }

    #remember() {
        const ttl = this.#ttl();
        if (ttl !== undefined && ttl > 0n) this.#lengths.insert(this.#key, ttl);
    }
}
