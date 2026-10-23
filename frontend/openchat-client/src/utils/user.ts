import type {
    ChatMap,
    DiamondMembershipStatus,
    DirectChatSummary,
    MessageFormatter,
    PublicProfile,
    UserLookup,
    UserSummary,
    ReducedPublicProfile,
} from "@shared";
import { compareChats, i18nKey, isDeletedUser, type ResourceKey } from "@shared";

export function formatLastOnlineDate(
    formatter: MessageFormatter,
    now: number,
    lastOnline: number,
): [string, boolean] {
    const secondsSinceLastOnline = (now - lastOnline) / 1000;

    const minutesSinceLastOnline = Math.floor(secondsSinceLastOnline / 60);

    if (minutesSinceLastOnline < 2) {
        return [formatter("onlineNow"), true];
    }

    let durationText: string;
    if (minutesSinceLastOnline < 60) {
        durationText = formatter("durationMins", {
            values: { duration: minutesSinceLastOnline },
        });
    } else {
        const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
        if (hoursSinceLastOnline === 1) {
            durationText = formatter("oneHour");
        } else if (hoursSinceLastOnline < 24) {
            durationText = formatter("durationHours", {
                values: { duration: hoursSinceLastOnline },
            });
        } else {
            const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
            durationText =
                daysSinceLastOnline === 1
                    ? formatter("oneDay")
                    : formatter("durationDays", { values: { duration: daysSinceLastOnline } });
        }
    }
    return [formatter("lastOnline", { values: { duration: durationText } }), false];
}

export function buildUsernameList(
    formatter: MessageFormatter,
    userIds: Set<string>,
    myUserId: string | undefined,
    users: UserLookup,
    maxUsernames = 99,
): string {
    const includesMe = myUserId !== undefined ? userIds.has(myUserId) : false;

    let usernamesArray = Array.from(userIds)
        .slice(0, maxUsernames * 1.5)
        .map((uid) => [uid, users.get(uid)?.username])
        .filter(([uid, username]) => username !== undefined && uid !== myUserId)
        .map(([_, username]) => username);

    const missing = userIds.size - (usernamesArray.length + (includesMe ? 1 : 0));

    // If there are no usernames missing and we would otherwise say "and 1 more"
    // then just show that last username
    if (missing === 0 && usernamesArray.length === maxUsernames + 1) {
        maxUsernames++;
    }

    usernamesArray = usernamesArray.slice(0, maxUsernames);

    let usernames = usernamesArray.join(", ");

    if (includesMe) {
        usernames += usernames.length === 0 ? formatter("you") : formatter("reactions.andYou");
    }

    const n = userIds.size - (usernamesArray.length + (includesMe ? 1 : 0));

    if (n > 0) {
        usernames += formatter("andNMore", { values: { n } });
    }

    return usernames;
}

export function buildReducedProfileDataList(
    userIds: Set<string>,
    myUserId: string | undefined,
    users: UserLookup,
    maxUsernames = 99,
): ReducedPublicProfile[] {
    return Array.from(userIds)
        .slice(0, maxUsernames * 1.5)
        .map((uid) => {
            const userSummary = users.get(uid);
            if (userSummary && userSummary.kind === "user") {
                return {
                    userId: uid,
                    username: userSummary.username,
                    displayName: userSummary.displayName,
                    isCurentUser: myUserId === uid,
                    blobData: userSummary.blobData,
                    blobUrl: userSummary.blobUrl,
                };
            }
        })
        .filter((reducedProfile) => reducedProfile !== undefined);
}

export function nullUser(username: string): UserSummary {
    return {
        kind: "user",
        userId: "null_user", // this might cause problems if we try to create a Principal from it
        username,
        displayName: undefined,
        updated: BigInt(0),
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
        hideOnlineStatus: false,
    };
}

export function nullProfile(): PublicProfile {
    return {
        username: "",
        displayName: undefined,
        bio: "",
        isPremium: false,
        phoneIsVerified: false,
        created: 0n,
    };
}

export function compareUsername(u1: UserSummary, u2: UserSummary): number {
    return u1.username.localeCompare(u2.username, undefined, { sensitivity: "accent" });
}

export function compareIsNotYouThenUsername(
    yourUserId: string,
): (u1: UserSummary, u2: UserSummary) => number {
    return (u1: UserSummary, u2: UserSummary) => {
        const u1IsYou = u1.userId === yourUserId;
        const u2IsYou = u2.userId === yourUserId;
        if (u1IsYou !== u2IsYou) {
            return u1IsYou ? 1 : -1;
        }
        return compareUsername(u1, u2);
    };
}

// The users you have direct chats with, most recently active chat first. Bots, deleted users and
// users not yet loaded are left out.
export function directChatUsers(
    directChats: ChatMap<DirectChatSummary>,
    users: UserLookup,
): UserSummary[] {
    return [...directChats.values()]
        .sort(compareChats)
        .map((c) => users.get(c.them.userId))
        .filter((u): u is UserSummary => u !== undefined && u.kind !== "bot" && !isDeletedUser(u));
}

// Who the owner of a bot can pass it to: the users they have direct chats with, after themselves,
// so that they can keep it
export function botOwnerCandidates(
    directChats: ChatMap<DirectChatSummary>,
    users: UserLookup,
    ownerId: string,
): UserSummary[] {
    const owner = users.get(ownerId);
    const others = directChatUsers(directChats, users);
    return owner === undefined ? others : [owner, ...others];
}

export function userAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
    return dataContent?.blobUrl ?? "/assets/unknownUserAvatar.svg";
}

export function missingUserIds(
    userLookup: UserLookup,
    webhookUserIds: Set<string>,
    userIds: Iterable<string>,
): string[] {
    const missing: string[] = [];
    for (const userId of userIds) {
        if (!userLookup.has(userId) && !webhookUserIds.has(userId)) {
            missing.push(userId);
        }
    }
    return missing;
}

// Whether to restart the session because the current user's id has changed.
// It's done at most once for each change of id, since the restart relies on the new id having been
// cached, and if that failed, restarting again would only get the old id again, then restart again,
// and so on. It's kept in localStorage because the native app's restart doesn't keep sessionStorage.
export function shouldRestartForNewUserId(previousUserId: string, latestUserId: string): boolean {
    const key = `openchat_restarted_for_new_user_id_${previousUserId}_${latestUserId}`;
    try {
        if (localStorage.getItem(key) !== null) return false;
        localStorage.setItem(key, Date.now().toString());
        return true;
    } catch {
        // Without storage there's nothing to stop a loop, so don't restart
        return false;
    }
}

/** The badges shown beside a user's name. */
export type UserBadges = {
    diamond: DiamondMembershipStatus["kind"] | undefined;
    // undefined when the viewer has turned CHIT off
    chit: { streak: number; earned: number } | undefined;
};

/**
 * A user's badges. There is no verified badge: the unique-person gate and its badge are
 * suspended, whatever the user's `isUniquePerson` says.
 */
export function userBadges(
    user: {
        diamondStatus: DiamondMembershipStatus["kind"] | undefined;
        streak: number;
        chitEarned: number;
    },
    disableChit: boolean,
): UserBadges {
    return {
        diamond: user.diamondStatus,
        chit: disableChit ? undefined : { streak: user.streak, earned: user.chitEarned },
    };
}

/** The message to show once `unsuspendUser` has answered. */
export function unsuspendUserMessage(success: boolean): ResourceKey {
    return i18nKey(success ? "unsuspendedUser" : "failedToUnsuspendUser");
}

/**
 * When someone was last online as text, and whether they're online now; nothing when it isn't
 * known (undefined or 0).
 */
export function lastOnlineStatus(
    formatter: MessageFormatter,
    now: number,
    lastOnline: number | undefined,
): [string, boolean] {
    return lastOnline !== undefined && lastOnline !== 0
        ? formatLastOnlineDate(formatter, now, lastOnline)
        : ["", false];
}
