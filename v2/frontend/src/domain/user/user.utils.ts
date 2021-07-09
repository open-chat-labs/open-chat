import { PhoneNumber, UserLookup, UserStatus, UserSummary } from "./user";

const ONLINE_THRESHOLD = 120;

export function avatarUrl(userId: string): string {
    // todo - we will use a dummy avatar url for the time being
    return "https://i.pravatar.cc/300";
    const url = new URL(window.location.toString());
    return `${url.protocol}//${userId}${url.host}/avatar`;
}

export function phoneNumberToString({ countryCode, number }: PhoneNumber): string {
    return `(+${countryCode}) ${number}`;
}

export function getUserStatus(users: UserLookup, userId: string): UserStatus {
    return (users[userId]?.secondsSinceLastOnline ?? Number.MAX_VALUE) < ONLINE_THRESHOLD
        ? UserStatus.Online
        : UserStatus.Offline;
}

export function userIsOnline(users: UserLookup, userId: string): boolean {
    return getUserStatus(users, userId) === UserStatus.Online;
}

export function mergeUsers(userLookup: UserLookup, users: UserSummary[]): UserLookup {
    return users.reduce<UserLookup>((lookup, user) => {
        lookup[user.userId] = user;
        return lookup;
    }, userLookup);
}

export function missingUserIds(userLookup: UserLookup, userIds: Set<string>): string[] {
    return Array.from(userIds).filter((userId) => userLookup[userId] === undefined);
}

export function compareUsersOnlineFirst(u1: UserSummary, u2: UserSummary): number {
    const u1Online = u1.secondsSinceLastOnline < ONLINE_THRESHOLD;
    const u2Online = u2.secondsSinceLastOnline < ONLINE_THRESHOLD;

    if (u1Online !== u2Online) {
        return u1Online ? -1 : 1;
    }
    return u1.username < u2.username ? -1 : u1.username > u2.username ? 1 : 0;
}

export function nullUser(username: string): UserSummary {
    return {
        userId: "null_user", // this might cause problems if we try to create a Principal from it
        username,
        secondsSinceLastOnline: Number.MAX_VALUE,
    };
}
