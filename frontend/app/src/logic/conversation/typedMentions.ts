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
 * row's preview), the names are escaped (`escapeMarkdown`) so they show as they are. One whose
 * user or group the app doesn't know (yet) stays as it is: a list built again as the users load
 * shows the name then.
 */
export function typedMentions(
    { users, userGroups }: MentionLookups,
    { markdown = false }: { markdown?: boolean } = {},
): (text: string) => string {
    // through Markdown, a name like `_john_` would be read as emphasis; the rest of the text is
    // the message's markdown, left as it is
    const shown = markdown ? escapeMarkdown : (name: string) => name;
    const named = (name: string | undefined) => (name === undefined ? undefined : shown(name));
    return (text) =>
        mentionsAsTyped(
            text,
            (userId) => named(users.get(userId)?.username),
            (id) => named(userGroups.get(id)?.name),
        );
}
