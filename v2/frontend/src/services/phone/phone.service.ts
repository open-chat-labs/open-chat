import type { Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import idlFactory, { PhoneIndexService } from "api-canisters/phone_index/canister";
import type { ClaimResponse, RegisterResponse } from "../../domain/phone";
import { registerResponse, claimResponse } from "./mappers";
import type { IPhoneService } from "./phone.service.interface";

export class PhoneService extends CandidService implements IPhoneService {
    private phoneService: PhoneIndexService;

    constructor(identity: Identity) {
        super(identity);
        this.phoneService = this.createServiceClient<PhoneIndexService>(
            idlFactory,
            "phone_index_canister_id" // todo - where does this come from
        );
    }

    register(countryCode: number, phoneNumber: number): Promise<RegisterResponse> {
        return this.handleResponse(
            this.phoneService.register({
                number: {
                    country_code: countryCode,
                    number: BigInt(phoneNumber),
                },
            }),
            registerResponse
        );
    }

    claim(code: number, countryCode: number, phoneNumber: number): Promise<ClaimResponse> {
        return this.handleResponse(
            this.phoneService.claim({
                code,
                number: {
                    country_code: countryCode,
                    number: BigInt(phoneNumber),
                },
            }),
            claimResponse
        );
    }
}
