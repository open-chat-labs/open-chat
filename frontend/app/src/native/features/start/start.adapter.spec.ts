import type { UserSummary } from "@client";
import {
    emailNote,
    firstName,
    languageRows,
    linkButton,
    messageParts,
    referrerCard,
    usernameNote,
} from "./start.adapter";

const lucy = {
    userId: "r1",
    username: "lucy",
    displayName: "Lucy Park",
    kind: "user",
    suspended: false,
} as UserSummary;

describe("the start's field notes", () => {
    test("the username says the rules until it's checked, then whether it's free", () => {
        expect(usernameNote("unchanged", "")).toEqual({
            key: "native.start.signUp.rules",
            tone: "hint",
        });
        expect(usernameNote("invalid", "ab")).toMatchObject({ tone: "warn" });
        expect(usernameNote("available", "newperson")).toEqual({
            key: "native.start.signUp.available",
            values: { username: "newperson" },
            tone: "ok",
        });
        expect(usernameNote("taken", "lucy")).toMatchObject({
            key: "native.start.signUp.taken",
            tone: "warn",
        });
    });

    test("the recovery email says what it's for, or that it isn't one", () => {
        expect(emailNote("", true).key).toBe("native.start.signUp.emailNote");
        expect(emailNote("me@example.com", true).key).toBe("native.start.signUp.emailUsed");
        expect(emailNote("me@", false)).toMatchObject({ tone: "warn" });
    });
});

describe("Link this phone", () => {
    test("counts down the characters left, then links", () => {
        expect(linkButton("", 6, false)).toEqual({
            key: "native.start.link.more",
            values: { count: "6" },
            disabled: true,
        });
        expect(linkButton("K7Q2X", 6, false).values).toEqual({ count: "1" });
        expect(linkButton("K7Q2XM", 6, false)).toEqual({
            key: "native.start.link.linkPhone",
            disabled: false,
        });
        expect(linkButton("K7Q2XM", 6, true)).toEqual({
            key: "native.start.link.linking",
            disabled: true,
        });
    });
});

describe("the referrer's card", () => {
    test("the link you came in on invited you, and can't be taken back", () => {
        const card = referrerCard({ user: lucy, source: "link" });
        expect(card.title).toMatchObject({
            key: "native.start.signUp.invitedBy",
            values: { name: "Lucy Park" },
        });
        expect(card.sub.values).toEqual({ name: "Lucy" });
        expect(card.removable).toBe(false);
    });

    test("someone you picked referred you, and can be taken back", () => {
        const card = referrerCard({ user: lucy, source: "qr" });
        expect(card.title.key).toBe("native.start.signUp.referredBy");
        expect(card.removable).toBe(true);
    });

    test("a name is the display name's first word, else the username", () => {
        expect(firstName(lucy)).toBe("Lucy");
        expect(firstName({ username: "hamish", displayName: undefined })).toBe("hamish");
    });
});

describe("a message with links in it", () => {
    test("is cut around the links, wherever the translation puts them", () => {
        const english = (v: Record<string, string>) =>
            `By continuing you agree to the ${v.terms} and ${v.privacy}`;
        expect(messageParts(english, ["terms", "privacy"])).toEqual([
            { kind: "text", text: "By continuing you agree to the " },
            { kind: "link", name: "terms" },
            { kind: "text", text: " and " },
            { kind: "link", name: "privacy" },
        ]);
        const other = (v: Record<string, string>) => `${v.privacy} · ${v.terms}`;
        expect(messageParts(other, ["terms", "privacy"]).map((p) => p.kind)).toEqual([
            "link",
            "text",
            "link",
        ]);
    });
});

describe("the language sheet", () => {
    const languages = [
        { name: "English", code: "en" },
        { name: "Français", code: "fr" },
        { name: "中文", code: "cn" },
    ];
    const english = (code: string) =>
        ({ en: "English", fr: "French", zh: "Chinese" })[code] ?? undefined;

    test("lists the languages with their flags, the one in use ticked", () => {
        const rows = languageRows(languages, "fr", "", english);
        expect(rows.map((r) => [r.code, r.english, r.selected])).toEqual([
            ["en", undefined, false],
            ["fr", "French", true],
            ["cn", "Chinese", false],
        ]);
        expect(rows[1].flag).toBe("🇫🇷");
        expect(rows[2].flag).toBe("🇨🇳");
    });

    test("finds a language by its own name, its English name or its code", () => {
        expect(languageRows(languages, "en", "fran", english).map((r) => r.code)).toEqual(["fr"]);
        expect(languageRows(languages, "en", "chin", english).map((r) => r.code)).toEqual(["cn"]);
        expect(languageRows(languages, "en", "CN", english).map((r) => r.code)).toEqual(["cn"]);
    });
});
