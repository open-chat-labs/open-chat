export type UpdateMarketMakerConfigArgs = {
    exchangeId: number;
    enabled?: boolean;
    priceIncrement?: bigint;
    orderSize?: bigint;
    minOrderSize?: bigint;
    maxBuyPrice?: bigint;
    minSellPrice?: bigint;
    minOrdersPerDirection?: number;
    maxOrdersPerDirection?: number;
    maxOrdersToMakePerIteration?: number;
    maxOrdersToCancelPerIteration?: number;
};

export type UpdateMarketMakerConfigResponse =
    | "success"
    | "not_authorized"
    | "exchange_not_found"
    | "internal_error";
