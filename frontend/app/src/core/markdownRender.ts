import { formatUsdPrice, userGroupMentionRegex, userIdMentionRegex } from "@client";
import { marked } from "marked";
import { DOMPurifyDefault, sanitizeOneLine } from "@src/utils/domPurify";

export type MentionedUser = { id: string; userId: string; username: string };
export type MentionedUserGroup = { id: number; groupId: number; name: string };
// The token a cashtag stands for: `symbol` as found in the text, in lower case, and the token's own
// symbol, ledger and price in dollars if it's known
export type MentionedToken = {
    symbol: string;
    tokenSymbol: string;
    ledger: string;
    usd: number | undefined;
};

export type RenderMarkdownInput = {
    text: string;
    inline: boolean;
    oneLine: boolean;
    suppressLinks: boolean;
    users: MentionedUser[];
    userGroups: MentionedUserGroup[];
    tokens: MentionedToken[];
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

// A cashtag: $ and a token's symbol, which starts with a letter, so an amount like $5 isn't one, and
// may have dots in it (RICH.OT). Not inside a word or straight after another $, nor followed by more
// of a word. The character before it is captured rather than looked behind at, which older Safaris
// can't parse
const cashtagRegex = /(^|[^\p{L}\p{N}_$])\$([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*)(?![\p{L}\p{N}_$])/gu;

// The symbols the text's cashtags could stand for, in lower case: each cashtag's symbol and, for one
// with dots in it, each shorter one up to a dot, so "$CHAT.Nice" can still be CHAT
export function extractCashtagSymbols(text: string): string[] {
    if (!text.includes("$")) return [];
    const symbols: string[] = [];
    for (const m of text.matchAll(cashtagRegex)) {
        for (const symbol of cashtagSymbols(m[2].toLowerCase())) {
            if (!symbols.includes(symbol)) symbols.push(symbol);
        }
    }
    return symbols;
}

// longest first
function cashtagSymbols(symbol: string): string[] {
    const symbols = [symbol];
    for (let dot = symbol.lastIndexOf("."); dot > 0; dot = symbol.lastIndexOf(".", dot - 1)) {
        symbols.push(symbol.slice(0, dot));
    }
    return symbols;
}

export function sameMentionedTokens(a: MentionedToken[], b: MentionedToken[]): boolean {
    return (
        a.length === b.length &&
        a.every(
            (t, i) =>
                t.symbol === b[i].symbol &&
                t.tokenSymbol === b[i].tokenSymbol &&
                t.ledger === b[i].ledger &&
                t.usd === b[i].usd,
        )
    );
}

// The elements whose text cashtags are left alone in: code, and links, whose text is the link's own
const noCashtagsIn = new Set(["a", "code", "pre"]);

// Replaces the cashtags of known tokens in rendered HTML with <cash-tag>s, leaving any in code or
// links as they are. Unknown symbols stay as text
export function replaceCashtags(
    html: string,
    tokens: MentionedToken[],
    suppressLinks: boolean,
): string {
    if (tokens.length === 0) return html;
    // how many code or link elements the text is inside
    let skipping = 0;
    return html.replace(/<(\/?)([a-zA-Z][\w-]*)[^>]*>|[^<]+/g, (part, closing, tag) => {
        if (tag !== undefined) {
            if (noCashtagsIn.has(tag.toLowerCase())) {
                skipping = Math.max(0, skipping + (closing === "/" ? -1 : 1));
            }
            return part;
        }
        if (skipping > 0) return part;
        return part.replace(cashtagRegex, (match, before: string, symbol: string) => {
            for (const s of cashtagSymbols(symbol)) {
                const token = tokens.find((t) => t.symbol === s.toLowerCase());
                if (token !== undefined) {
                    return `${before}${cashtagElement(token, suppressLinks)}${symbol.slice(s.length)}`;
                }
            }
            return match;
        });
    });
}

function cashtagElement(token: MentionedToken, suppressLinks: boolean): string {
    const price =
        token.usd !== undefined ? ` data-price="${escapeHtml(formatUsdPrice(token.usd))}"` : "";
    return `<cash-tag data-ledger="${escapeHtml(token.ledger)}"${price} suppress-links="${suppressLinks}">$${escapeHtml(
        token.tokenSymbol,
    )}</cash-tag>`;
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
    { text, inline, oneLine, suppressLinks, users, userGroups, tokens }: RenderMarkdownInput,
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
        parsed = replaceCashtags(parsed, tokens, suppressLinks);
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
