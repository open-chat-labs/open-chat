import type { PartialUserSummary, UserSummary } from "../domain/user/user";

export const OPENCHAT_BOT = "zzyk3-openc-hatbo-tq7my-cai";
export const OPENCHAT_BOT_AVATAR = "/oc-logo2.svg";

export function isUserSummary(user: PartialUserSummary): user is UserSummary {
    return user.username !== undefined;
}
