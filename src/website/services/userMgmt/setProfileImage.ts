import CanisterClientFactory from "../CanisterClientFactory";

export default async function(imageId: string) : Promise<SetProfileImageResponse> {
    const client = CanisterClientFactory.current!.userMgmtClient;
    const response = await client.set_profile_image(imageId);

    if (response.hasOwnProperty("Success")) {
        return SetProfileImageResponse.Success;
    } else if (response.hasOwnProperty("UserNotFound")) {
        return SetProfileImageResponse.UserNotFound;
    } else {
        throw new Error("Unrecognised 'set_profile_image' response");
    }
}

export enum SetProfileImageResponse {
    Success,
    UserNotFound
}
