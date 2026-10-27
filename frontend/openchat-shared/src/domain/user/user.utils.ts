import { ONLINE_THRESHOLD } from "../../constants";
import type { User, UserOrUserGroup } from "./user";
import { UserStatus } from "./user";

export function userStatus(lastOnline: number | undefined, now: number): UserStatus {
    if (lastOnline === undefined || lastOnline === 0) return UserStatus.None;
    const secondsSinceOnline = (now - lastOnline) / 1000;
    return secondsSinceOnline < ONLINE_THRESHOLD ? UserStatus.Online : UserStatus.Offline;
}

// The single source of truth for mention markup. User ids are principals,
// user group ids are numeric. Global flags: only use these with
// replace/matchAll (which reset lastIndex), never exec/test.
export const userIdMentionRegex = /@UserId\(([\d\w-]+)\)/g;
export const userGroupMentionRegex = /@UserGroup\((\d+)\)/g;

export function extractUserIdsFromMentions(text: string): string[] {
    return [...text.matchAll(userIdMentionRegex)].map((m) => m[1]);
}

// A mention typed as @username, not one already in the form above (@UserId(…), @UserGroup(…))
const typedMentionRegex = /@(\w+)\b(?!\()/g;

/** The usernames typed as @username in a message's text. */
export function typedMentions(text: string): string[] {
    return [...text.matchAll(typedMentionRegex)].map(([, username]) => username);
}

/**
 * A message's text as it's sent: each @username typed which can be mentioned becomes the mention
 * (`@UserId(…)`, `@UserGroup(…)`, `@everyone`), and the users mentioned are listed.
 */
export function expandTypedMentions(
    text: string,
    lookup: (username: string) => UserOrUserGroup | undefined,
): { text: string; mentioned: User[] } {
    const mentioned = new Map<string, User>();
    const expanded = text.replace(typedMentionRegex, (match, username: string) => {
        const found = lookup(username);
        if (found === undefined) return match;
        switch (found.kind) {
            case "user_group":
                return `@UserGroup(${found.id})`;
            case "everyone":
                return "@everyone";
            default:
                mentioned.set(found.userId, found);
                return `@UserId(${found.userId})`;
        }
    });
    return { text: expanded, mentioned: [...mentioned.values()] };
}

export function userOrUserGroupName(u: UserOrUserGroup): string {
    switch (u.kind) {
        case "user_group":
            return u.name;
        case "everyone":
            return u.kind;
        default:
            return u.username;
    }
}

export function userOrUserGroupId(u: UserOrUserGroup): string | undefined {
    switch (u.kind) {
        case "user":
        case "bot":
            return u.userId;
        default:
            return undefined;
    }
}
