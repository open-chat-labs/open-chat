import type { Principal } from "@dfinity/principal";
import type {
    SetUsernameResponse,
    CurrentUserResponse,
    ConfirmPhoneNumberResponse,
    SubmitPhoneNumberResponse,
} from "../../domain/user";

export interface IUserIndexClient {
    upgradeUser: () => Promise<void>;
    getCurrentUser: () => Promise<CurrentUserResponse>;
    setUsername(username: string): Promise<SetUsernameResponse>;
    submitPhoneNumber(countryCode: number, phoneNumber: string): Promise<SubmitPhoneNumberResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
}
