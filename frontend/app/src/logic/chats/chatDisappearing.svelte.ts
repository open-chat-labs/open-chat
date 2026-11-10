import type { ChatSummary, CommunitySummary, OpenChat } from "@client";
import { Optimistic } from "@openchat/ui/src/lib/behaviours/optimistic.svelte";
import { canChangeDisappearing } from "@src/logic/groupOrCommunity/detailsPermissions";
import { disappearingChoicesWith, durationMs, ttlDurationId } from "./disappearingMessages";
import { setDmDisappearing } from "./dmSettings";
import { setGroupDisappearing } from "./groupDisappearing";

// A chat's disappearing messages as the native screens set them (native plan 10 and 04): one
// setting, the chat's TTL, which the details' switch and lengths (the library's TimedToggle) and
// the conversation menu's submenu both read and write, through setChatDisappearing.

/** The length they start at when first switched on (native plan 10). */
export const DISAPPEARING_START = "1 day";

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

/**
 * Whether the viewer may switch the chat's disappearing messages on and off and set how long:
 * either side of a DM; in a group or channel, those its settings let (owners:
 * `canChangeDisappearing`).
 */
export function canSetDisappearing(
    client: OpenChat,
    chat: ChatSummary,
    community: CommunitySummary | undefined,
    anon: boolean,
): boolean {
    return chat.kind === "direct_chat" || canChangeDisappearing(client, chat, community, anon);
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

/**
 * The details' switch and lengths: shown at once and back as they were if it's refused (the
 * library's Optimistic). Switched off, it remembers the length it had (or the one the chat's TTL
 * last had, from the menu or another device), which switching it on again goes back to; a chat
 * that's never had one starts at a day. Call `sync` when the chat's TTL changes.
 */
export class ChatDisappearing {
    #ttl: () => bigint | undefined;
    #save: (setting: DisappearingSetting) => Promise<void>;
    #last = $state(DISAPPEARING_START);
    #value: Optimistic<DisappearingSetting>;

    constructor(
        ttl: () => bigint | undefined,
        save: (setting: DisappearingSetting) => Promise<void>,
    ) {
        this.#ttl = ttl;
        this.#save = save;
        this.#remember();
        this.#value = new Optimistic(() => disappearingSetting(this.#ttl(), this.#last));
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
    async set(on: boolean, after: string): Promise<boolean> {
        const saved = await this.#value.set({ on, after }, (setting) => this.#save(setting));
        if (saved) this.#last = after;
        return saved;
    }

    #remember() {
        const ttl = this.#ttl();
        if (ttl !== undefined && ttl > 0n) this.#last = ttlDurationId(ttl);
    }
}
