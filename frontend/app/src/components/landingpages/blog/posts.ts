import type { SvelteComponent } from "svelte";
import Communities from "./Communities.svelte";
// import ResponsiveDesign from "./ResponsiveDesign.svelte";
// import Security from "./Security.svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    date: Date;
    component: typeof SvelteComponent;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
    communities: {
        slug: "communities",
        title: "Communities in depth",
        date: new Date(2023, 1, 28),
        component: Communities,
    },
    // cyber_security: {
    //     slug: "cyber_security",
    //     title: "Cybersecurity Best Practices: How to Protect Your Business from Cyber Attacks",
    //     date: new Date(),
    //     component: Security,
    // },
};
