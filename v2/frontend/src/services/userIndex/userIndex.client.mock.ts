import type {
    SetUsernameResponse,
    CurrentUserResponse,
    SubmitPhoneNumberResponse,
    ConfirmPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
    UsersResponse,
    UserSummary,
    UpgradeCanisterResponse,
    CreateCanisterResponse,
} from "../../domain/user/user";
import type { IUserIndexClient } from "./userIndex.client.interface";

export const DELAY = 1000;

export class UserIndexClientMock implements IUserIndexClient {
    private count = 0;

    searchUsers(searchTerm: string): Promise<UserSummary[]> {
        return fetch("https://my.api.mockaroo.com/user_search.json?key=02f66dd0")
            .then((res) => res.json() as Promise<UserSummary[]>)
            .then((users) =>
                users.filter((u) => u.username.toLowerCase().indexOf(searchTerm.toLowerCase()) >= 0)
            );
    }

    getUsers(userIds: string[], _since: bigint): Promise<UsersResponse> {
        // this is just to inject a bit of randomness so we can see that the updates flow through the UI ok
        const uppercase = +new Date() % 2 === 0;
        return new Promise((resolve) => {
            setTimeout(
                () =>
                    resolve({
                        timestamp: BigInt(+new Date()),
                        users: userIds.map((u, i) => ({
                            userId: u,
                            username: uppercase ? "JULIAN_JELFS" : "julian_jelfs",
                            secondsSinceLastOnline: 20 * i,
                        })),
                    }),
                DELAY
            );
        });
    }

    createCanister(): Promise<CreateCanisterResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("success"), DELAY);
        });
    }

    upgradeUser(): Promise<UpgradeCanisterResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("success"), DELAY);
        });
    }

    resendRegistrationCode(): Promise<ResendCodeResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("success"), DELAY);
        });
    }

    setUsername(_username: string): Promise<SetUsernameResponse> {
        return new Promise((resolve) => {
            setTimeout(() => resolve("username_taken"), DELAY);
        });
    }

    normalUserScenario(): Promise<CurrentUserResponse> {
        return Promise.resolve({
            kind: "created_user",
            userId: "abcdefg",
            username: "julian_jelfs",
            accountBalance: BigInt(10000),
            canisterUpgradeStatus: "not_required",
        });
    }

    requiredUpgradeScenario(): Promise<CurrentUserResponse> {
        if (this.count === 0) {
            this.count += 1;
            return Promise.resolve({
                kind: "created_user",
                userId: "abcdefg",
                username: "julian_jelfs",
                accountBalance: BigInt(10000),
                canisterUpgradeStatus: "required",
            });
        } else if (this.count === 1) {
            this.count += 1;
            return Promise.resolve({
                kind: "created_user",
                userId: "abcdefg",
                username: "julian_jelfs",
                accountBalance: BigInt(10000),
                canisterUpgradeStatus: "in_progress",
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
        // return this.unknownUserScenario();
        return this.requiredUpgradeScenario();
    }

    submitPhoneNumber(_phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse> {
        return new Promise((resolve, _reject) => {
            // setTimeout(() => resolve("taken"), 2000);
            // throw new AuthError(401, new Error("looks like an auth error"));
            setTimeout(() => resolve({ kind: "success" }), DELAY);
            // setTimeout(() => reject("success"), 2000);
        });
    }

    confirmPhoneNumber(_code: string): Promise<ConfirmPhoneNumberResponse> {
        return new Promise((resolve) => {
            // setTimeout(() => resolve("taken"), 2000);
            setTimeout(() => resolve("success"), DELAY);
        });
    }
}
