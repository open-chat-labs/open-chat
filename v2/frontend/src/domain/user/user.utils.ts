import {
    PartialUserSummary,
    PhoneNumber,
    UserLastOnline,
    UserLookup,
    UserStatus,
    UserSummary,
} from "./user";

const ONLINE_THRESHOLD = 120;

export function avatarUrl<T extends { blobUrl?: string }>(
    dataContent?: T,
    fallback = "../assets/unknownUserAvatar.svg"
): string {
    return dataContent?.blobUrl ?? fallback;
}

export function phoneNumberToString({ countryCode, number }: PhoneNumber): string {
    return `(+${countryCode}) ${number}`;
}

export function userStatus(user?: UserLastOnline): UserStatus {
    if (user === undefined) return UserStatus.Offline;
    const secondsSinceOnline = (Date.now() - user.lastOnline) / 1000;
    return secondsSinceOnline < ONLINE_THRESHOLD ? UserStatus.Online : UserStatus.Offline;
}

export function getUserStatus(users: UserLookup, userId: string): UserStatus {
    return userStatus(users[userId]);
}

export function userIsOnline(users: UserLookup, userId: string): boolean {
    return getUserStatus(users, userId) === UserStatus.Online;
}

export function missingUserIds(userLookup: UserLookup, userIds: Set<string>): string[] {
    return Array.from(userIds).filter((userId) => userLookup[userId] === undefined);
}

export function compareUsersOnlineFirst(u1: PartialUserSummary, u2: PartialUserSummary): number {
    const u1Online = userStatus(u1) === UserStatus.Online;
    const u2Online = userStatus(u2) === UserStatus.Online;

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

export function nullUser(username: string): UserSummary {
    return {
        userId: "null_user", // this might cause problems if we try to create a Principal from it
        username,
        lastOnline: 0,
    };
}
