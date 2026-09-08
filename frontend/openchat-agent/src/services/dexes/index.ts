import { AnonymousIdentity, type HttpAgent, type Identity } from "@icp-sdk/core/agent";
import type { DexId, TokenSwapPool } from "@shared";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { TacoIndexClient } from "./taco/index/taco.index.client";

const TEN_MINUTES = 10 * 60 * 1000;

export class DexesAgent {
    private _identity: Identity;
    private _swapIndexClients: Record<DexId, SwapIndexClient>;
    private _poolsCache: Record<string, [TokenSwapPool[], number]> = {};

    constructor(private agent: HttpAgent) {
        this._identity = new AnonymousIdentity();
        this._swapIndexClients = {
            icpswap: new IcpSwapIndexClient(this._identity, this.agent),
            taco: new TacoIndexClient(this._identity, this.agent),
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

        // A pool that cannot quote is a normal answer, not a failure: the commonest case is an
        // amount too small for that pool's fee, and pools also go dry or get retired. Dropping it
        // lets the remaining pools still be quoted, and an empty result already means "no quotes"
        // to the caller. Promise.all here failed the whole request on any one pool's rejection.
        const quotes = await Promise.allSettled(
            pools.map((p) =>
                this.quoteSingle(p, inputToken, outputToken, amountIn).then(
                    (quote) => [p.dex, quote] as [DexId, bigint],
                ),
            ),
        );
        // No rethrow when they all fail. A DEX declines by throwing - ICPSwap's mapper throws on
        // any non-ok variant, "amount of input token is too small" included - and a pair usually
        // has a single pool, so "every pool failed" is the ordinary dust-amount case, not an
        // outage. Rethrowing there just reinstated the noise this change exists to remove.
        // `getAllSwapPools` above already swallows a DEX being unreachable for the same reason.
        return quotes.flatMap((q) => (q.status === "fulfilled" ? [q.value] : []));
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
        return Promise.allSettled(promises).then((result) =>
            result.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
        );
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
