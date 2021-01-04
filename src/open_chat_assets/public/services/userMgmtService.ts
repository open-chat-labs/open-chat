import service from "ic:canisters/user_mgmt";
import { Option } from "../model/common";
import { UserId, UserSummary } from "../model/users";

export default class userMgmtService {
    public static async registerUser(username: string) : Promise<RegisterUserResult> {
        let response = await service.register_user(username);

        if (response.hasOwnProperty("Success")) {
            return {
                kind: "success",
                userId: response.Success.id,
                username: response.Success.username
            };
        } else if (response.hasOwnProperty("UserExists")) {
            return {
                kind: "userExists"
            };
        } else if (response.hasOwnProperty("UsernameTaken")) {
            return {
                kind: "usernameTaken"
            };
        } else {
            throw new Error("Unrecognised 'register_user' response");
        }
    }

    public static async updateUsername(username: string) : Promise<UpdateUsernameResult> {
        let response = await service.update_username(username);

        if (response.hasOwnProperty("Success")) {
            return UpdateUsernameResult.Success;
        } else if (response.hasOwnProperty("SuccessNoChange")) {
            return UpdateUsernameResult.SuccessNoChange;
        } else if (response.hasOwnProperty("UsernameTaken")) {
            return UpdateUsernameResult.UsernameTaken;
        } else if (response.hasOwnProperty("UserNotFound")) {
            return UpdateUsernameResult.UserNotFound;
        } else {
            throw new Error("Unrecognised 'update_username' response");
        }
    }

    public static async getCurrentUser() : Promise<Option<UserSummary>> {
        let response: any[] = await service.get_current_user();
        return this.convertToOption(response.map(u => ({ userId: u.id, username: u.username })));
    }

    public static async getUserId(username: string) : Promise<Option<UserId>> {
        let response : UserId[] = await service.get_user_id(username);
        return this.convertToOption(response);
    }

    public static async getUsers(users: GetUserRequest[]) : Promise<UserSummary[]> {
        let request = users.map(u => ({
            id: u.userId,
            cached_version: userMgmtService.convertFromOption(u.cachedVersion)
        }));

        let response : any[] = await service.get_users(request);

        return response.map(u => ({
            userId: u.id,
            username: u.username
        }));
    }

    static convertToOption<T>(value: T[]) : Option<T> {
        return Array.isArray(value) && value.length
            ? value[0]
            : null;
    }

    static convertFromOption<T>(value: Option<T>) : T[] {
        return value ? [value] : [];
    }
}

export type GetUserRequest = {
    userId: UserId,
    cachedVersion: Option<number>
}

export type RegisterUserResult =
    RegisterUserResult_Success |
    RegisterUserResult_UserExists |
    RegisterUserResult_UsernameTaken;

export type RegisterUserResult_Success = {
    kind: "success",
    userId: UserId,
    username: string
}

export type RegisterUserResult_UserExists = {
    kind: "userExists"
}

export type RegisterUserResult_UsernameTaken = {
    kind: "usernameTaken"
}

export enum UpdateUsernameResult {
    Success,
    SuccessNoChange,
    UsernameTaken,
    UserNotFound
}
