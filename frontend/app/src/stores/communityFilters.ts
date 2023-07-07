/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Writable, derived, writable } from "svelte/store";

type CommunityFilter = {
    languages: Set<string>;
    flags: number;
};

type Flag = 1 | 2;

export const Flags = {
    Offensive: 1 as Flag,
    Adult: 2 as Flag,
};

function toString(filter: CommunityFilter): string {
    return JSON.stringify({
        ...filter,
        languages: Array.from(filter.languages),
    });
}

function fromString(serialised: string | null): CommunityFilter | undefined {
    if (!serialised) return undefined;
    const parsed = JSON.parse(serialised);
    return {
        flags: parsed.flags,
        languages: new Set(parsed.languages),
    };
}

function initialise(): Writable<CommunityFilter> {
    const filter = fromString(localStorage.getItem("openchat_community_filters")) ?? {
        languages: new Set<string>(),
        flags: 0,
    };
    return writable(filter);
}

function save(filter: CommunityFilter): CommunityFilter {
    localStorage.setItem("openchat_community_filters", toString(filter));
    return filter;
}

const store = initialise();

export const communityFiltersStore = {
    subscribe: store.subscribe,
    toggleLanguage: (lang: string) => {
        store.update((filter) => {
            if (filter.languages.has(lang)) {
                filter.languages.delete(lang);
            } else {
                filter.languages.add(lang);
            }
            return save({ ...filter });
        });
    },
    toggleFlag: (flag: Flag) => {
        store.update((filter) => {
            return save({
                ...filter,
                flags: filter.flags ^ flag,
            });
        });
    },
};

export const adultEnabled = derived(store, (store) => (store.flags & Flags.Adult) !== 0);
export const offensiveEnabled = derived(store, (store) => (store.flags & Flags.Offensive) !== 0);
