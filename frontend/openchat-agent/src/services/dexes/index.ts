import { AnonymousIdentity, type Identity } from "@dfinity/agent";
import type { DexId, TokenSwapPool } from "openchat-shared";
import type { AgentConfig } from "../../config";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { IcpSwapPoolClient } from "./icpSwap/pool/icpSwap.pool.client";

export class DexesAgent {
    private _identity: Identity;
    private _icpSwapIndexClient: IcpSwapIndexClient;

    constructor(private config: AgentConfig) {
        this._identity = new AnonymousIdentity();
        this._icpSwapIndexClient = IcpSwapIndexClient.create(this._identity, config);
    }

    async getSwapPools(inputToken: string, outputTokens: Set<string>): Promise<TokenSwapPool[]> {
        const allPools = await this._icpSwapIndexClient.getPools();

        return allPools.filter(
            (p) =>
                (p.token0 === inputToken && outputTokens.has(p.token1)) ||
                (p.token1 === inputToken && outputTokens.has(p.token0)),
        );
    }

    async quoteSwap(
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
    ): Promise<[DexId, bigint][]> {
        const pools = await this.getSwapPools(inputToken, new Set([outputToken]));

        return await Promise.all(
            pools.map((p) =>
                IcpSwapPoolClient.create(
                    this._identity,
                    this.config,
                    p.canisterId,
                    p.token0,
                    p.token1,
                )
                    .quote(inputToken, outputToken, amountIn)
                    .then((quote) => [p.dex, quote] as [DexId, bigint]),
            ),
        );
    }
}
