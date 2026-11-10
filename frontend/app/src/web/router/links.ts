// Same-page fragment links (#landing-features) are the browser's, not the router's.

/**
 * Whether a link only moves to a fragment of the page it's on (`#landing-features`): the browser
 * scrolls to it, as page.js leaves such links to it, rather than the router.
 */
export function samePageFragment(href: string, current: { href: string }): boolean {
    let to: URL, from: URL;
    try {
        to = new URL(href, current.href);
        from = new URL(current.href);
    } catch {
        return false;
    }
    return (
        to.hash !== "" &&
        to.origin === from.origin &&
        to.pathname === from.pathname &&
        to.search === from.search
    );
}

/**
 * Whether the browser, rather than the router, takes a click on a link: one to a fragment of the
 * page it's on, unless it sits in an editor (the shared handler keeps links there from navigating).
 */
export function leftToBrowser(href: string, inEditor: boolean, current: { href: string }): boolean {
    return !inEditor && samePageFragment(href, current);
}

/** The parts of a route's URL (page.js's context) that say which page and fragment it is. */
export type RouteUrl = { pathname: string; querystring: string; hash: string };

/** A route's page: its path and query, without the fragment. */
export function pageOf(url: RouteUrl): string {
    return url.querystring === "" ? url.pathname : `${url.pathname}?${url.querystring}`;
}

/**
 * Whether a route only moves to a fragment of the page already showing (`previous`, `pageOf` the
 * last route), so it isn't a new route. The browser's fragment navigation (Landing's nav) makes
 * page.js run the routes again, on its popstate; doing so would scroll to the top (and /features to
 * its section), which stops the browser's scroll to the fragment: Safari scrolls before the
 * popstate, so its smooth scroll ends where it started.
 */
export function movesToFragment(previous: string | undefined, url: RouteUrl): boolean {
    return url.hash !== "" && previous === pageOf(url);
}
