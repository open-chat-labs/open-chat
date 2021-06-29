import type { Principal } from "@dfinity/principal";
import type { UpdateUsernameResponse, GetCurrentUserResponse } from "../../domain/user";
import type { IUserIndexClient } from "./userIndex.client.interface";

export class UserIndexClientMock implements IUserIndexClient {
    updateUsername(_userPrincipal: Principal, _username: string): Promise<UpdateUsernameResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("username_taken"), 2000);
        });
    }
    getCurrentUser(): Promise<GetCurrentUserResponse> {
        return Promise.resolve({
            kind: "success",
            user: {
                userId: {} as Principal,
                username: "julian_jelfs",
                version: 0,
                accountBalance: BigInt(1000000),
            },
        });
    }
}
