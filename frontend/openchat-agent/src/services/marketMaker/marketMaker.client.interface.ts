import type { UpdateMarketMakerConfigArgs, UpdateMarketMakerConfigResponse } from "openchat-shared";

export interface IMarketMakerClient {
    updateConfig(config: UpdateMarketMakerConfigArgs): Promise<UpdateMarketMakerConfigResponse>;
}
