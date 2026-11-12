import type { MessageContent, UserSummary } from "@client";
import { describe, expect, test } from "vitest";
import { copyableMessageText, type CopyableTextLookups } from "./copyableMessageText";

describe("copyableMessageText", () => {
    const lookups: CopyableTextLookups = {
        formatter: (key) => key,
        cryptoLookup: new Map(),
        users: new Map([["a1", { userId: "a1", username: "alice" } as UserSummary]]),
        userGroups: new Map([[7, { name: "mods" }]]),
    };

    test("a text copies with its mentions as typed", () => {
        const content: MessageContent = {
            kind: "text_content",
            text: "hi @UserId(a1), ask @UserGroup(7)",
        };
        expect(copyableMessageText(content, lookups)).toBe("hi @alice, ask @mods");
    });

    test("a caption's mentions are typed too, after what the content is", () => {
        const content: MessageContent = {
            kind: "file_content",
            name: "notes.pdf",
            mimeType: "application/pdf",
            fileSize: 1,
            caption: "for @UserId(a1)",
        };
        expect(copyableMessageText(content, lookups)).toBe("notes.pdf - for @alice");
    });

    test("a mention whose user or group isn't loaded stays as stored", () => {
        const content: MessageContent = {
            kind: "text_content",
            text: "@UserId(zz) and @UserGroup(8), @everyone",
        };
        expect(copyableMessageText(content, lookups)).toBe(
            "@UserId(zz) and @UserGroup(8), @everyone",
        );
    });
});
