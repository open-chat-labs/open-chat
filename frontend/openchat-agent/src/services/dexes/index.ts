import { AnonymousIdentity, type HttpAgent, type Identity } from "@icp-sdk/core/agent";
import type { DexId, TokenSwapPool } from "@shared";
import { IcpSwapIndexClient } from "./icpSwap/index/icpSwap.index.client";
import { TacoIndexClient } from "./taco/index/taco.index.client";

const TEN_MINUTES = 10 * 60 * 1000;

// A DEX's pools, along with the tokens it will swap straight from the wallet, which is any of them
// if `walletInputTokens` is undefined
type DexPools = { pools: TokenSwapPool[]; walletInputTokens: Set<string> | undefined };

export class DexesAgent {
    private _identity: Identity;
    private _swapIndexClients: Record<DexId, SwapIndexClient>;
    private _poolsCache: Record<string, [DexPools, number]> = {};

    constructor(private agent: HttpAgent) {
        this._identity = new AnonymousIdentity();
        this._swapIndexClients = {
            icpswap: new IcpSwapIndexClient(this._identity, this.agent),
            taco: new TacoIndexClient(this._identity, this.agent),
        };
    }

    // The pools which will swap `inputToken` straight from the wallet for any of `outputTokens`
    async getSwapPools(
        inputToken: string,
        outputTokens: Set<string>,
        swapProviders: DexId[],
    ): Promise<TokenSwapPool[]> {
        const allPools = await this.getAllSwapPools(swapProviders);

        return allPools.flatMap((dexPools) =>
            swapsFromWallet(dexPools, inputToken)
                ? dexPools.pools.filter(
                      (p) =>
                          (p.token0 === inputToken && outputTokens.has(p.token1)) ||
                          (p.token1 === inputToken && outputTokens.has(p.token0)),
                  )
                : [],
        );
    }

    // Which of `tokens` can be swapped straight from the wallet for another of them
    async canSwap(tokens: Set<string>, swapProviders: DexId[]): Promise<Set<string>> {
        const allPools = await this.getAllSwapPools(swapProviders);

        const available = new Set<string>();

        for (const dexPools of allPools) {
            for (const p of dexPools.pools) {
                if (tokens.has(p.token0) && tokens.has(p.token1)) {
                    for (const token of [p.token0, p.token1]) {
                        if (swapsFromWallet(dexPools, token)) {
                            available.add(token);
                        }
                    }
                }
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
                this.quoteSingle(p, inputToken, outputToken, amountIn).then((quote) =>
                    quote === undefined ? undefined : ([p.dex, quote] as [DexId, bigint]),
                ),
            ),
        );
        // A pool that declines resolves to undefined and is dropped; a pool that fails rejects.
        // The two mean different things: with no quote in hand, a failure anywhere is what stopped
        // the user getting one, and must surface rather than read as "no quotes". (Requiring every
        // pool to have rejected let one decline plus one failure through as silence.)
        const succeeded = quotes.flatMap((q) =>
            q.status === "fulfilled" && q.value !== undefined ? [q.value] : [],
        );
        const failed = quotes.find((q): q is PromiseRejectedResult => q.status === "rejected");
        if (succeeded.length === 0 && failed !== undefined) {
            throw failed.reason;
        }
        // Some pool quoted, so the user gets a price - but a pool that failed after its retries
        // while another answered is a DEX that is down, and the "best" quote shown may not be.
        // Not worth failing the swap over; worth knowing about.
        quotes.forEach((q, i) => {
            if (q.status === "rejected") {
                console.warn(
                    `quoteSwap: ${pools[i].dex} pool failed, quoting without it`,
                    q.reason,
                );
            }
        });
        return succeeded;
    }

    private getAllSwapPools(swapProviders: DexId[]): Promise<DexPools[]> {
        const promises: Promise<DexPools>[] = [];
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
                Promise.all([client.getPools(), client.walletInputTokens()]).then(
                    ([pools, walletInputTokens]) => {
                        const dexPools = { pools, walletInputTokens };
                        this._poolsCache[swapProvider] = [dexPools, Date.now()];
                        return dexPools;
                    },
                ),
            );
        }
        return Promise.allSettled(promises).then((result) =>
            result.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
        );
    }

    private quoteSingle(
        pool: TokenSwapPool,
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
    ): Promise<bigint | undefined> {
        const indexClient = this._swapIndexClients[pool.dex];
        if (indexClient === undefined) {
            return Promise.resolve(BigInt(0));
        }
        const poolClient = indexClient.getPoolClient(pool.canisterId, pool.token0, pool.token1);
        return poolClient.quote(inputToken, outputToken, amountIn);
    }

    private tryGetAllSwapPoolsFromCache(dex: DexId): DexPools | undefined {
        const cached = this._poolsCache[dex];
        if (cached === undefined) {
            return undefined;
        }
        const [pools, timestamp] = cached;
        const now = Date.now();
        return now - timestamp < TEN_MINUTES ? pools : undefined;
    }
}

function swapsFromWallet({ walletInputTokens }: DexPools, inputToken: string): boolean {
    return walletInputTokens?.has(inputToken) ?? true;
}

export interface SwapIndexClient {
    getPoolClient(canisterId: string, token0: string, token1: string): SwapPoolClient;
    getPools(): Promise<TokenSwapPool[]>;
    // The tokens the DEX will swap straight from the wallet, or undefined if any
    walletInputTokens(): Promise<Set<string> | undefined>;
}

export interface SwapPoolClient {
    // `amountIn` is what the DEX pulls from the wallet. undefined when the pool declines to quote
    // (amount too small, no liquidity); reject only for a failure to ask
    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint | undefined>;
}
