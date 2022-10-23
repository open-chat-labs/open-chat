import type { MessageFormatter } from "./i18n";
import type { PartialUserSummary, UserLookup } from "openchat-agent";

export function formatLastOnlineDate(
    formatter: MessageFormatter,
    now: number,
    user: PartialUserSummary | undefined
): string {
    const TWO_MINUTES_MS = 120 * 1000;
    if (user === undefined || now - Number(user.updated) > TWO_MINUTES_MS) {
        return "";
    }

    const secondsSinceLastOnline = (now - user.lastOnline) / 1000;

    const minutesSinceLastOnline = Math.floor(secondsSinceLastOnline / 60);

    if (minutesSinceLastOnline < 2) {
        return formatter("onlineNow");
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
    return formatter("lastOnline", { values: { duration: durationText } });
}

export function buildUsernameList(
    formatter: MessageFormatter,
    userIds: Set<string>,
    myUserId: string | undefined,
    users: UserLookup,
    maxUsernames = 99
): string {
    const includesMe = myUserId !== undefined ? userIds.has(myUserId) : false;

    let usernamesArray = Array.from(userIds)
        .slice(0, maxUsernames * 1.5)
        .map((uid) => [uid, users[uid]?.username])
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
