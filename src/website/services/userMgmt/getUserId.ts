import { UserId } from "../../domain/model/users";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";

export default async function(username: string) : Promise<GetUserIdResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    const response = await client.get_user_id(username);

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
