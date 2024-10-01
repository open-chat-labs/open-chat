import { AnonymousIdentity, type HttpAgent, type Identity } from "@dfinity/agent";
import type { DexId, TokenSwapPool } from "openchat-shared";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { IcpSwapPoolClient } from "./icpSwap/pool/icpSwap.pool.client";
import { SonicSwapsClient } from "./sonic/swaps/sonic.swaps.client";

export class DexesAgent {
    private _identity: Identity;
    private _icpSwapIndexClient: IcpSwapIndexClient;
    private _sonicSwapsClient: SonicSwapsClient;

    constructor(private agent: HttpAgent) {
        this._identity = new AnonymousIdentity();
        this._icpSwapIndexClient = new IcpSwapIndexClient(this._identity, this.agent);
        this._sonicSwapsClient = new SonicSwapsClient(this._identity, this.agent);
    }

    async getSwapPools(
        inputToken: string,
        outputTokens: Set<string>,
        swapProviders: DexId[],
    ): Promise<TokenSwapPool[]> {
        const allPools = await this.getSwapPoolsUnfiltered(swapProviders);

        return allPools.filter(
            (p) =>
                (p.token0 === inputToken && outputTokens.has(p.token1)) ||
                (p.token1 === inputToken && outputTokens.has(p.token0)),
        );
    }

    async canSwap(tokens: Set<string>, swapProviders: DexId[]): Promise<Set<string>> {
        const allPools = await this.getSwapPoolsUnfiltered(swapProviders);

        const available = new Set<string>();

        for (const p of allPools) {
            if (tokens.has(p.token0) && tokens.has(p.token1)) {
                available.add(p.token0);
                available.add(p.token1);
            }
        }

        return available;
    }

    async quoteSwap(
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        swapProviders: DexId[],
    ): Promise<[DexId, bigint][]> {
        const pools = await this.getSwapPools(inputToken, new Set([outputToken]), swapProviders);

        return await Promise.all(
            pools.map((p) =>
                this.quoteSingle(p, inputToken, outputToken, amountIn).then(
                    (quote) => [p.dex, quote] as [DexId, bigint],
                ),
            ),
        );
    }

    private getSwapPoolsUnfiltered(swapProviders: DexId[]): Promise<TokenSwapPool[]> {
        const promises: Promise<TokenSwapPool[]>[] = [];
        if (swapProviders.includes("icpswap")) {
            promises.push(this._icpSwapIndexClient.getPools());
        }
        if (swapProviders.includes("sonic")) {
            promises.push(this._sonicSwapsClient.getPools());
        }
        return Promise.all(promises).then((r) => r.flat());
    }

    private quoteSingle(
        pool: TokenSwapPool,
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
    ): Promise<bigint> {
        if (pool.dex === "icpswap") {
            const client = new IcpSwapPoolClient(
                this._identity,
                this.agent,
                pool.canisterId,
                pool.token0,
                pool.token1,
            );
            return client.quote(inputToken, outputToken, amountIn);
        } else if (pool.dex === "sonic") {
            const client = new SonicSwapsClient(this._identity, this.agent);
            return client.quote(inputToken, outputToken, amountIn);
        } else {
            return Promise.resolve(BigInt(0));
        }
    }
}
