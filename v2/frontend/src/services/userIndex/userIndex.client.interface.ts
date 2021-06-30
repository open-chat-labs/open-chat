import type { Principal } from "@dfinity/principal";
import type {
    UpdateUsernameResponse,
    GetCurrentUserResponse,
    ConfirmPhoneNumberResponse,
    RegisterPhoneNumberResponse,
} from "../../domain/user";

export interface IUserIndexClient {
    getCurrentUser: () => Promise<GetCurrentUserResponse>;
    updateUsername(userPrincipal: Principal, username: string): Promise<UpdateUsernameResponse>;
    registerPhoneNumber(
        countryCode: number,
        phoneNumber: number
    ): Promise<RegisterPhoneNumberResponse>;
    confirmPhoneNumber(code: string): Promise<ConfirmPhoneNumberResponse>;
}
