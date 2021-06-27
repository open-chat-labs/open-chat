import type { Principal } from "@dfinity/principal";
import type { CreateUserResponse, GetCurrentUserResponse } from "../../domain/user";

export interface IUserService {
    getCurrentUser: () => Promise<GetCurrentUserResponse>;
    createUser(
        userPrincipal: Principal,
        countryCode: number,
        phoneNumber: number
    ): Promise<CreateUserResponse>;
}
