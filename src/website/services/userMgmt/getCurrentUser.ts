import canister from "ic:canisters/user_mgmt";
import { UserSummary } from "../../model/users";
import { fromCandid as userSummaryFromCandid } from "../candidConverters/userSummary";

export default async function() : Promise<GetCurrentUserResponse> {
    let response = await canister.get_current_user();

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            userSummary: userSummaryFromCandid(success)
        };
    } else if (response.hasOwnProperty("UserNotFound")) {
        return {
            kind: "userNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_current_user' response");
    }
}

export type GetCurrentUserResponse =
    Success |
    UserNotFound;

export type Success = {
    kind: "success",
    userSummary: UserSummary
}

export type UserNotFound = {
    kind: "userNotFound"
}
