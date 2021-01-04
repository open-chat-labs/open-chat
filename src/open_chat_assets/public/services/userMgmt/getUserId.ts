import canister from "ic:canisters/chats";
import {UserId} from "../../model/users";

export default async function(username: string) : Promise<GetUserIdResponse> {
    let response = await canister.get_user_id(username);

    if (response.hasOwnProperty("Success")) {
        return {
            kind: "success",
            userId: response.Success
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
