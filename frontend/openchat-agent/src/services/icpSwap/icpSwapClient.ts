import type { HttpAgent, Identity } from "@dfinity/agent";
import type { TokenExchangeRates } from "openchat-shared";
import { idlFactory, type ICPSwapService } from "./candid/idl";
import { CandidService } from "../candidService";
import { getAllTokensResponse } from "./mappers";
import type { ExchangeRateClient } from "../openchatAgent";

const ICPSWAP_CANISTER_ID = "ggzvv-5qaaa-aaaag-qck7a-cai";

export class IcpSwapClient extends CandidService implements ExchangeRateClient {
    private service: ICPSwapService;

    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPSWAP_CANISTER_ID);

        this.service = this.createServiceClient<ICPSwapService>(idlFactory);
    }

    exchangeRates(): Promise<Record<string, TokenExchangeRates>> {
        return this.handleQueryResponse(() => this.service.getAllTokens(), getAllTokensResponse);
    }
}
