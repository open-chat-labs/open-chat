import { ONLINE_THRESHOLD } from "../../constants";
import type { UserLookup, UserOrUserGroup } from "./user";
import { UserStatus } from "./user";

export function userStatus(lastOnline: number | undefined, now: number): UserStatus {
    if (lastOnline === undefined || lastOnline === 0) return UserStatus.None;
    const secondsSinceOnline = (now - lastOnline) / 1000;
    return secondsSinceOnline < ONLINE_THRESHOLD ? UserStatus.Online : UserStatus.Offline;
}

export function missingUserIds(userLookup: UserLookup, userIds: Iterable<string>): string[] {
    const missing: string[] = [];
    for (const userId of userIds) {
        if (!userLookup.has(userId)) {
            missing.push(userId);
        }
    }
    return missing;
}

const mentionRegex = /@UserId\(([\d\w-]+)\)/g;

export function extractUserIdsFromMentions(text: string): string[] {
    return [...text.matchAll(mentionRegex)].map((m) => m[1]);
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
