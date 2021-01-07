import registerUser, { RegisterUserResponse } from "./registerUser";
import updateUsername, { UpdateUsernameResponse } from "./updateUsername";
import getCurrentUser, { GetCurrentUserResponse } from "./getCurrentUser";
import getUserId, {GetUserIdResponse} from "./getUserId";
import getUsers, {GetUserRequest, GetUsersResponse} from "./getUsers";

export default class service {
    public static registerUser(username: string) : Promise<RegisterUserResponse> {
        return registerUser(username);
    }

    public static async updateUsername(username: string) : Promise<UpdateUsernameResponse> {
        return updateUsername(username);
    }

    public static async getCurrentUser() : Promise<GetCurrentUserResponse> {
        return getCurrentUser();
    }

    public static async getUserId(username: string) : Promise<GetUserIdResponse> {
        return getUserId(username);
    }

    public static async getUsers(users: GetUserRequest[]) : Promise<GetUsersResponse> {
        return getUsers(users);
    }
}
