import canister from "ic:canisters/chats";
import {UserSummary} from "../../model/users";

export default async function(username: string) : Promise<RegisterUserResponse> {
    let response = await canister.register_user(username);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            userSummary: {
                userId: success.id,
                username: success.username,
                version: success.version
            }
        };
    } else if (response.hasOwnProperty("UserExists")) {
        return {
            kind: "userExists"
        };
    } else if (response.hasOwnProperty("UsernameTaken")) {
        return {
            kind: "usernameTaken"
        };
    } else {
        throw new Error("Unrecognised 'register_user' response");
    }
}

export type RegisterUserResponse =
    Success |
    UserExists |
    UsernameTaken;

export type Success = {
    kind: "success",
    userSummary: UserSummary
}

export type UserExists = {
    kind: "userExists"
}

export type UsernameTaken = {
    kind: "usernameTaken"
}
