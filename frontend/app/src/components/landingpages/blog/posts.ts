import type { SvelteComponent } from "svelte";
import Communities from "./Communities.svelte";
import Governance from "./Governance.svelte";
import WebsiteReleases from "./WebsiteReleases.svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    author: string;
    date: Date;
    component: typeof SvelteComponent;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
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
