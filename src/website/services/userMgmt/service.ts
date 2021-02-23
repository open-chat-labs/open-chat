import registerUser, { RegisterUserResponse } from "./registerUser";
import updateUsername, { UpdateUsernameResponse } from "./updateUsername";
import markAsOnline from "./markAsOnline";
import getCurrentUser, { GetCurrentUserResponse } from "./getCurrentUser";
import getUserId, { GetUserIdResponse } from "./getUserId";
import getUsers, { GetUsersRequest, GetUsersResponse } from "./getUsers";
import searchUsers, { SearchUsersRequest, SearchUsersResponse } from "./searchUsers";
import setProfileImage, { SetProfileImageResponse } from "./setProfileImage";

export default class service {
    public static registerUser(username: string) : Promise<RegisterUserResponse> {
        return registerUser(username);
    }

    public static async updateUsername(username: string) : Promise<UpdateUsernameResponse> {
        return updateUsername(username);
    }

    public static async setProfileImage(imageId: string) : Promise<SetProfileImageResponse> {
        return setProfileImage(imageId);
    }

    public static async markAsOnline() : Promise<void> {
        return markAsOnline();
    }

    public static async getCurrentUser() : Promise<GetCurrentUserResponse> {
        return getCurrentUser();
    }

    public static async getUserId(username: string) : Promise<GetUserIdResponse> {
        return getUserId(username);
    }

    public static async getUsers(request: GetUsersRequest) : Promise<GetUsersResponse> {
        return getUsers(request);
    }

    public static async searchUsers(request: SearchUsersRequest) : Promise<SearchUsersResponse> {
        return searchUsers(request);
    }
}
