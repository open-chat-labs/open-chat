import {
    selectedChatPinnedMessagesStore,
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
 * A chat's pinned messages, as its pinned panel shows them. The pinned set is read as it changes,
 * so pins that arrive after the panel opens still show, and until the chat's details arrive the
 * set is unknown (loading), not empty. Loading them marks them read when there are unread pins.
 */
export class PinnedMessages {
    #messages = $state<PinnedMessagesData>({ kind: "idle" });
    #pinned = reactiveValue(selectedChatPinnedMessagesStore);
    #serverChat = reactiveValue(selectedServerChatStore);

    constructor(
        private client: OpenChat,
        private chatId: () => MultiUserChatIdentifier,
        private dateLastPinned: () => bigint | undefined,
    ) {}

    get messages(): PinnedMessagesData {
        return this.#messages;
    }

    /**
     * Loads the pinned messages. Called from an $effect, it runs again whenever the chat's details
     * or its pinned set change. Resolves true once a load has succeeded (for the view to scroll).
     */
    sync(): Promise<boolean> {
        if (this.#serverChat() === undefined) {
            this.#messages = { kind: "loading" };
            return Promise.resolve(false);
        }
        const pinned = this.#pinned();
        return untrack(() => this.#load(pinned));
    }

    async #load(pinned: ReadonlySet<number>): Promise<boolean> {
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
            const dateLastPinned = this.dateLastPinned();
            if (dateLastPinned !== undefined && this.client.unreadPinned(chatId, dateLastPinned)) {
                this.client.markPinnedMessagesRead(chatId, dateLastPinned);
            }
            return true;
        } catch (err) {
            this.client.logError("Unable to load pinned messages: ", err);
            this.#messages = { kind: "error", error: String(err) };
            return false;
        }
    }
}
