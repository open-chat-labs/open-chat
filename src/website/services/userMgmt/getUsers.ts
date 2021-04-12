import { UserId, UserSummary } from "../../domain/model/users";
import { Option, Timestamp } from "../../domain/model/common";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { fromCandid as userSummaryFromCandid } from "../candidConverters/userSummary";
import CanisterClientFactory from "../CanisterClientFactory";
import { toHttpError, HttpError } from "../../errors/httpError";

export default async function(request: GetUsersRequest) : Promise<GetUsersResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    const canisterRequest = {
        users: request.users.map(userIdToCandid),
        updated_since: optionToCandid(request.updatedSince ? timestampToCandid(request.updatedSince) : null)
    };
    
    let response;    
    try {
        response = await client.get_users(canisterRequest);
    } catch (e) {
        return toHttpError(e as Error);        
    }    

    if ("Success" in response) {
        let success: any = response.Success;
        return {
            kind: "success",
            users: success.users.map(userSummaryFromCandid),
            timestamp: timestampFromCandid(success.timestamp)
        };
    } else {
        throw new Error("Unrecognised 'get_users' response");
    }
}

export type GetUsersRequest = {
    users: UserId[],
    updatedSince: Option<Timestamp>
}

export type GetUsersResponse =
    Success | HttpError;

export type Success = {
    kind: "success",
    users: UserSummary[],
    timestamp: Timestamp
}
