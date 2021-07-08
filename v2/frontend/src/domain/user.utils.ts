import { PhoneNumber, UserLookup, UserStatus, UserSummary } from "./user";

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
    return (users[userId]?.secondsSinceLastOnline ?? Number.MAX_VALUE) < 120
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
