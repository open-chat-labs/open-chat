import { MyProfile } from "../../domain/model/users";
import { fromCandid as userIdFromCandid } from "./userId";
import { fromCandid as optionFromCandid } from "./option";

export function fromCandid(myProfile: any) : MyProfile {
    return {
        userId: userIdFromCandid(myProfile.id),
        username: myProfile.username,
        accountBalance: BigInt(myProfile.account_balance),
        imageId: optionFromCandid(myProfile.image_id),
        imageBlobUrl: null,
        version: myProfile.version
    }
}
