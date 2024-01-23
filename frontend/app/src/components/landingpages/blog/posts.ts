import type { SvelteComponent } from "svelte";
import Communities from "./Communities.svelte";
import CommunitiesReleased from "./CommunitiesReleased.svelte";
import Governance from "./Governance.svelte";
import WebsiteReleases from "./WebsiteReleases.svelte";
import Translation from "./Translation.svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    author: string;
    date: Date;
    component: typeof SvelteComponent<object>;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
    translations: {
        slug: "translations",
        title: "Translations",
        author: "@julian_jelfs",
        date: new Date(2024, 1, 31),
        component: Translation,
    },
    communities_released: {
        slug: "communities_released",
        title: "Communities released!",
        author: "@julian_jelfs",
        date: new Date(2023, 6, 31),
        component: CommunitiesReleased,
    },
    communities: {
        slug: "communities",
        title: "Communities in depth",
        author: "@julian_jelfs",
        date: new Date(2023, 1, 28),
        component: Communities,
    },
    governance: {
        slug: "governance",
        title: "OpenChat governance",
        author: "@Matt",
        date: new Date(2023, 2, 8),
        component: Governance,
    },
    website_releases: {
        slug: "website_releases",
        title: "Website releases",
        author: "@Matt",
        date: new Date(2023, 2, 10),
        component: WebsiteReleases,
    },
};
