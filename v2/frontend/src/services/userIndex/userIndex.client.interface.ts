import type { Principal } from "@dfinity/principal";
import type {
    SetUsernameResponse,
    CurrentUserResponse,
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
    PhoneNumber,
    ResendCodeResponse,
} from "../../domain/user";

export interface IUserIndexClient {
    upgradeUser: () => Promise<void>;
    getCurrentUser: () => Promise<CurrentUserResponse>;
    setUsername(username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(phoneNumber: PhoneNumber): Promise<SubmitPhoneNumberResponse>;
    resendRegistrationCode(): Promise<ResendCodeResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
}
