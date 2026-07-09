import { describe, expect, test } from "vitest";
import { transformPastedHTML } from "./pasteTransform";

describe("transformPastedHTML", () => {
    test("converts @everyone anchor to plain text and strips wrappers", () => {
        const html = `hello there <strong><a href="https://oc.app/chats/group/2lcnt-ryaaa-aaaaf-aaula-cai?everyone">@everyone</a></strong> how are you?`;
        expect(transformPastedHTML(html)).toBe("hello there @everyone how are you?");
    });

    test("converts underlined @everyone anchor", () => {
        const html = `<u><a href="?everyone">@everyone</a></u>`;
        expect(transformPastedHTML(html)).toBe("@everyone");
    });

    test("converts user group anchor to group_mention span", () => {
        const html = `hi <strong><a href="https://oc.app/community/abc?usergroup=42">@devs</a></strong>`;
        expect(transformPastedHTML(html)).toBe(
            `hi <span data-type="group_mention" groupid="42" groupname="devs">@devs</span>`,
        );
    });

    test("converts profile-link to user_mention span", () => {
        const html = `hey <profile-link text="bob" user-id="abcde-fghij" suppress-links="false">@bob</profile-link>!`;
        expect(transformPastedHTML(html)).toBe(
            `hey <span data-type="user_mention" userid="abcde-fghij" username="bob">@bob</span>!`,
        );
    });

    test("leaves ordinary links alone", () => {
        const html = `see <a href="https://example.com?everyone">@everyone</a> and <a href="https://oc.app/blog">this post</a>`;
        expect(transformPastedHTML(html)).toBe(html);
    });

    test("does not treat lookalike domains as oc.app", () => {
        const html = `<a href="https://eviloc.app?everyone">@everyone</a>`;
        expect(transformPastedHTML(html)).toBe(html);
    });
});
