var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Principal } from "@dfinity/principal";
import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { checkUsernameResponse, setUsernameResponse, createChallengeResponse, currentUserResponse, submitPhoneNumberResponse, confirmPhoneNumber, resendCodeResponse, usersResponse, userSearchResponse, registerUserResponse, upgradeStorageResponse, } from "./mappers";
import { CachingUserIndexClient } from "./userIndex.caching.client";
import { cachingLocallyDisabled } from "../../utils/caching";
import { profile } from "../common/profiling";
import { apiOptional } from "../common/chatMappers";
export class UserIndexClient extends CandidService {
    constructor(identity) {
        super(identity);
        this.userService = this.createServiceClient(idlFactory, 
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        "process.env.USER_INDEX_CANISTER");
    }
    static create(identity) {
        return process.env.CLIENT_CACHING && !cachingLocallyDisabled()
            ? new CachingUserIndexClient(new UserIndexClient(identity))
            : new UserIndexClient(identity);
    }
    getCurrentUser() {
        return this.handleQueryResponse(() => this.userService.current_user({}), currentUserResponse);
    }
    createChallenge() {
        return this.handleQueryResponse(() => this.userService.create_challenge({}), createChallengeResponse);
    }
    registerUser(username, challengeAttempt, referredBy) {
        return this.handleResponse(this.userService.register_user({
            username,
            challenge_attempt: challengeAttempt,
            referred_by: apiOptional((userId) => Principal.fromText(userId), referredBy),
        }), registerUserResponse);
    }
    searchUsers(searchTerm, maxResults = 20) {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.handleQueryResponse(() => this.userService.search(args), userSearchResponse, args);
    }
    getUsers(users, _allowStale) {
        const userGroups = users.userGroups.filter((g) => g.users.length > 0);
        if (userGroups.length === 0) {
            return Promise.resolve({
                serverTimestamp: undefined,
                users: [],
            });
        }
        const args = {
            user_groups: userGroups.map(({ users, updatedSince }) => ({
                users: users.map((u) => Principal.fromText(u)),
                updated_since: updatedSince,
            })),
        };
        return this.handleQueryResponse(() => this.userService.users(args), usersResponse, args);
    }
    upgradeStorage(newLimitBytes) {
        return this.handleResponse(this.userService.upgrade_storage({
            new_storage_limit_bytes: BigInt(newLimitBytes),
        }), upgradeStorageResponse);
    }
    resendRegistrationCode() {
        return this.handleResponse(this.userService.resend_code({}), resendCodeResponse);
    }
    checkUsername(username) {
        const args = {
            username: username,
        };
        return this.handleQueryResponse(() => this.userService.check_username(args), checkUsernameResponse, args);
    }
    setUsername(_userId, username) {
        return this.handleResponse(this.userService.set_username({
            username: username,
        }), setUsernameResponse);
    }
    submitPhoneNumber(phoneNumber) {
        return this.handleResponse(this.userService.submit_phone_number({
            phone_number: {
                country_code: phoneNumber.countryCode,
                number: phoneNumber.number,
            },
        }), submitPhoneNumberResponse);
    }
    confirmPhoneNumber(code) {
        return this.handleResponse(this.userService.confirm_phone_number({
            confirmation_code: code,
        }), confirmPhoneNumber);
    }
}
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "getCurrentUser", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "createChallenge", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "registerUser", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "searchUsers", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "getUsers", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "upgradeStorage", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "resendRegistrationCode", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "checkUsername", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "setUsername", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "submitPhoneNumber", null);
__decorate([
    profile("userIndexClient")
], UserIndexClient.prototype, "confirmPhoneNumber", null);
//# sourceMappingURL=userIndex.client.js.map