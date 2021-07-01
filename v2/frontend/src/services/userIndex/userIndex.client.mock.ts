import type { Principal } from "@dfinity/principal";
import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
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

    requiredUpgradeScenario(): Promise<CurrentUserResponse> {
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

    unknownUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "unknown_user",
        });
    }

    uncomfirmedUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "unconfirmed_user",
            timeUntilResendCodePermitted: BigInt(1000),
            phoneNumber: {
                countryCode: 41,
                number: "7867538921",
            },
        });
    }

    confirmedUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "confirmed_user",
            canisterCreationInProgress: false,
            username: "julian_jelfs",
        });
    }

    confirmedPendingUsernameScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "confirmed_pending_username",
            canisterCreationInProgress: false,
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        // return this.confirmedPendingUsernameScenario();
        // return this.confirmedUserScenario();
        return this.uncomfirmedUserScenario();
        return this.unknownUserScenario();
        return this.requiredUpgradeScenario();
    }

    submitPhoneNumber(_phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
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
