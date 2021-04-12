import { UserId } from "../../domain/model/users";
import { fromCandid as userIdFromCandid } from "../candidConverters/userId";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";

export default async function(username: string) : Promise<GetUserIdResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;

    let response;    
    try {
        response = await client.get_user_id(username);
    } catch (e) {
        return toHttpError(e as Error);        
    }

    if ("Success" in response) {
        return {
            kind: "success",
            userId: userIdFromCandid(response.Success)
        };
    } else if ("UserNotFound" in response) {
        return {
            kind: "userNotFound"
        };
    } else {
        throw new Error("Unrecognised 'get_user_id' response");
    }
}

export type GetUserIdResponse =
    Success |
    UserNotFound |
    HttpError;

export type Success = {
    kind: "success",
    userId: UserId
}

export type UserNotFound = {
    kind: "userNotFound"
}
