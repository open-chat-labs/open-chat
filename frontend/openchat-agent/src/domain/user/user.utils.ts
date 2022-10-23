import {
    PartialUserSummary,
    PhoneNumber,
    UserLastOnline,
    UserLookup,
    UserStatus,
    UserSummary,
} from "./user";

const ONLINE_THRESHOLD = 120;

export function userAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
    return dataContent?.blobUrl ?? "../assets/unknownUserAvatar.svg";
}

export function groupAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
    return dataContent?.blobUrl ?? "../assets/group.svg";
}

export function phoneNumberToString({ countryCode, number }: PhoneNumber): string {
    return `(+${countryCode}) ${number}`;
}

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

export function compareUsersOnlineFirst(u1: PartialUserSummary, u2: PartialUserSummary): number {
    const now = Date.now();
    const u1Online = userStatus(now, u1) === UserStatus.Online;
    const u2Online = userStatus(now, u2) === UserStatus.Online;

    if (u1Online !== u2Online) {
        return u1Online ? -1 : 1;
    }
    return compareUsername(u1, u2);
}

export function compareUsername(u1: PartialUserSummary, u2: PartialUserSummary): number {
    if (u2.username === undefined) return -1;
    if (u1.username === undefined) return 1;
    return u1.username === u2.username ? 0 : u2.username < u1.username ? 1 : -1;
}

export function compareIsNotYouThenUsername(
    yourUserId: string
): (u1: PartialUserSummary, u2: PartialUserSummary) => number {
    return (u1: PartialUserSummary, u2: PartialUserSummary) => {
        const u1IsYou = u1.userId === yourUserId;
        const u2IsYou = u2.userId === yourUserId;
        if (u1IsYou !== u2IsYou) {
            return u1IsYou ? 1 : -1;
        }
        if (u2.username === undefined) return -1;
        if (u1.username === undefined) return 1;
        return u1.username === u2.username ? 0 : u2.username < u1.username ? 1 : -1;
    };
}

export function nullUser(username: string): UserSummary {
    return {
        kind: "user",
        userId: "null_user", // this might cause problems if we try to create a Principal from it
        username,
        lastOnline: 0,
        updated: BigInt(0),
    };
}

const mentionRegex = /@UserId\(([\d\w-]+)\)/g;

export function extractUserIdsFromMentions(text: string): string[] {
    return [...text.matchAll(mentionRegex)].map((m) => m[1]);
}
