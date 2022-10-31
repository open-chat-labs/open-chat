import { ONLINE_THRESHOLD } from "../../constants";
import { UserLastOnline, UserLookup, UserStatus } from "./user";

export function userStatus(now: number, user?: UserLastOnline): UserStatus {
    if (user === undefined) return UserStatus.Offline;
    const secondsSinceOnline = (now - user.lastOnline) / 1000;
    return secondsSinceOnline < ONLINE_THRESHOLD ? UserStatus.Online : UserStatus.Offline;
}

export function getUserStatus(now: number, users: UserLookup, userId: string): UserStatus {
    return userStatus(now, users[userId]);
}

export function userIsOnline(now: number, users: UserLookup, userId: string): boolean {
    return getUserStatus(now, users, userId) === UserStatus.Online;
}

export function missingUserIds(userLookup: UserLookup, userIds: Set<string>): string[] {
    const missing: string[] = [];
    userIds.forEach((u) => {
        if (userLookup[u] === undefined) {
            missing.push(u);
        }
    });
    return missing;
}

const mentionRegex = /@UserId\(([\d\w-]+)\)/g;

export function extractUserIdsFromMentions(text: string): string[] {
    return [...text.matchAll(mentionRegex)].map((m) => m[1]);
}
