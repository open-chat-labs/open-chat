import type { ClaimResponse, RegisterResponse } from "../../domain/phone";
import type { IPhoneService } from "./phone.service.interface";

export class PhoneServiceMock implements IPhoneService {
    register(_countryCode: number, _phoneNumber: number): Promise<RegisterResponse> {
        return new Promise((resolve) => {
            // setTimeout(() => resolve("taken"), 2000);
            setTimeout(() => resolve("success"), 2000);
        });
    }

    claim(_code: number, _countryCode: number, _phoneNumber: number): Promise<ClaimResponse> {
        return new Promise((resolve) => {
            // setTimeout(() => resolve("taken"), 2000);
            setTimeout(
                () =>
                    resolve({
                        kind: "invalid",
                    }),
                2000
            );
        });
    }
}
