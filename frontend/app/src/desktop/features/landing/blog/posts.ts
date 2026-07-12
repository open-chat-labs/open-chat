import type { SvelteComponent } from "svelte";
import Communities from "./Communities.svelte";
import CommunitiesReleased from "./CommunitiesReleased.svelte";
import Governance from "./Governance.svelte";
import WebsiteReleases from "./WebsiteReleases.svelte";
import Translation from "./Translation.svelte";
import Video from "./VideoCallsReleased.svelte";
import Chit from "./Chit.svelte";
import ICFootprint from "./ICFootprint.svelte";
import SignIn from "./SignIn.svelte";
import AccessGateExpiry from "./AccessGateExpiry.svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    author: string;
    date: Date;
    component: typeof SvelteComponent<object>;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
    access_gate_expiry: {
        slug: "access_gate_expiry",
        title: "Access gate expiry",
        author: "@julian_jelfs",
        date: new Date(2024, 9, 23),
        component: AccessGateExpiry,
    },
    chit: {
        slug: "chit",
        title: "CHIT Rewards",
        author: "@Matt",
        date: new Date(2024, 6, 9),
        component: Chit,
    },
    signin: {
        slug: "signin",
        title: "Sign-in / sign-up to OpenChat",
        author: "@Matt",
        date: new Date(2024, 4, 29),
        component: SignIn,
    },
    ic_footprint: {
        slug: "ic_footprint",
        title: "OpenChat tracks carbon-emissions in real-time and commits to net-zero operations",
        author: "@Steffen",
        date: new Date(2024, 3, 22),
        component: ICFootprint,
    },
    video: {
        slug: "video",
        title: "Video calls released",
        author: "@julian_jelfs",
        date: new Date(2024, 2, 7),
        component: Video,
    },
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
