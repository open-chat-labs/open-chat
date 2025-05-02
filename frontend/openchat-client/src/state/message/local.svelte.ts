import { type Message, type MessageContent } from "openchat-shared";
import { ReactiveMessageMap } from "../map";
import { scheduleUndo, type UndoLocalUpdate } from "../undo";

export class MessageLocalState {
    #editedContent = $state<MessageContent | undefined>();
    #linkRemoved = $state<boolean>(false);

    get editedContent() {
        return this.#editedContent;
    }
    set editedContent(val: MessageContent | undefined) {
        this.#editedContent = val;
    }
    get linkRemoved() {
        return this.#linkRemoved;
    }
    set linkRemoved(val: boolean) {
        this.#linkRemoved = val;
    }
}

export class MessageLocalStateManager {
    #data = new ReactiveMessageMap<MessageLocalState>();

    get(messageId: bigint): MessageLocalState | undefined {
        return this.#data.get(messageId);
    }

    #getOrCreate(messageId: bigint): MessageLocalState {
        let state = this.#data.get(messageId);
        if (state === undefined) {
            state = new MessageLocalState();
            this.#data.set(messageId, state);
        }
        return state;
    }

    entries(): IterableIterator<[bigint, MessageLocalState]> {
        return this.#data.entries();
    }

    markContentEdited({ messageId, content }: Message): UndoLocalUpdate {
        const state = this.#getOrCreate(messageId);
        const previous = state.editedContent;
        state.editedContent = content;
        state.linkRemoved = false;
        return scheduleUndo(() => {
            state.editedContent = previous;
        });
    }

    // Only used for testing
    clearAll() {
        this.#data = new ReactiveMessageMap<MessageLocalState>();
    }
}

export const messageLocalUpdates = new MessageLocalStateManager();
