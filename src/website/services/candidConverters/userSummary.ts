import { UserSummary } from "../../domain/model/users";
import { fromCandid as userIdFromCandid } from "./userId";
import { fromCandid as optionFromCandid } from "./option";
import * as dateFunctions from "../../utils/dateFunctions";

export function fromCandid(userSummary: any) : UserSummary {
    return {
        userId: userIdFromCandid(userSummary.id),
        username: userSummary.username,
        usernameLower: userSummary.username.toLowerCase(),
        lastOnline: dateFunctions.addSeconds(new Date(), -userSummary.seconds_since_last_online),
        minutesSinceLastOnline: Math.floor(userSummary.seconds_since_last_online / 60),
        imageId: optionFromCandid(userSummary.image_id),
        chatId: userSummary.chat_id,
        version: userSummary.version
    }
}
