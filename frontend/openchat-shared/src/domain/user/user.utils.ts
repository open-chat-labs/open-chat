import { ONLINE_THRESHOLD } from "../../constants";
import type { UserLookup } from "./user";
import { UserStatus } from "./user";

export function userStatus(lastOnline: number | undefined, now: number): UserStatus {
    if (lastOnline === undefined) return UserStatus.None;
    const secondsSinceOnline = (now - lastOnline) / 1000;
    return secondsSinceOnline < ONLINE_THRESHOLD ? UserStatus.Online : UserStatus.Offline;
}

export function missingUserIds(userLookup: UserLookup, userIds: Iterable<string>): string[] {
    const missing: string[] = [];
    for (const userId of userIds) {
        if (userLookup[userId] === undefined) {
            missing.push(userId);
        }
    }
    return missing;
}

const mentionRegex = /@UserId\(([\d\w-]+)\)/g;

export function extractUserIdsFromMentions(text: string): string[] {
    return [...text.matchAll(mentionRegex)].map((m) => m[1]);
}
