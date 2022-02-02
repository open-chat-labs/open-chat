import { _ } from "svelte-i18n";
import { get } from "svelte/store";
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
    return Array.from(userIds).filter((userId) => userLookup[userId] === undefined);
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

export function formatLastOnlineDate(now: number, user: PartialUserSummary | undefined): string {
    const TWO_MINUTES_MS = 120 * 1000;
    if (user === undefined || now - Number(user.updated) > TWO_MINUTES_MS) {
        return "";
    }

    const secondsSinceLastOnline = (now - user.lastOnline) / 1000;

    const minutesSinceLastOnline = Math.floor(secondsSinceLastOnline / 60);

    if (minutesSinceLastOnline < 2) {
        return get(_)("onlineNow");
    }

    let durationText: string;
    if (minutesSinceLastOnline < 60) {
        durationText = get(_)("durationMins", { values: { duration: minutesSinceLastOnline } });
    } else {
        const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
        if (hoursSinceLastOnline === 1) {
            durationText = get(_)("oneHour");
        } else if (hoursSinceLastOnline < 24) {
            durationText = get(_)("durationHours", {
                values: { duration: hoursSinceLastOnline },
            });
        } else {
            const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
            durationText =
                daysSinceLastOnline === 1
                    ? get(_)("oneDay")
                    : get(_)("durationDays", { values: { duration: daysSinceLastOnline } });
        }
    }
    return get(_)("lastOnline", { values: { duration: durationText } });
}
