import { MyProfile } from "../../domain/model/users";
import { fromCandid as myProfileFromCandid } from "../candidConverters/myProfile";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";

export default async function(username: string) : Promise<RegisterUserResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;

    let response;    
    try {
        response = await client.register_user(username);
    } catch (e) {
        return toHttpError(e as Error);        
    }    

    if ("Success" in response) {
        let success = response.Success;
        return {
            kind: "success",
            myProfile: myProfileFromCandid(success)
        };
    } else if ("UserExists" in response) {
        return {
            kind: "userExists"
        };
    } else if ("UsernameTaken" in response) {
        return {
            kind: "usernameTaken"
        };
    } else if ("UserLimitReached" in response) {
        const userLimit = response.UserLimitReached;
        return {
            kind: "userLimitReached",
            userLimit
        };
    } else {
        throw new Error("Unrecognised 'register_user' response");
    }
}

export type RegisterUserResponse =
    Success |
    UserExists |
    UsernameTaken |
    UserLimitReached |
    HttpError;

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

export type UserLimitReached = {
    kind: "userLimitReached",
    userLimit: bigint
}
