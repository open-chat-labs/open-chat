import type { Principal } from "@dfinity/principal";
import type {
    UpdateUsernameResponse,
    GetCurrentUserResponse,
    RegisterPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
} from "../../domain/user";
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
    registerPhoneNumber(
        _countryCode: number,
        _phoneNumber: number
    ): Promise<RegisterPhoneNumberResponse> {
        return new Promise((resolve, _reject) => {
            // setTimeout(() => resolve("taken"), 2000);
            // throw new AuthError(401, new Error("looks like an auth error"));
            setTimeout(() => resolve({ kind: "success" }), 2000);
            // setTimeout(() => reject("success"), 2000);
        });
    }

    confirmPhoneNumber(_code: string): Promise<ConfirmPhoneNumberResponse> {
        return new Promise((resolve) => {
            // setTimeout(() => resolve("taken"), 2000);
            setTimeout(
                () =>
                    resolve({
                        kind: "success",
                        canisterId: {} as Principal,
                    }),
                2000
            );
        });
    }
}
