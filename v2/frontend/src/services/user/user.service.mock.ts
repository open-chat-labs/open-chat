import type { Principal } from "@dfinity/principal";
import type { CreateUserResponse, GetCurrentUserResponse } from "../../domain/user";
import type { IUserService } from "./user.service.interface";

export class UserServiceMock implements IUserService {
    createUser(
        _userPrincipal: Principal,
        _countryCode: number,
        _phoneNumber: number
    ): Promise<CreateUserResponse> {
        return new Promise((resolve) => {
            setTimeout(
                () =>
                    resolve({
                        kind: "user_exists",
                    }),
                2000
            );
        });
    }
    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return Promise.resolve({
            kind: "unknown",
        });
    }
}
