import type { ChatSummary, Proposal } from "../domain/chat/chat";
import { Readable, writable } from "svelte/store";

const storageKeyPrefix = "proposal_filters_";

export class FilteredProposals {
    private _canisterId: string;
    // A map of messageId to boolean where true==collapsed
    private _messageState: Map<bigint, boolean>;
    private _filters: Set<number>;

    constructor(canisterId: string) {
        this._canisterId = canisterId;
        this._messageState = new Map();
        this._filters = new Set();
    }

    static fromStorage(canisterId: string): FilteredProposals {
        const filteredProposals = new FilteredProposals(canisterId);
        const json = localStorage.getItem(storageKeyPrefix + canisterId);
        filteredProposals._filters = new Set(json !== null ? <number[]>JSON.parse(json) : []);
        return filteredProposals;
    }

    get filters(): Set<number> {
        return this._filters;
    }

    hasFilter(topic: number): boolean {
        return this._filters.has(topic);
    }

    isCollapsed(messageId: bigint, proposal: Proposal): boolean {
        const topic = proposal.kind === "nns" ? proposal.topic : proposal.action;
        const isFiltered = this._filters.has(topic);
        const messageState = this._messageState.get(messageId);
        return messageState ?? isFiltered;
    }

    toggleFilter(topic: number): void {
        if (this._filters.has(topic)) {
            this._filters.delete(topic);
        } else {
            this._filters.add(topic);
        }
        // Clear all toggled messages when any filter changes.
        // TODO: Can improve by only clearing those messages that match the changed topic
        this._messageState = new Map();
        this.toStorage();
    }

    toggleMessageExpansion(messageId: bigint, expand: boolean): void {
        const currState = this._messageState.get(messageId);

        if (currState === undefined) {
            this._messageState.set(messageId, !expand);
        } else if (currState == expand) {
            this._messageState.delete(messageId);
        }
    }

    clone(): FilteredProposals {
        const clone = new FilteredProposals(this._canisterId);
        clone._messageState = new Map(this._messageState);
        clone._filters = new Set(this._filters);
        return clone;
    }

    private toStorage() {
        localStorage.setItem(
            storageKeyPrefix + this._canisterId,
            JSON.stringify(Array.from(this._filters))
        );
    }
}

export interface IFilteredProposalsStore extends Readable<FilteredProposals | undefined> {
    toggleFilter(topic: number): void;
    toggleMessageExpansion(messageId: bigint, expand: boolean): void;
}

export function createFilteredProposalsStore(chat: ChatSummary): IFilteredProposalsStore {
    const filteredProposals =
        chat.kind === "group_chat" && chat.subtype?.kind === "governance_proposals"
            ? FilteredProposals.fromStorage(chat.subtype.governanceCanisterId)
            : undefined;

    const store = writable<FilteredProposals | undefined>(filteredProposals);
    return {
        subscribe: store.subscribe,
        toggleFilter: (topic: number): void =>
            store.update((fp) => {
                if (fp !== undefined) {
                    const clone = fp.clone();
                    clone.toggleFilter(topic);
                    return clone;
                }
            }),
        toggleMessageExpansion: (messageId: bigint, expand: boolean): void =>
            store.update((fp) => {
                if (fp !== undefined) {
                    const clone = fp.clone();
                    clone.toggleMessageExpansion(messageId, expand);
                    return clone;
                }
            }),
    };
}
