import type { Principal } from "@dfinity/principal";
import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
} from "../../domain/user";
import type { IUserIndexClient } from "./userIndex.client.interface";

export class UserIndexClientMock implements IUserIndexClient {
    private count: number = 0;

    upgradeUser(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 3000);
        });
    }

    setUsername(_username: string): Promise<SetUsernameResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("username_taken"), 2000);
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        if (this.count === 0) {
            this.count += 1;
            return Promise.resolve({
                kind: "created_user",
                userId: {} as Principal,
                username: "julian_jelfs",
                accountBalance: BigInt(10000),
                upgradeRequired: true,
            });
        } else if (this.count === 1) {
            this.count += 1;
            return Promise.resolve({
                kind: "upgrade_in_progress",
            });
        } else {
            return Promise.resolve({
                kind: "created_user",
                userId: {} as Principal,
                username: "julian_jelfs",
                accountBalance: BigInt(10000),
                upgradeRequired: false,
            });
        }
    }

    submitPhoneNumber(
        _countryCode: number,
        _phoneNumber: string
    ): Promise<SubmitPhoneNumberResponse> {
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
            setTimeout(() => resolve("success"), 2000);
        });
    }
}
