import type { HttpAgent, Identity } from "@dfinity/agent";
import type { TokenExchangeRates } from "openchat-shared";
import { idlFactory, type ICPCoinsService } from "./candid/idl";
import { CandidService } from "../candidService";
import { getLatestResponse } from "./mappers";
import type { ExchangeRateClient } from "../openchatAgent";

const ICPCOINS_CANISTER_ID = "u45jl-liaaa-aaaam-abppa-cai";

export class IcpCoinsClient extends CandidService implements ExchangeRateClient {
    private service: ICPCoinsService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPCOINS_CANISTER_ID);

        this.service = this.createServiceClient<ICPCoinsService>(idlFactory);
    }

    exchangeRates(): Promise<Record<string, TokenExchangeRates>> {
        return this.handleQueryResponse(() => this.service.get_latest(), getLatestResponse);
    }
}
