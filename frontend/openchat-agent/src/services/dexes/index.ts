import { AnonymousIdentity, type HttpAgent, type Identity } from "@dfinity/agent";
import type { DexId, TokenSwapPool } from "openchat-shared";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { SonicSwapsClient } from "./sonic/swaps/sonic.swaps.client";

const TEN_MINUTES = 10 * 60 * 1000;

export class DexesAgent {
    private _identity: Identity;
    private _swapIndexClients: Record<string, SwapIndexClient>;
    private _poolsCache: Record<string, [TokenSwapPool[], number]> = {};

    constructor(private agent: HttpAgent) {
        this._identity = new AnonymousIdentity();
        this._swapIndexClients = {
            icpswap: new IcpSwapIndexClient(this._identity, this.agent),
            sonic: new SonicSwapsClient(this._identity, this.agent),
        };
    }

    async getSwapPools(
        inputToken: string,
        outputTokens: Set<string>,
        swapProviders: DexId[],
    ): Promise<TokenSwapPool[]> {
        const allPools = await this.getAllSwapPools(swapProviders);

        return allPools.filter(
            (p) =>
                (p.token0 === inputToken && outputTokens.has(p.token1)) ||
                (p.token1 === inputToken && outputTokens.has(p.token0)),
        );
    }

    async canSwap(tokens: Set<string>, swapProviders: DexId[]): Promise<Set<string>> {
        const allPools = await this.getAllSwapPools(swapProviders);

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

    private getAllSwapPools(swapProviders: DexId[]): Promise<TokenSwapPool[]> {
        const promises: Promise<TokenSwapPool[]>[] = [];
        for (const swapProvider of swapProviders) {
            const cached = this.tryGetAllSwapPoolsFromCache(swapProvider);
            if (cached !== undefined) {
                promises.push(Promise.resolve(cached));
                continue;
            }
            const client = this._swapIndexClients[swapProvider];
            if (client === undefined) {
                continue;
            }
            promises.push(
                client.getPools().then((pools) => {
                    this._poolsCache[swapProvider] = [pools, Date.now()];
                    return pools;
                }),
            );
        }
        return Promise.all(promises).then((r) => r.flat());
    }

    private quoteSingle(
        pool: TokenSwapPool,
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
    ): Promise<bigint> {
        const indexClient = this._swapIndexClients[pool.dex];
        if (indexClient === undefined) {
            return Promise.resolve(BigInt(0));
        }
        const poolClient = indexClient.getPoolClient(pool.canisterId, pool.token0, pool.token1);
        return poolClient.quote(inputToken, outputToken, amountIn);
    }

    private tryGetAllSwapPoolsFromCache(dex: DexId): TokenSwapPool[] | undefined {
        const cached = this._poolsCache[dex];
        if (cached === undefined) {
            return undefined;
        }
        const [pools, timestamp] = cached;
        const now = Date.now();
        return now - timestamp < TEN_MINUTES ? pools : undefined;
    }
}

export interface SwapIndexClient {
    getPoolClient(canisterId: string, token0: string, token1: string): SwapPoolClient;
    getPools(): Promise<TokenSwapPool[]>;
}

export interface SwapPoolClient {
    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint>;
}
