import type { PartialUserSummary, UserSummary } from "../domain/user/user";

export function isUserSummary(user: PartialUserSummary): user is UserSummary {
    return user.username !== undefined;
}
