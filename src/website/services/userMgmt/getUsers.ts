import canister from "ic:canisters/user_mgmt";
import { UserId, UserSummary } from "../../domain/model/users";
import { Option, Timestamp } from "../../domain/model/common";
import { toCandid as optionToCandid } from "../candidConverters/option";
import { fromCandid as timestampFromCandid, toCandid as timestampToCandid } from "../candidConverters/timestamp";
import { toCandid as userIdToCandid } from "../candidConverters/userId";
import { fromCandid as userSummaryFromCandid } from "../candidConverters/userSummary";

export default async function(request: GetUsersRequest) : Promise<GetUsersResponse> {
    let canisterRequest = {
        users: request.users.map(userIdToCandid),
        updated_since: optionToCandid(request.updatedSince ? timestampToCandid(request.updatedSince) : null)
    };

    let response = await canister.get_users(canisterRequest);

    if (response.hasOwnProperty("Success")) {
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
    Success;

export type Success = {
    kind: "success",
    users: UserSummary[],
    timestamp: Timestamp
}
