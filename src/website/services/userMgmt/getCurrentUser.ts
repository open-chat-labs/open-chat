import { MyProfile } from "../../domain/model/users";
import { fromCandid as myProfileFromCandid } from "../candidConverters/myProfile";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function() : Promise<GetCurrentUserResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    const response = await client.get_current_user();

    if (response.hasOwnProperty("Success")) {
        const success = response.Success;        
        return {
            kind: "success",
            myProfile: myProfileFromCandid(success)
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
    myProfile: MyProfile
}

export type UserNotFound = {
    kind: "userNotFound"
}
