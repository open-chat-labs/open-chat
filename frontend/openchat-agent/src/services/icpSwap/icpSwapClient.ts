import type { HttpAgent, Identity } from "@dfinity/agent";
import type { CryptocurrencyDetails, TokenExchangeRates } from "openchat-shared";
import { idlFactory, type ICPSwapService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { getAllTokensResponse } from "./mappers";
import type { ExchangeRateClient } from "../openchatAgent";

const ICPSWAP_CANISTER_ID = "ggzvv-5qaaa-aaaag-qck7a-cai";

export class IcpSwapClient extends CandidCanisterAgent<ICPSwapService> implements ExchangeRateClient {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPSWAP_CANISTER_ID, idlFactory, "IcpSwapExchangeRates");
    }

    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>> {
        return this.handleQueryResponse(
            () => this.service.getAllTokens(),
            (resp) => getAllTokensResponse(resp, supportedTokens),
        );
    }
}
