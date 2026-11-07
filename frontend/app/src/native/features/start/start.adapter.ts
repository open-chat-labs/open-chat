import { buildUserAvatarUrl, type UserSummary } from "@client";
import { languageFlag } from "@openchat/ui/src/lib/languages";
import type { UsernameStatus } from "@src/logic/profile/usernameCheck.svelte";
import type { FormReferrer } from "@src/logic/auth/signUpForm.svelte";

// The signed-out start's words and rows from the shared state (logic/auth, the app's languages):
// what a screen shows, as i18n keys with their values, so the screens only lay them out.

/** A line under a field: its i18n key and values, and its tone (a hint, good, or a problem). */
export type FieldNote = {
    key: string;
    values?: Record<string, string>;
    tone: "hint" | "ok" | "warn";
};

/** The line under the username: the rules, then whether the name is free. */
export function usernameNote(status: UsernameStatus, username: string): FieldNote {
    switch (status) {
        case "available":
            return { key: "native.start.signUp.available", values: { username }, tone: "ok" };
        case "taken":
            return { key: "native.start.signUp.taken", values: { username }, tone: "warn" };
        case "checking":
            return { key: "native.start.signUp.checking", tone: "hint" };
        case "check_failed":
            return { key: "native.start.signUp.checkFailed", tone: "warn" };
        case "invalid":
            return { key: "native.start.signUp.rules", tone: "warn" };
        case "unchanged":
            return { key: "native.start.signUp.rules", tone: "hint" };
    }
}

/** The line under the recovery email: what it's for, or why it can't be used. */
export function emailNote(email: string, valid: boolean): FieldNote {
    if (!valid) return { key: "native.start.signUp.emailInvalid", tone: "warn" };
    return email.trim().length > 0
        ? { key: "native.start.signUp.emailUsed", tone: "hint" }
        : { key: "native.start.signUp.emailNote", tone: "hint" };
}

/** Link this phone's button: it counts down the characters left, then links. */
export function linkButton(
    code: string,
    length: number,
    busy: boolean,
): { key: string; values?: Record<string, string>; disabled: boolean } {
    if (busy) return { key: "native.start.link.linking", disabled: true };
    if (code.length < length) {
        return {
            key: "native.start.link.more",
            values: { count: String(length - code.length) },
            disabled: true,
        };
    }
    return { key: "native.start.link.linkPhone", disabled: false };
}

/** A person's name as the start shows it: their display name, else their username. */
export function personName(user: Pick<UserSummary, "displayName" | "username">): string {
    return user.displayName ?? user.username;
}

/** A person's photo: theirs, else their identicon (blobUrlPattern is the build's). */
export function personAvatarUrl(
    user: Pick<UserSummary, "userId" | "blobUrl">,
    blobUrlPattern: string,
): string {
    return user.blobUrl ?? buildUserAvatarUrl(blobUrlPattern, user.userId);
}

/** The first word of a person's name ("Lucy" for "Lucy Park"). */
export function firstName(user: Pick<UserSummary, "displayName" | "username">): string {
    return personName(user).trim().split(/\s+/)[0] ?? user.username;
}

/**
 * The referrer's card on Pick a username: who invited you (the link you came in on) or referred
 * you (your pick, which you can take back), and the chat you'll start in.
 */
export function referrerCard(referrer: FormReferrer): {
    title: FieldNote;
    sub: FieldNote;
    removable: boolean;
} {
    const name = personName(referrer.user);
    const byLink = referrer.source === "link";
    return {
        title: {
            key: byLink ? "native.start.signUp.invitedBy" : "native.start.signUp.referredBy",
            values: { name },
            tone: "hint",
        },
        sub: {
            key: "native.start.signUp.firstChat",
            values: { name: firstName(referrer.user) },
            tone: "hint",
        },
        removable: !byLink,
    };
}

/** A piece of a message with links in it: text, or the link named by a placeholder. */
export type MessagePart = { kind: "text"; text: string } | { kind: "link"; name: string };

/**
 * A translated message cut around the links it places ("By continuing you agree to the {terms}
 * and {privacy}"), so each link can be one wherever the translation puts it. `translate` gets the
 * values to put in: a marker per link, which the message is cut at.
 */
export function messageParts(
    translate: (values: Record<string, string>) => string,
    links: readonly string[],
): MessagePart[] {
    const marker = (name: string) => `\u0000${name}\u0000`;
    const text = translate(Object.fromEntries(links.map((name) => [name, marker(name)])));
    return text
        .split("\u0000")
        .map(
            (piece, i): MessagePart =>
                i % 2 === 1 && links.includes(piece)
                    ? { kind: "link", name: piece }
                    : { kind: "text", text: piece },
        )
        .filter((part) => part.kind === "link" || part.text.length > 0);
}

/** A row of the language sheet. */
export type LanguageRow = {
    code: string;
    flag: string;
    /** The language's own name. */
    name: string;
    /** Its English name, when that says something the own name doesn't. */
    english: string | undefined;
    selected: boolean;
};

// the app's older codes for a language (cn, jp, iw) as the standard ones, for the English name
const STANDARD_CODES: Record<string, string> = { cn: "zh", jp: "ja", iw: "he" };

/**
 * The app's languages (i18n's `supportedLanguages`) as the language sheet lists them, those
 * matching `query` (their own name, English name or code), the one in use ticked.
 */
export function languageRows(
    languages: readonly { name: string; code: string }[],
    current: string,
    query: string,
    englishName: (code: string) => string | undefined,
): LanguageRow[] {
    const q = query.trim().toLowerCase();
    return languages
        .map((language) => {
            const english = englishName(STANDARD_CODES[language.code] ?? language.code);
            return {
                code: language.code,
                flag: languageFlag(language.code),
                name: language.name,
                english:
                    english !== undefined && english.toLowerCase() !== language.name.toLowerCase()
                        ? english
                        : undefined,
                selected: language.code === current,
            };
        })
        .filter(
            (row) =>
                q.length === 0 ||
                row.name.toLowerCase().includes(q) ||
                (row.english?.toLowerCase().includes(q) ?? false) ||
                row.code.toLowerCase() === q,
        );
}
