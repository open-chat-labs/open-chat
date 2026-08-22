import { describe, expect, test, vi } from "vitest";
import {
    escapeHtml,
    extractMentionedUserGroupIds,
    extractMentionedUserIds,
    renderMarkdown,
    replaceUserGroupIds,
    replaceUserIds,
    sameMentionedUserGroups,
    sameMentionedUsers,
    type MentionedUser,
    type MentionedUserGroup,
    type RenderMarkdownInput,
} from "./markdownRender";

const noop = () => {};

const users: MentionedUser[] = [
    { id: "abc-1", userId: "abc-1", username: "alice" },
    { id: "def-2", userId: "def-2", username: `bob "the" <builder> & 'co'` },
];
const groups: MentionedUserGroup[] = [
    { id: 7, groupId: 7, name: "admins" },
    { id: 8, groupId: 8, name: `mods <b>"x"</b> & 'y'` },
];

function input(text: string, extra: Partial<RenderMarkdownInput> = {}): RenderMarkdownInput {
    return {
        text,
        inline: true,
        oneLine: false,
        suppressLinks: false,
        users,
        userGroups: groups,
        ...extra,
    };
}

describe("escapeHtml", () => {
    test("escapes & < > \" '", () => {
        expect(escapeHtml(`a & b < c > d "e" 'f'`)).toBe(
            `a &amp; b &lt; c &gt; d &quot;e&quot; &#39;f&#39;`,
        );
    });

    test("matches the DOM serialiser for & < > in text position", () => {
        const div = document.createElement("div");
        for (const s of ["a & b", "<x>", "a<b>c&d", "plain_name-1"]) {
            div.textContent = s;
            expect(escapeHtml(s)).toBe(div.innerHTML);
        }
    });

    test("leaves plain text untouched", () => {
        expect(escapeHtml("alice_bob-1")).toBe("alice_bob-1");
    });

    test("escapes every occurrence", () => {
        expect(escapeHtml("<<>>&&")).toBe("&lt;&lt;&gt;&gt;&amp;&amp;");
    });

    test("is idempotent on already escaped text only via double escaping", () => {
        expect(escapeHtml("&amp;")).toBe("&amp;amp;");
    });
});

describe("mention extraction", () => {
    test("no mentions -> empty", () => {
        expect(extractMentionedUserIds("hello @everyone")).toEqual([]);
        expect(extractMentionedUserGroupIds("hello @UserId(abc)")).toEqual([]);
    });

    test("unique ids in order of first appearance", () => {
        expect(extractMentionedUserIds("@UserId(b-1) hi @UserId(a-2) @UserId(b-1)")).toEqual([
            "b-1",
            "a-2",
        ]);
        expect(extractMentionedUserGroupIds("@UserGroup(9) @UserGroup(3) @UserGroup(9)")).toEqual(
            [9, 3],
        );
    });

    test("does not leave the shared global regex in a stale state", () => {
        // the regexes are /g; matchAll must not depend on lastIndex
        expect(extractMentionedUserIds("@UserId(x)")).toEqual(["x"]);
        expect(extractMentionedUserIds("@UserId(x)")).toEqual(["x"]);
    });
});

describe("same* comparators", () => {
    test("equal by value", () => {
        expect(sameMentionedUsers(users, users.map((u) => ({ ...u })))).toBe(true);
        expect(sameMentionedUserGroups(groups, groups.map((g) => ({ ...g })))).toBe(true);
    });
    test("differ on name, length or order", () => {
        expect(sameMentionedUsers(users, [users[0], { ...users[1], username: "z" }])).toBe(false);
        expect(sameMentionedUsers(users, [users[0]])).toBe(false);
        expect(sameMentionedUsers(users, [users[1], users[0]])).toBe(false);
        expect(sameMentionedUserGroups(groups, [groups[0], { ...groups[1], name: "z" }])).toBe(
            false,
        );
    });
});

describe("replaceUserIds / replaceUserGroupIds", () => {
    test("unknown user mention is left as-is", () => {
        expect(replaceUserIds("hi @UserId(zzz)", users, false)).toBe("hi @UserId(zzz)");
    });

    test("known user becomes profile-link with escaped text", () => {
        expect(replaceUserIds("hi @UserId(abc-1)", users, true)).toBe(
            `hi <profile-link text="alice" user-id="abc-1" suppress-links="true"></profile-link>`,
        );
    });

    test("unknown user group becomes @unknown_user_group", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(noop);
        expect(replaceUserGroupIds("@UserGroup(99)", groups)).toBe("**@unknown_user_group**");
        warn.mockRestore();
    });

    test("known user group becomes bold link", () => {
        expect(replaceUserGroupIds("@UserGroup(7)", groups)).toBe("**[@admins](?usergroup=7)**");
    });
});

describe("renderMarkdown (full parse + sanitise pipeline)", () => {
    test("plain markdown, inline", () => {
        expect(renderMarkdown(input("**bold** _it_"), noop)).toBe(
            "<strong>bold</strong> <em>it</em>",
        );
    });

    test("block mode wraps in <p>", () => {
        expect(renderMarkdown(input("hello", { inline: false }), noop)).toBe("<p>hello</p>\n");
    });

    test("oneLine collapses <br>", () => {
        expect(renderMarkdown(input("a\nb", { oneLine: true }), noop)).toBe("a\nb");
        expect(renderMarkdown(input("a\nb"), noop)).toBe("a<br>b");
    });

    test("raw html in the source is neutralised", () => {
        const out = renderMarkdown(input(`<img src=x onerror=alert(1)> @UserId(abc-1)`), noop);
        expect(out).not.toContain("onerror");
        expect(out).toContain(`<profile-link`);
    });

    // Pins the exact sanitised HTML for a mention-bearing message so that any
    // change to the pre-sanitise string builder (e.g. the escaper) is visible.
    test("snapshot: mention-bearing message (plain names)", () => {
        const out = renderMarkdown(
            input("hey @UserId(abc-1) see @UserGroup(7) @everyone", {
                users: [users[0]],
                userGroups: [groups[0]],
            }),
            noop,
        );
        expect(out).toMatchInlineSnapshot(
            `"hey <profile-link text="alice" user-id="abc-1" suppress-links="false"></profile-link> see <strong><a href="?usergroup=7">@admins</a></strong> <strong><a href="?everyone">@everyone</a></strong>"`,
        );
    });

    // Names containing quotes: with the div-based escaper the unescaped `"`
    // terminated the text attribute early and the parser dropped the
    // remainder (text="bob"). With quotes escaped the whole name survives as
    // the attribute value. Real usernames cannot contain these characters so
    // this only affects pathological input. Angle brackets are legal inside an
    // attribute value so the serialiser emits them literally.
    test("snapshot: mention-bearing message (names with quotes/angles/ampersands)", () => {
        const out = renderMarkdown(input("hey @UserId(def-2) see @UserGroup(8)"), noop);
        expect(out).toMatchInlineSnapshot(
            `"hey <profile-link text="bob &quot;the&quot; <builder> &amp; 'co'" user-id="def-2" suppress-links="false"></profile-link> see <strong><a href="?usergroup=8">@mods &lt;b&gt;"x"&lt;/b&gt; &amp; 'y'</a></strong>"`,
        );
    });

    test("snapshot: spoilers and custom emoji", () => {
        expect(renderMarkdown(input("||secret|| !emoji(abc)"), noop)).toMatchInlineSnapshot(
            `"<spoiler-span>secret</spoiler-span> <custom-emoji data-id="abc"></custom-emoji>"`,
        );
    });

    test("sanitise runs on every call (no caching)", () => {
        const a = renderMarkdown(input("@UserId(abc-1)"), noop);
        const b = renderMarkdown(input("@UserId(abc-1)", { users: [] }), noop);
        expect(a).toContain("profile-link");
        expect(b).toBe("@UserId(abc-1)");
    });
});
