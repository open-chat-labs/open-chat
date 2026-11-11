import {
    selectedChatPinnedMessagesStore,
    selectedChatSummaryStore,
    selectedServerChatStore,
    type EventWrapper,
    type Message,
    type MultiUserChatIdentifier,
    type OpenChat,
    type ReadonlySet,
} from "@client";
import { isSuccessfulEventsResponse } from "@shared";
import { reactiveValue } from "@src/utils/reactiveValue";
import type { RemoteData } from "@src/utils/remoteData";
import { untrack } from "svelte";

/** The pinned messages, grouped by day, oldest first. */
export type PinnedMessagesData = RemoteData<EventWrapper<Message>[][], string>;

/**
 * What the pinned messages follow: the selected chat's pinned set, whether its details are in, and
 * when the chat last changed.
 */
export type PinnedSources = {
    /** The pinned set (selectedChatPinnedMessagesStore). */
    pinned: () => ReadonlySet<number>;
    /** Whether the chat's details have loaded (selectedServerChatStore isn't undefined). */
    detailsLoaded: () => boolean;
    /**
     * When the chat last changed (the selected chat summary's lastUpdated). An edit to a pinned
     * message moves it on without changing the pinned set; the cache marks the edited message
     * stale in the same update, so fetching again gets its new text.
     */
    chatUpdated: () => bigint | undefined;
};

function selectedChatSources(): PinnedSources {
    const serverChat = reactiveValue(selectedServerChatStore);
    const summary = reactiveValue(selectedChatSummaryStore);
    return {
        pinned: reactiveValue(selectedChatPinnedMessagesStore),
        detailsLoaded: () => serverChat() !== undefined,
        chatUpdated: () => summary()?.lastUpdated,
    };
}

/**
 * A chat and its pinned set, as of when the chat last changed, as one key: the same members in any
 * order are the same key.
 */
export function pinnedKey(
    chatId: MultiUserChatIdentifier,
    pinned: ReadonlySet<number>,
    chatUpdated: bigint | undefined,
): string {
    return `${JSON.stringify(chatId)}|${[...pinned].sort((a, b) => a - b).join(",")}|${chatUpdated ?? ""}`;
}

/**
 * A chat's pinned messages, as its pinned panel shows them. The pinned set is read as it changes,
 * so pins that arrive after the panel opens still show, and until the chat's details arrive the
 * set is unknown (loading), not empty. Loading them marks them read when there are unread pins.
 */
export class PinnedMessages {
    #messages = $state<PinnedMessagesData>({ kind: "idle" });
    // only whether the details are in: not every other update to them (members, settings…)
    #detailsLoaded = $derived.by(() => this.sources.detailsLoaded());
    // only when the chat changed: not when the summary is replaced with the same timestamp
    #chatUpdated = $derived.by(() => this.sources.chatUpdated());
    // read where sync() tracks it, so a pin's date arriving after the pinned set still marks it read
    #dateLastPinned = $derived.by(() => this.dateLastPinned());
    // the latest load: one that finishes after a newer one has started is dropped
    #request = 0;
    // the chat, its pins and when it last changed, as of the latest load: the pinned store emits on
    // every update to the chat's details (members, settings…), and the same pins of an unchanged
    // chat needn't be fetched again
    #loadedFor: string | undefined;

    constructor(
        private client: Pick<
            OpenChat,
            | "getMessagesByMessageIndex"
            | "groupMessagesByDate"
            | "unreadPinned"
            | "markPinnedMessagesRead"
            | "logError"
        >,
        private chatId: () => MultiUserChatIdentifier,
        private dateLastPinned: () => bigint | undefined,
        private sources: PinnedSources = selectedChatSources(),
    ) {}

    get messages(): PinnedMessagesData {
        return this.#messages;
    }

    /**
     * Loads the pinned messages. Called from an $effect, it runs again whenever the chat's details
     * arrive, its pinned set changes, the chat changes (an edit to a pin, say) or a pin's date
     * does. Resolves true once a load has succeeded (for the view to scroll); a load overtaken by
     * a newer one resolves false and changes nothing. The same pins of an unchanged chat as the
     * latest load (loaded or still loading) aren't fetched again; after a failure they are. Pins
     * already loaded are marked read when a newer pin's date arrives.
     */
    sync(): Promise<boolean> {
        if (!this.#detailsLoaded) {
            this.#request += 1;
            this.#loadedFor = undefined;
            this.#messages = { kind: "loading" };
            return Promise.resolve(false);
        }
        const pinned = this.sources.pinned();
        const chatUpdated = this.#chatUpdated;
        const dateLastPinned = this.#dateLastPinned;
        return untrack(() => {
            const chatId = this.chatId();
            const loadFor = pinnedKey(chatId, pinned, chatUpdated);
            if (loadFor === this.#loadedFor && this.#messages.kind !== "error") {
                // a load still running marks them read as it finishes
                if (this.#messages.kind === "success") this.#markRead(chatId, dateLastPinned);
                return Promise.resolve(false);
            }
            this.#loadedFor = loadFor;
            return this.#load(pinned);
        });
    }

    #markRead(chatId: MultiUserChatIdentifier, dateLastPinned: bigint | undefined) {
        if (dateLastPinned !== undefined && this.client.unreadPinned(chatId, dateLastPinned)) {
            this.client.markPinnedMessagesRead(chatId, dateLastPinned);
        }
    }

    async #load(pinned: ReadonlySet<number>): Promise<boolean> {
        const request = ++this.#request;
        if (pinned.size === 0) {
            this.#messages = { kind: "success", data: [] };
            return false;
        }
        if (this.#messages.kind !== "success") {
            this.#messages = { kind: "loading" };
        }
        const chatId = this.chatId();
        try {
            const resp = await this.client.getMessagesByMessageIndex(chatId, undefined, [
                ...pinned,
            ]);
            if (request !== this.#request) return false;
            if (!isSuccessfulEventsResponse(resp)) {
                this.#messages = { kind: "error", error: "Unable to load pinned messages" };
                return false;
            }
            this.#messages = {
                kind: "success",
                data: this.client.groupMessagesByDate(
                    resp.events.sort((a, b) => a.index - b.index),
                ),
            };
            this.#markRead(chatId, this.dateLastPinned());
            return true;
        } catch (err) {
            if (request !== this.#request) return false;
            this.client.logError("Unable to load pinned messages: ", err);
            this.#messages = { kind: "error", error: String(err) };
            return false;
        }
    }
}
