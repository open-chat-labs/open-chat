import { ONLINE_THRESHOLD } from "../../constants";
import type { UserOrUserGroup } from "./user";
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
