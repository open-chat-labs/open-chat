import type { Principal } from "@dfinity/principal";
import type { UpdateUsernameResponse, GetCurrentUserResponse } from "../../domain/user";

export interface IUserIndexClient {
    getCurrentUser: () => Promise<GetCurrentUserResponse>;
    updateUsername(userPrincipal: Principal, username: string): Promise<UpdateUsernameResponse>;
}
