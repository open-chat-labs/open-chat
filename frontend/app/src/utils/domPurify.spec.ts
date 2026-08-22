import { describe, expect, test } from "vitest";

import { DOMPurifyDefault, sanitizeOneLine } from "./domPurify";

describe("sanitizeOneLine", () => {
    test("replaces <br> variants with a space", () => {
        expect(sanitizeOneLine("hello<br>world")).toBe("hello world");
        expect(sanitizeOneLine("a<br/>b<br />c")).toBe("a b c");
    });

    test("does not throw on content that previously broke the DOM hook", () => {
        expect(() => sanitizeOneLine("line1<br>line2<br>line3")).not.toThrow();
    });

    test("keeps allowed markup", () => {
        const out = sanitizeOneLine(`<a href="https://oc.app" target="_blank">link</a>`);
        expect(out).toContain('href="https://oc.app"');
        expect(out).toContain("link");
    });

    // Security: one-line sanitisation must be exactly as strong as the default.
    // Its output must equal the default output with only <br> stripped to a
    // space - nothing more is removed, nothing unsafe survives.
    const xssPayloads = [
        `<script>alert(1)</script>`,
        `<img src=x onerror=alert(1)>`,
        `<a href="javascript:alert(1)">x</a>`,
        `<svg><script>alert(1)</script></svg>`,
        `<svg onload=alert(1)></svg>`,
        `<iframe src="javascript:alert(1)"></iframe>`,
        `<div onclick="alert(1)">x</div>`,
        `<br><script>alert(1)</script>`,
        `<math><mtext><script>alert(1)</script></mtext></math>`,
        `<a href="  javascript:alert(1)">x</a>`,
        `<style>*{background:url(javascript:alert(1))}</style>`,
    ];

    test.each(xssPayloads)("neutralises XSS payload: %s", (payload) => {
        const out = sanitizeOneLine(payload).toLowerCase();
        expect(out).not.toContain("<script");
        expect(out).not.toContain("onerror");
        expect(out).not.toContain("onload");
        expect(out).not.toContain("onclick");
        expect(out).not.toContain("javascript:");
    });

    // Concrete expected output pins the security boundary: each payload maps to
    // its exact sanitised form. A refactor that weakened the strip or the config
    // would change one of these strings and fail the test.
    const equivalence: [string, string][] = [
        [`<script>alert(1)</script>`, ``],
        [`<img src=x onerror=alert(1)>`, `<img src="x">`],
        [`<a href="javascript:alert(1)">x</a>`, `<a>x</a>`],
        [`<svg><script>alert(1)</script></svg>`, `<svg></svg>`],
        [`<svg onload=alert(1)></svg>`, `<svg></svg>`],
        [`<iframe src="javascript:alert(1)"></iframe>`, ``],
        [`<div onclick="alert(1)">x</div>`, `<div>x</div>`],
        [`<br><script>alert(1)</script>`, ` `],
        [`<math><mtext><script>alert(1)</script></mtext></math>`, `<math><mtext></mtext></math>`],
        [`<a href="  javascript:alert(1)">x</a>`, `<a>x</a>`],
        [`<style>*{background:url(javascript:alert(1))}</style>`, ``],
    ];

    test.each(equivalence)("sanitises %s to exact expected output", (payload, expected) => {
        expect(sanitizeOneLine(payload)).toBe(expected);
    });
});

// Mention markup as produced by Markdown.svelte. These pin how the
// <profile-link> attributes survive sanitisation, including when the text
// attribute carries escaped / unescaped quotes.
describe("DOMPurifyDefault with mention markup", () => {
    const cases: [string, string][] = [
        [
            `<profile-link text="alice" user-id="u-1" suppress-links="false"></profile-link>`,
            `<profile-link text="alice" user-id="u-1" suppress-links="false"></profile-link>`,
        ],
        // entity-escaped quotes survive as entities; angle brackets are legal
        // inside an attribute value so the serialiser emits them literally
        [
            `<profile-link text="bob &quot;the&quot; &lt;b&gt; &amp; &#39;c&#39;" user-id="u-2" suppress-links="true"></profile-link>`,
            `<profile-link text="bob &quot;the&quot; <b> &amp; 'c'" user-id="u-2" suppress-links="true"></profile-link>`,
        ],
        // a raw quote terminates the attribute; the remainder is dropped
        [
            `<profile-link text="bob "the" onclick="alert(1)" user-id="u-2" suppress-links="false"></profile-link>`,
            `<profile-link text="bob" user-id="u-2" suppress-links="false"></profile-link>`,
        ],
        // disallowed attributes on custom elements are stripped
        [
            `<profile-link text="x" user-id="u" onclick="alert(1)" style="color:red"></profile-link>`,
            `<profile-link text="x" user-id="u"></profile-link>`,
        ],
        [
            `<custom-emoji data-id="abc" onload="alert(1)"></custom-emoji>`,
            `<custom-emoji data-id="abc"></custom-emoji>`,
        ],
        [`<spoiler-span onclick="alert(1)">x</spoiler-span>`, `<spoiler-span>x</spoiler-span>`],
        [
            `<strong><a href="?usergroup=7">@admins &lt;b&gt;"x" &amp; 'y'</a></strong>`,
            `<strong><a href="?usergroup=7">@admins &lt;b&gt;"x" &amp; 'y'</a></strong>`,
        ],
    ];

    test.each(cases)("sanitises %s", (input, expected) => {
        expect(DOMPurifyDefault.sanitize(input)).toBe(expected);
        expect(sanitizeOneLine(input)).toBe(expected);
    });
});
