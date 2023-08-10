import type { Identity } from "@dfinity/agent";
import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "openchat-shared";
import { idlFactory, MarketMakerService } from "./candid/idl";
import { CandidService } from "../candidService";
import { updateConfigResponse } from "./mappers";
import type { AgentConfig } from "../../config";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class MarketMakerClient extends CandidService {
    private service: MarketMakerService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<MarketMakerService>(
            idlFactory,
            config.marketMakerCanister,
            config
        );
    }

    static create(identity: Identity, config: AgentConfig): MarketMakerClient {
        return new MarketMakerClient(identity, config);
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
                config.maxOrdersToMakePerIteration
            ),
            max_orders_to_cancel_per_iteration: apiOptional(
                identity,
                config.maxOrdersToCancelPerIteration
            ),
        };
        return this.handleResponse(this.service.update_config(args), updateConfigResponse);
    }
}
