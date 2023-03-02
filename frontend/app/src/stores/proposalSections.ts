import { writable } from "svelte/store";

const sectionStateKey = "openchat_proposal_sections";

export type ProposalActionCategory =
    | "all"
    | "unknown"
    | "builtIn"
    | "userIndex"
    | "groupIndex"
    | "notifications"
    | "proposalsBot"
    | "storageIndex"
    | "cyclesDispenser";

export type ProposalSectionState = Record<ProposalActionCategory, boolean>;

const defaultSectionState: ProposalSectionState = {
    all: true,
    unknown: true,
    builtIn: true,
    userIndex: false,
    groupIndex: false,
    notifications: false,
    proposalsBot: false,
    storageIndex: false,
    cyclesDispenser: false,
};

function initialise() {
    const data = localStorage.getItem(sectionStateKey);
    return data ? (JSON.parse(data) as ProposalSectionState) : defaultSectionState;
}

const store = writable<ProposalSectionState>(initialise());

export const proposalActionCategories = {
    subscribe: store.subscribe,
    toggle: (category: ProposalActionCategory): void => {
        store.update((state) => {
            const updated = { ...state, [category]: !state[category] };
            localStorage.setItem(sectionStateKey, JSON.stringify(updated));
            return updated;
        });
    },
};
