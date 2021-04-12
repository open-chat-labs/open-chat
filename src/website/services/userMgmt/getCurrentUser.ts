import { MyProfile } from "../../domain/model/users";
import { fromCandid as myProfileFromCandid } from "../candidConverters/myProfile";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";

export default async function() : Promise<GetCurrentUserResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;

    let response;    
    try {
        response = await client.get_current_user();
    } catch (e) {
        return toHttpError(e as Error);        
    }

    if ("Success" in response) {
        const success = response.Success;        
        return {
            kind: "success",
            myProfile: myProfileFromCandid(success)
        };
    } else if ("UserNotFound" in response) {
        return {
            kind: "userNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_current_user' response");
    }
}

export type GetCurrentUserResponse =
    Success |
    UserNotFound |
    HttpError;

export type Success = {
    kind: "success",
    myProfile: MyProfile
}

export type UserNotFound = {
    kind: "userNotFound"
}
