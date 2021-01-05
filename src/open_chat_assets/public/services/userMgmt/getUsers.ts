import canister from "ic:canisters/user_mgmt";
import {UserId, UserSummary} from "../../model/users";
import {Option} from "../../model/common";
import {convertFromOption} from "../option";

export default async function(users: GetUserRequest[]) : Promise<GetUsersResponse> {
    let request = users.map(u => ({
        id: u.userId,
        cached_version: convertFromOption(u.cachedVersion)
    }));

    let response = await canister.get_users(request);

    if (response.hasOwnProperty("Success")) {
        let success: any[] = response.Success;
        return {
            kind: "success",
            users: success.map(u => ({
                userId: u.id,
                username: u.username,
                version: u.version
            }))
        };
    } else {
        throw new Error("Unrecognised 'get_user_id' response");
    }
}

export type GetUserRequest = {
    userId: UserId,
    cachedVersion: Option<number>
}

export type GetUsersResponse =
    Success;

export type Success = {
    kind: "success",
    users: UserSummary[]
}
