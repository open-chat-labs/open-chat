import { leftToBrowser, movesToFragment, pageOf, samePageFragment } from "./links";

describe("a link to a fragment of the same page", () => {
    const here = { href: "https://oc.app/home?ref=abc" };

    test("is one to the same path and query, with a fragment", () => {
        expect(samePageFragment("https://oc.app/home?ref=abc#landing-features", here)).toBe(true);
        expect(samePageFragment("#landing-features", here)).toBe(true);
    });

    test("isn't one to another page, query or site, or one without a fragment", () => {
        expect(samePageFragment("https://oc.app/roadmap#x", here)).toBe(false);
        expect(samePageFragment("https://oc.app/home#x", here)).toBe(false);
        expect(samePageFragment("https://example.com/home?ref=abc#x", here)).toBe(false);
        expect(samePageFragment("https://oc.app/home?ref=abc", here)).toBe(false);
    });
});

describe("a click the browser takes rather than the router", () => {
    const here = { href: "https://oc.app/home" };

    test("is one on a link to a fragment of the same page", () => {
        expect(leftToBrowser("#landing-features", false, here)).toBe(true);
        expect(leftToBrowser("/roadmap", false, here)).toBe(false);
    });

    test("isn't one in an editor, whose links the shared handler keeps from navigating", () => {
        expect(leftToBrowser("#landing-features", true, here)).toBe(false);
    });
});

describe("a route that only moves to a fragment of the page showing", () => {
    const url = (pathname: string, querystring: string, hash: string) => ({
        pathname,
        querystring,
        hash,
    });

    test("is one to the same path and query, with a fragment", () => {
        expect(movesToFragment("/home", url("/home", "", "landing-features"))).toBe(true);
        expect(movesToFragment("/home?ref=abc", url("/home", "ref=abc", "x"))).toBe(true);
    });

    test("isn't one to another page or query, the first route, or one without a fragment", () => {
        expect(movesToFragment("/home", url("/features", "", "landing-features"))).toBe(false);
        expect(movesToFragment("/home", url("/home", "ref=abc", "x"))).toBe(false);
        expect(movesToFragment(undefined, url("/home", "", "landing-features"))).toBe(false);
        expect(movesToFragment("/home", url("/home", "", ""))).toBe(false);
    });

    test("a page is its path and query", () => {
        expect(pageOf(url("/home", "", "x"))).toBe("/home");
        expect(pageOf(url("/home", "ref=abc", "x"))).toBe("/home?ref=abc");
    });
});
