import canister from "ic:canisters/user_mgmt";
import { UserSummary } from "../../domain/model/users";
import { fromCandid as userSummaryFromCandid } from "../candidConverters/userSummary";

export default async function(request: SearchUsersRequest) : Promise<SearchUsersResponse> {
    const canisterRequest = {
        search_term: request.search_term,
        max_results: request.max_results
    };

    const response = await canister.search_users(canisterRequest);

    if (response.hasOwnProperty("Success")) {
        let success: any = response.Success;
        return {
            kind: "success",
            users: success.users.map(userSummaryFromCandid)
        };
    } else {
        throw new Error("Unrecognised 'search_users' response");
    }
}

export type SearchUsersRequest = {
    search_term: string,
    max_results: number
}

export type SearchUsersResponse =
    Success;

export type Success = {
    kind: "success",
    users: UserSummary[]
}
