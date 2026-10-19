import { leftToBrowser, samePageFragment } from "./links";

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

