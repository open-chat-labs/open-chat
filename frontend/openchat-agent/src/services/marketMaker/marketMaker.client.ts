import type { HttpAgent, Identity } from "@dfinity/agent";
import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "openchat-shared";
import { idlFactory, type MarketMakerService } from "./candid/idl";
import { CanisterAgent } from "../canisterAgent";
import { updateConfigResponse } from "./mappers";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class MarketMakerClient extends CanisterAgent {
    private service: MarketMakerService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<MarketMakerService>(idlFactory);
    }

    updateConfig(config: UpdateMarketMakerConfigArgs): Promise<UpdateMarketMakerConfigResponse> {
        const args = {
            exchange_id: config.exchangeId,
            enabled: apiOptional(identity, config.enabled),
            price_increment: apiOptional(identity, config.priceIncrement),
            order_size: apiOptional(identity, config.orderSize),
            min_order_size: apiOptional(identity, config.minOrderSize),
            max_buy_price: apiOptional(identity, config.maxBuyPrice),
            min_sell_price: apiOptional(identity, config.minSellPrice),
            spread: apiOptional(identity, config.spread),
            min_orders_per_direction: apiOptional(identity, config.minOrdersPerDirection),
            max_orders_per_direction: apiOptional(identity, config.maxOrdersPerDirection),
            max_orders_to_make_per_iteration: apiOptional(
                identity,
                config.maxOrdersToMakePerIteration,
            ),
            max_orders_to_cancel_per_iteration: apiOptional(
                identity,
                config.maxOrdersToCancelPerIteration,
            ),
        };
        return this.handleResponse(this.service.update_config(args), updateConfigResponse);
    }
}
