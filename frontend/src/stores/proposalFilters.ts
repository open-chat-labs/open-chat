import { Readable, writable } from "svelte/store";

export interface ProposalFiltersStore extends Readable<Set<number>> {
    toggle(topic: number): void;
}

export const proposalFilters = createProposalFiltersStore();

export function createProposalFiltersStore(): ProposalFiltersStore {
    const key = "nns_proposal_filters";
    const json = localStorage.getItem(key);
    const initial = json !== null ? <number[]>JSON.parse(json) : [];

    const store = writable<Set<number>>(new Set(initial));
    return {
        subscribe: store.subscribe,
        toggle: (topic: number): void =>
            store.update((s) => {
                if (s.has(topic)) {
                    s.delete(topic);
                } else {
                    s.add(topic);
                }
                localStorage.setItem(key, JSON.stringify(Array.from(s)));
                return new Set(s);
            }),
    };
}
