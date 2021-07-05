import type { Principal } from "@dfinity/principal";
import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
} from "../../domain/user";
import type { IUserIndexClient } from "./userIndex.client.interface";

export class UserIndexClientMock implements IUserIndexClient {
    private count = 0;

    createCanister(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 3000);
        });
    }

    upgradeUser(): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => resolve(), 3000);
        });
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("success"), 2000);
        });
    }

    setUsername(_username: string): Promise<SetUsernameResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("username_taken"), 2000);
        });
    }

    normalUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "created_user",
            userId: {} as Principal,
            username: "julian_jelfs",
            accountBalance: BigInt(10000),
            upgradeRequired: false,
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
            return this.normalUserScenario();
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
            phoneNumber: {
                countryCode: 41,
                number: "7867538921",
            },
        });
    }

    confirmedUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "confirmed_user",
            canisterCreationStatus: "in_progress",
            username: "julian_jelfs",
        });
    }

    confirmedPendingUsernameScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "confirmed_pending_username",
            canisterCreationStatus: "created",
        });
    }

    confirmedUserPendingCanister(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "confirmed_user",
            canisterCreationStatus: "pending",
            username: "",
        });
    }

    getCurrentUser(): Promise<CurrentUserResponse> {
        // return this.confirmedPendingUsernameScenario();
        // return this.confirmedUserScenario();
        // return this.uncomfirmedUserScenario();
        // return this.confirmedUserPendingCanister();
        return this.normalUserScenario();
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
