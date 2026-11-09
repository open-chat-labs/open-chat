import type { CommunitySummary, RouteParams } from "@client";
import type { ExploreCommunity } from "@openchat/ui/src/features/components/ExploreCommunities.svelte";
import type { LearnPage } from "@openchat/ui/src/pages/learnContent";
import type { LandingCommunity } from "@openchat/ui/src/pages/types";

// Learn's sub-pages keep the existing marketing paths (ROUTES.md, decision 4)
const LEARN_ROUTES: Partial<Record<RouteParams["kind"], LearnPage>> = {
    roadmap_route: "roadmap",
    whitepaper_route: "whitepaper",
    architecture_route: "architecture",
    blog_route: "blog",
    faq_route: "faq",
};

/** The Learn sub-page (and blog post) a route shows, if it's one of Learn's. */
export function learnPageFor(route: RouteParams): { page: LearnPage; post?: string } | undefined {
    const page = LEARN_ROUTES[route.kind];
    if (page === undefined) return undefined;
    return route.kind === "blog_route" && route.slug ? { page, post: route.slug } : { page };
}

/** The pages with no design of their own: Learn's doc pages outside its tabs (ROUTES.md, decision 5). */
export type DocPage = "terms" | "privacy" | "guidelines" | "csea" | "diamond";

/** The legal docs among them, which are Learn content (`learn/legal`). */
export type LegalDoc = Extract<DocPage, "terms" | "privacy" | "guidelines">;

const DOC_ROUTES: Partial<Record<RouteParams["kind"], DocPage>> = {
    terms_route: "terms",
    privacy_route: "privacy",
    guidelines_route: "guidelines",
    csea_reporting_route: "csea",
    diamond_route: "diamond",
};

/** The doc page a route shows, if it's one of them. */
export function docPageFor(route: RouteParams): DocPage | undefined {
    return DOC_ROUTES[route.kind];
}

const DOC_PATHS: Record<DocPage, string> = {
    terms: "/terms",
    privacy: "/privacy",
    guidelines: "/guidelines",
    csea: "/csea-reporting",
    diamond: "/diamond",
};

/** A doc page's path (utils/routeTable), as a link to one of its sections names it. */
export function docPagePath(page: DocPage): string {
    return DOC_PATHS[page];
}

/** Whether a doc page is a legal doc, loaded from Learn's content. */
export function isLegalDoc(page: DocPage | undefined): page is LegalDoc {
    return page === "terms" || page === "privacy" || page === "guidelines";
}

/**
 * Whether the URL is the page an email sign-in link opens (?auth&m=…&s1=…&s2=…). `?auth` on its
 * own only narrows the sign-in options.
 */
export function isEmailLinkPage(query: URLSearchParams): boolean {
    return query.has("auth") && query.has("m");
}

/** A Learn sub-page's path: /roadmap, /faq … and /blog/<slug> for a post. */
export function learnPath(page: LearnPage, post?: string): string {
    return page === "blog" && post ? `/blog/${encodeURIComponent(post)}` : `/${page}`;
}

/**
 * Landing's featured communities from Explore's cards (`explore.adapter`), so a community shows
 * the same in both: each card opens the community's preview, as Explore's do, calling `onOpen`
 * (with its id) as it's opened, so the preview can come back to Landing.
 */
export function landingCommunities(
    communities: ExploreCommunity[],
    onOpen: (communityId: string) => void,
): LandingCommunity[] {
    return communities.map((c) => ({
        name: c.name,
        about: c.about ?? "",
        members: c.members,
        avatarUrl: c.avatarUrl,
        coverUrl: c.coverUrl,
        href: communityPreviewPath(c.key),
        onOpen: () => onOpen(c.key),
    }));
}

/**
 * The pinned OpenChat community's card, from its summary (it isn't one of Explore's matches),
 * with what Explore's cards take from a match: its banner as the cover, its preview as the link.
 */
export function pinnedLandingCommunity(
    community: CommunitySummary,
    avatarUrl: string,
    onOpen: (communityId: string) => void,
): LandingCommunity {
    return {
        name: community.name,
        about: community.description,
        members: community.memberCount,
        avatarUrl,
        coverUrl: community.banner.blobUrl,
        href: communityPreviewPath(community.id.communityId),
        onOpen: () => onOpen(community.id.communityId),
    };
}

function communityPreviewPath(communityId: string): string {
    return `/community/${communityId}`;
}
