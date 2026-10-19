import type { RouteParams } from "@client";
import type { LearnPage } from "@openchat/ui/src/pages/learnContent";

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
