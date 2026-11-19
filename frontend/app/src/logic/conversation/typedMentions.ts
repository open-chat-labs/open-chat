import { mentionsAsTyped, type UserLookup } from "@client";
import { escapeMarkdown } from "@src/core/markdownRender";

/** Where a text's mentions are looked up: the users the app knows, and the user groups. */
export type MentionLookups = {
    /** The users the app knows (allUsersStore). */
    users: Pick<UserLookup, "get">;
    /**
     * The user groups a mention can name: every community's (userGroupSummariesStore), as
     * Markdown looks them up, the open chat's text too (a forwarded message can name another
     * community's group).
     */
    userGroups: { get(id: number): { name: string } | undefined };
};

/**
 * A text shown as it is, not through Markdown (a thread's root, a pinned message, an activity, a
 * forward's preview, a quote), with each mention as the `@name` it was typed as
 * (`mentionsAsTyped`). With `markdown`, for a text that does go through Markdown (a chat list
 * row's preview), the names are escaped (`escapeMarkdown`) so they show as they are, but not in a
 * code span, which shows a name as it is without (and its escapes as written). One whose
 * user or group the app doesn't know (yet) stays as it is: a list built again as the users load
 * shows the name then.
 */
export function typedMentions(
    { users, userGroups }: MentionLookups,
    { markdown = false }: { markdown?: boolean } = {},
): (text: string) => string {
    const typed = (text: string, shown: (name: string) => string) =>
        mentionsAsTyped(
            text,
            (userId) => named(users.get(userId)?.username, shown),
            (id) => named(userGroups.get(id)?.name, shown),
        );
    if (!markdown) return (text) => typed(text, asIs);
    // through Markdown, a name like `_john_` would be read as emphasis; the rest of the text is
    // the message's markdown, left as it is. In a code span nothing is read as formatting and a
    // character reference shows as it is written (`&#95;`), so a name there is left unescaped.
    return (text) =>
        markdownSegments(text)
            .map(({ code, text }) => typed(text, code ? asIs : escapeMarkdown))
            .join("");
}

function asIs(name: string): string {
    return name;
}

function named(name: string | undefined, shown: (name: string) => string): string | undefined {
    return name === undefined ? undefined : shown(name);
}

/**
 * A text split into its inline code spans (`code`) and the rest, as Markdown (marked, CommonMark)
 * reads them: a run of backticks opens a span that the next run of exactly as many closes; one with
 * no such run, or one escaped with a backslash outside a span, is a literal backtick. Joined
 * again, the segments are the text.
 */
export function markdownSegments(text: string): { code: boolean; text: string }[] {
    const segments: { code: boolean; text: string }[] = [];
    const runs = [...text.matchAll(/`+/g)];
    let start = 0; // where the current text segment began
    let i = 0;
    while (i < runs.length) {
        const run = runs[i];
        let at = run.index;
        let length = run[0].length;
        // a backslash escapes the run's first backtick (an odd number of backslashes before it)
        const slashes = /\\*$/.exec(text.slice(start, at))?.[0].length ?? 0;
        if (slashes % 2 === 1) {
            at += 1;
            length -= 1;
            if (length === 0) {
                i += 1;
                continue;
            }
        }
        const close = runs.findIndex((r, j) => j > i && r[0].length === length);
        if (close === -1) {
            i += 1;
            continue;
        }
        const end = runs[close].index + length;
        if (at > start) segments.push({ code: false, text: text.slice(start, at) });
        segments.push({ code: true, text: text.slice(at, end) });
        start = end;
        i = close + 1;
    }
    if (start < text.length) segments.push({ code: false, text: text.slice(start) });
    return segments;
}
