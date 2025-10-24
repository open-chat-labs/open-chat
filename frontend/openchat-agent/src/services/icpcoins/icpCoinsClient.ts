import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { CryptocurrencyDetails, TokenExchangeRates } from "openchat-shared";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import type { ExchangeRateClient } from "../openchatAgent";
import { idlFactory, type ICPCoinsService } from "./candid/idl";
import { coinsByMarketcapResponse } from "./mappers";

const ICPCOINS_CANISTER_ID = "4rsaq-myaaa-aaaal-qscca-cai";

export class IcpCoinsClient
    extends CandidCanisterAgent<ICPCoinsService>
    implements ExchangeRateClient
{
    constructor(identity: Identity, agent: HttpAgent) {
        super(identity, agent, ICPCOINS_CANISTER_ID, idlFactory, "IcpCoins");
    }

    exchangeRates(
        supportedTokens: CryptocurrencyDetails[],
    ): Promise<Record<string, TokenExchangeRates>> {
        return this.handleResponse(
            this.service.get_coins_by_marketcap({
                from: [],
                full: true,
                select: [],
            }),
            (resp) => coinsByMarketcapResponse(resp, supportedTokens),
        );
    }
}
