/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { type Writable, writable } from "svelte/store";

type CommunityFilter = {
    languages: Set<string>;
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
        languages: new Set(parsed.languages),
    };
}

function initialise(): Writable<CommunityFilter> {
    const filter = fromString(localStorage.getItem("openchat_community_filters")) ?? {
        languages: new Set<string>(),
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
};
