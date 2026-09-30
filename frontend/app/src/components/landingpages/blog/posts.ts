import type { Component } from "svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    author: string;
    date: Date;
    // The post's body, fetched when the post is opened: the list of posts is needed to draw
    // the landing pages' header, and this keeps every post's text out of that download.
    load: () => Promise<{ default: Component }>;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
    trust_and_safety: {
        slug: "trust_and_safety",
        title: "Trust and safety: what is changing and why",
        author: "@julian_jelfs",
        date: new Date(2026, 6, 26),
        load: () => import("./TrustAndSafety.svelte"),
    },
    access_gate_expiry: {
        slug: "access_gate_expiry",
        title: "Access gate expiry",
        author: "@julian_jelfs",
        date: new Date(2024, 9, 23),
        load: () => import("./AccessGateExpiry.svelte"),
    },
    chit: {
        slug: "chit",
        title: "CHIT Rewards",
        author: "@Matt",
        date: new Date(2024, 6, 9),
        load: () => import("./Chit.svelte"),
    },
    signin: {
        slug: "signin",
        title: "Sign-in / sign-up to OpenChat",
        author: "@Matt",
        date: new Date(2024, 4, 29),
        load: () => import("./SignIn.svelte"),
    },
    ic_footprint: {
        slug: "ic_footprint",
        title: "OpenChat tracks carbon-emissions in real-time and commits to net-zero operations",
        author: "@Steffen",
        date: new Date(2024, 3, 22),
        load: () => import("./ICFootprint.svelte"),
    },
    video: {
        slug: "video",
        title: "Video calls released",
        author: "@julian_jelfs",
        date: new Date(2024, 2, 7),
        load: () => import("./VideoCallsReleased.svelte"),
    },
    translations: {
        slug: "translations",
        title: "Translations",
        author: "@julian_jelfs",
        date: new Date(2024, 1, 31),
        load: () => import("./Translation.svelte"),
    },
    communities_released: {
        slug: "communities_released",
        title: "Communities released!",
        author: "@julian_jelfs",
        date: new Date(2023, 6, 31),
        load: () => import("./CommunitiesReleased.svelte"),
    },
    communities: {
        slug: "communities",
        title: "Communities in depth",
        author: "@julian_jelfs",
        date: new Date(2023, 1, 28),
        load: () => import("./Communities.svelte"),
    },
    governance: {
        slug: "governance",
        title: "OpenChat governance",
        author: "@Matt",
        date: new Date(2023, 2, 8),
        load: () => import("./Governance.svelte"),
    },
    website_releases: {
        slug: "website_releases",
        title: "Website releases",
        author: "@Matt",
        date: new Date(2023, 2, 10),
        load: () => import("./WebsiteReleases.svelte"),
    },
};
