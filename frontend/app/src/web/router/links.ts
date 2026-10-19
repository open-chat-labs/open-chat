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
