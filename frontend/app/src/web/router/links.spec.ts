import { samePageFragment } from "./links";

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

