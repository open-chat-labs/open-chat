import canister from "ic:canisters/user_mgmt";
import { UserId } from "../../model/users";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";

export default async function(username: string) : Promise<GetUserIdResponse> {
    let response = await canister.get_user_id(username);

    if (response.hasOwnProperty("Success")) {
        return {
            kind: "success",
            userId: userIdFromCandid(response.Success)
        };
    } else if (response.hasOwnProperty("UserNotFound")) {
        return {
            kind: "userNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_user_id' response");
    }
}

export type GetUserIdResponse =
    Success |
    UserNotFound;

export type Success = {
    kind: "success",
    userId: UserId
}

export type UserNotFound = {
    kind: "userNotFound"
}
