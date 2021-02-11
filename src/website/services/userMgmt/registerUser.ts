import canister from "ic:canisters/user_mgmt";
import { MyProfile } from "../../domain/model/users";
import { fromCandid as myProfileFromCandid } from "../candidConverters/myProfile";

export default async function(username: string) : Promise<RegisterUserResponse> {
    let response = await canister.register_user(username);

    if (response.hasOwnProperty("Success")) {
        let success = response.Success;
        return {
            kind: "success",
            myProfile: myProfileFromCandid(success)
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
    myProfile: MyProfile
}

export type UserExists = {
    kind: "userExists"
}

export type UsernameTaken = {
    kind: "usernameTaken"
}
