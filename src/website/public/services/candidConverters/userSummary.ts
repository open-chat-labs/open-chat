import { UserSummary } from "../../model/users";
import { fromCandid as userIdFromCandid } from "./userId";
import * as dateFunctions from "../../utils/dateFunctions";

export function fromCandid(userSummary: any) : UserSummary {
    return {
        userId: userIdFromCandid(userSummary.id),
        username: userSummary.username,
        lastOnline: dateFunctions.addSeconds(new Date(), -userSummary.seconds_since_last_online),
        minutesSinceLastOnline: Math.floor(userSummary.seconds_since_last_online / 60),
        version: userSummary.version
    }
}
