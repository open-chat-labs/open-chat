import { MyProfile } from "../../domain/model/users";
import { fromCandid as userIdFromCandid } from "./userId";

export function fromCandid(myProfile: any) : MyProfile {
    return {
        userId: userIdFromCandid(myProfile.id),
        username: myProfile.username,
        accountBalance: BigInt(myProfile.account_balance),
        version: myProfile.version
    }
}
