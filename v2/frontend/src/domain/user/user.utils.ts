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

export function userStatus(user: UserLastOnline): UserStatus {
    return (user?.secondsSinceLastOnline ?? Number.MAX_VALUE) < ONLINE_THRESHOLD
        ? UserStatus.Online
        : UserStatus.Offline;
}

export function getUserStatus(users: UserLookup, userId: string): UserStatus {
    return userStatus(users[userId]);
}

export function userIsOnline(users: UserLookup, userId: string): boolean {
    return getUserStatus(users, userId) === UserStatus.Online;
}

export function mergeUsers(userLookup: UserLookup, users: PartialUserSummary[]): UserLookup {
    return users.reduce<UserLookup>((lookup, user) => {
        lookup[user.userId] = {
            ...user,
            username: user.username ?? lookup[user.userId]?.username,
        };
        return lookup;
    }, userLookup);
}

export function missingUserIds(userLookup: UserLookup, userIds: Set<string>): string[] {
    return Array.from(userIds).filter((userId) => userLookup[userId] === undefined);
}

export function compareUsersOnlineFirst(u1: PartialUserSummary, u2: PartialUserSummary): number {
    const u1Online = u1.secondsSinceLastOnline < ONLINE_THRESHOLD;
    const u2Online = u2.secondsSinceLastOnline < ONLINE_THRESHOLD;

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
        secondsSinceLastOnline: Number.MAX_VALUE,
    };
}
