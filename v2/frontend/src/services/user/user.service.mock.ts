import type { Principal } from "@dfinity/principal";
import type { UpdateUsernameResponse, GetCurrentUserResponse } from "../../domain/user";
import type { IUserService } from "./user.service.interface";

export class UserServiceMock implements IUserService {
    updateUsername(_userPrincipal: Principal, _username: string): Promise<UpdateUsernameResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("username_taken"), 2000);
        });
    }
    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return Promise.resolve({
            kind: "unknown",
        });
    }
}
