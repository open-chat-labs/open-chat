import type { SvelteComponent } from "svelte";
// import ResponsiveDesign from "./ResponsiveDesign.svelte";
// import Security from "./Security.svelte";

export type BlogPostInfo = {
    slug: string;
    title: string;
    date: Date;
    component: typeof SvelteComponent;
};

export const postsBySlug: Record<string, BlogPostInfo> = {
    // responsive_design: {
    //     slug: "responsive_design",
    //     title: "The Importance of Responsive Web Design for Your Website",
    //     date: new Date(),
    //     component: ResponsiveDesign,
    // },
    // cyber_security: {
    //     slug: "cyber_security",
    //     title: "Cybersecurity Best Practices: How to Protect Your Business from Cyber Attacks",
    //     date: new Date(),
    //     component: Security,
    // },
};
