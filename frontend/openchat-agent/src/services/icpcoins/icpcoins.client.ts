import type { Identity } from "@dfinity/agent";
import type { TokenExchangeRates } from "openchat-shared";
import { idlFactory, type ICPCoinsService } from "./candid/idl";
import { CandidService } from "../candidService";
import { getLatestResponse } from "./mappers";
import type { AgentConfig } from "../../config";

const ICPCOINS_CANISTER_ID = "u45jl-liaaa-aaaam-abppa-cai";

export class ICPCoinsClient extends CandidService {
    private service: ICPCoinsService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<ICPCoinsService>(
            idlFactory,
            ICPCOINS_CANISTER_ID,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): ICPCoinsClient {
        return new ICPCoinsClient(identity, config);
    }

    exchangeRates(): Promise<Record<string, TokenExchangeRates>> {
        return this.handleQueryResponse(() => this.service.get_latest(), getLatestResponse);
    }
}
