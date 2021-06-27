import type { Identity } from "@dfinity/agent";
import { CandidService } from "./candidService";
import idlFactory, { PhoneIndexService } from "api-canisters/phone_index/canister";
import type { ClaimResponse, RegisterResponse } from "../domain/phone";
import { registerResponse, claimResponse } from "./mappers/phone";

export class PhoneService extends CandidService {
    private phoneService: PhoneIndexService;

    constructor(identity: Identity) {
        super(identity);
        this.phoneService = this.createServiceClient<PhoneIndexService>(
            idlFactory,
            "phone_index_canister_id" // todo - where does this come from
        );
    }

    register(): Promise<RegisterResponse> {
        return this.handleResponse(
            this.phoneService.register({
                number: {
                    country_code: 123,
                    number: BigInt(123),
                },
            }),
            registerResponse
        );
    }

    claim(): Promise<ClaimResponse> {
        return this.handleResponse(
            this.phoneService.claim({
                code: 123,
                number: {
                    country_code: 123,
                    number: BigInt(123),
                },
            }),
            claimResponse
        );
    }
}
