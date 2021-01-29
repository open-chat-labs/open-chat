import { UserSummary } from "../../model/users";
import { fromCandid as userIdFromCandid } from "./userId";
import * as dateFunctions from "../../utils/dateFunctions";

export function fromCandid(userSummary: any) : UserSummary {
    return {
        userId: userIdFromCandid(userSummary.id),
        username: userSummary.username,
        lastOnline: dateFunctions.addMinutes(new Date(), -userSummary.minutes_since_last_online),
        minutesSinceLastOnline: userSummary.minutes_since_last_online,
        version: userSummary.version
    }
}
