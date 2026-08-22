import { userGroupMentionRegex, userIdMentionRegex } from "@client";
import { marked } from "marked";
import { DOMPurifyDefault, sanitizeOneLine } from "../utils/domPurify";

export type MentionedUser = { id: string; userId: string; username: string };
export type MentionedUserGroup = { id: number; groupId: number; name: string };

export type RenderMarkdownInput = {
    text: string;
    inline: boolean;
    oneLine: boolean;
    suppressLinks: boolean;
    users: MentionedUser[];
    userGroups: MentionedUserGroup[];
};

const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

// Escapes for use in both text and double/single-quoted attribute positions.
export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (c) => htmlEscapes[c]);
}

function uniqueMatches(text: string, regex: RegExp): string[] {
    const ids: string[] = [];
    for (const m of text.matchAll(regex)) {
        if (!ids.includes(m[1])) ids.push(m[1]);
    }
    return ids;
}

export function extractMentionedUserIds(text: string): string[] {
    return uniqueMatches(text, userIdMentionRegex);
}

export function extractMentionedUserGroupIds(text: string): number[] {
    return uniqueMatches(text, userGroupMentionRegex).map(Number);
}

export function sameMentionedUsers(a: MentionedUser[], b: MentionedUser[]): boolean {
    return (
        a.length === b.length &&
        a.every((u, i) => u.id === b[i].id && u.userId === b[i].userId && u.username === b[i].username)
    );
}

export function sameMentionedUserGroups(a: MentionedUserGroup[], b: MentionedUserGroup[]): boolean {
    return (
        a.length === b.length &&
        a.every((g, i) => g.id === b[i].id && g.groupId === b[i].groupId && g.name === b[i].name)
    );
}

export function replaceSpoilers(input: string): string {
    return input.replace(/\|\|([^|]+?)\|\|/g, "<spoiler-span>$1</spoiler-span>");
}

export function replaceCustomEmojis(text: string): string {
    return text.replace(/!emoji\(([^)]+)\)/g, (_, code) => {
        return `<custom-emoji data-id="${code}"></custom-emoji>`;
    });
}

export function replaceUserIds(text: string, users: MentionedUser[], suppressLinks: boolean): string {
    return text.replace(userIdMentionRegex, (match, p1) => {
        const u = users.find((u) => u.id === p1);
        if (u !== undefined) {
            return `<profile-link text="${escapeHtml(u.username)}" user-id="${
                u.userId
            }" suppress-links="${suppressLinks}"></profile-link>`;
        }
        return match;
    });
}

export function replaceUserGroupIds(text: string, userGroups: MentionedUserGroup[]): string {
    return text.replace(userGroupMentionRegex, (match, p1) => {
        const id = Number(p1);
        const u = userGroups.find((g) => g.id === id);
        if (u !== undefined) {
            return `**[@${escapeHtml(u.name)}](?usergroup=${u.groupId})**`;
        } else {
            console.warn("Unable to find user group: ", match);
            return `**@unknown_user_group**`;
        }
    });
}

export function replaceEveryone(text: string): string {
    if (!text.includes("@everyone")) return text;
    return text.replace(/(^|\W)(@everyone)($|\W)/gm, "$1**[$2](?everyone)**$3");
}

// Builds the pre-sanitise string and sanitises it. `text` must already have
// had datetimes and the link-disabled marker handled by the caller. DOMPurify
// runs on every call; nothing here is cached.
export function renderMarkdown(
    { text, inline, oneLine, suppressLinks, users, userGroups }: RenderMarkdownInput,
    logError: (msg: string, err: unknown) => void,
): string {
    let parsed = replaceEveryone(
        // Don't replace UserIds yet - just mark them
        replaceUserGroupIds(text, userGroups),
    );
    try {
        const options = { breaks: !oneLine };
        if (inline) {
            parsed = marked.parseInline(parsed, options) as string;
        } else {
            parsed = marked.parse(parsed, options) as string;
        }

        // replace userIds & emojis *after* markdown parsing so that we can fully disallow html in the markdown source
        parsed = replaceUserIds(parsed, users, suppressLinks);
        parsed = replaceCustomEmojis(parsed);
        parsed = replaceSpoilers(parsed);
    } catch (err) {
        logError("Error parsing markdown: ", err);
    }

    try {
        return oneLine ? sanitizeOneLine(parsed) : DOMPurifyDefault.sanitize(parsed);
    } catch (err) {
        logError("Error sanitizing message content: ", err);
        return "unsafe";
    }
}
