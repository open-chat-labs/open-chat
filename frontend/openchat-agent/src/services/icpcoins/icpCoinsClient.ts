import type { HttpAgent, Identity } from "@dfinity/agent";
import type { CryptocurrencyDetails, TokenExchangeRates } from "openchat-shared";
import { idlFactory, type ICPCoinsService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { getLatestResponse } from "./mappers";
import type { ExchangeRateClient } from "../openchatAgent";

const ICPCOINS_CANISTER_ID = "u45jl-liaaa-aaaam-abppa-cai";

export class IcpCoinsClient extends CandidCanisterAgent<ICPCoinsService> implements ExchangeRateClient {
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPCOINS_CANISTER_ID, idlFactory, "IcpCoins");
    }

    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>> {
        return this.handleQueryResponse(
            () => this.service.get_latest(),
            (resp) => getLatestResponse(resp, supportedTokens),
        );
    }
}
