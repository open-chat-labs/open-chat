import type { Principal } from "@dfinity/principal";
import type { ClaimResponse, RegisterResponse } from "../../domain/phone";
import { AuthError } from "../httpError";
import type { IPhoneService } from "./phone.service.interface";

export class PhoneServiceMock implements IPhoneService {
    register(_countryCode: number, _phoneNumber: number): Promise<RegisterResponse> {
        return new Promise((resolve, _reject) => {
            // setTimeout(() => resolve("taken"), 2000);
            throw new AuthError(401, new Error("looks like an auth error"));
            setTimeout(() => resolve("success"), 2000);
            // setTimeout(() => reject("success"), 2000);
        });
    }

    claim(_code: number, _countryCode: number, _phoneNumber: number): Promise<ClaimResponse> {
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
