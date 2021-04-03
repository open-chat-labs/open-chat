import CanisterClientFactory from "../CanisterClientFactory";

export default async function(username: string) : Promise<UpdateUsernameResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    const response = await client.update_username(username);

    if ("Success" in response) {
        return UpdateUsernameResponse.Success;
    } else if ("SuccessNoChange" in response) {
        return UpdateUsernameResponse.SuccessNoChange;
    } else if ("UsernameTaken" in response) {
        return UpdateUsernameResponse.UsernameTaken;
    } else if ("UserNotFound" in response) {
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
