import canister from "ic:canisters/chats";

export default async function(username: string) : Promise<UpdateUsernameResponse> {
    let response = await canister.update_username(username);

    if (response.hasOwnProperty("Success")) {
        return UpdateUsernameResponse.Success;
    } else if (response.hasOwnProperty("SuccessNoChange")) {
        return UpdateUsernameResponse.SuccessNoChange;
    } else if (response.hasOwnProperty("UsernameTaken")) {
        return UpdateUsernameResponse.UsernameTaken;
    } else if (response.hasOwnProperty("UserNotFound")) {
        return UpdateUsernameResponse.UserNotFound;
    } else {
        throw new Error("Unrecognised 'update_username' response");
    }
}

export enum UpdateUsernameResponse {
    Success,
    SuccessNoChange,
    UsernameTaken,
    UserNotFound
}
