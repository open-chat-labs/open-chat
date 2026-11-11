import { mentionsAsTyped, type UserLookup } from "@client";

/** Where a text's mentions are looked up: the users the app knows, and the user groups. */
export type MentionLookups = {
    /** The users the app knows (allUsersStore). */
    users: Pick<UserLookup, "get">;
    /**
     * The user groups a mention can name: the selected community's (selectedCommunityUserGroupsStore)
     * where the text is the open chat's, every community's (userGroupSummariesStore, as Markdown
     * looks them up) where it can be any chat's.
     */
    userGroups: { get(id: number): { name: string } | undefined };
};

/**
 * A text shown as it is, not through Markdown (a chat's latest message, a thread's root, a pinned
 * message, an activity, a forward's preview, a quote), with each mention as the `@name` it was
 * typed as (`mentionsAsTyped`). One whose user or group the app doesn't know (yet) stays as it is:
 * a list built again as the users load shows the name then.
 */
export function typedMentions({ users, userGroups }: MentionLookups): (text: string) => string {
    return (text) =>
        mentionsAsTyped(
            text,
            (userId) => users.get(userId)?.username,
            (id) => userGroups.get(id)?.name,
        );
}
