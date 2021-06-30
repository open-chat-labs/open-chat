import type { ClaimResponse, RegisterResponse } from "../../domain/phone";

export interface IPhoneService {
    register(countryCode: number, phoneNumber: number): Promise<RegisterResponse>;
    claim(code: number, countryCode: number, phoneNumber: number): Promise<ClaimResponse>;
}
