import type { DexId, TokenSwapPool } from "@shared";
import { beforeEach, describe, expect, test } from "vitest";
import { DexesAgent, type SwapIndexClient } from "./index";

const ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";
const BTC = "mxzaz-hqaaa-aaaar-qaada-cai";
const BOTH: DexId[] = ["icpswap", "taco"];

describe("DexesAgent swapping straight from the wallet", () => {
    const icpSwapPool: TokenSwapPool = {
        dex: "icpswap",
        canisterId: "a",
        token0: ICP,
        token1: CHAT,
    };
    const tacoPools: TokenSwapPool[] = [
        { dex: "taco", canisterId: "t", token0: CHAT, token1: ICP },
        { dex: "taco", canisterId: "t", token0: CHAT, token1: BTC },
    ];

    let quoted: string[];
    // What each DEX's pools answer when asked for a quote, given the amount they're asked to quote
    let quote: Record<DexId, (amountIn: bigint) => Promise<bigint | undefined>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let agent: any;

    function indexClient(
        dex: DexId,
        pools: TokenSwapPool[],
        walletInputTokens: Set<string> | undefined,
    ): SwapIndexClient {
        return {
            getPools: () => Promise.resolve(pools),
            walletInputTokens: () => Promise.resolve(walletInputTokens),
            getPoolClient: () => ({
                quote: (_inputToken, _outputToken, amountIn, outputTokenFee) => {
                    quoted.push(dex);
                    return quote[dex](amountIn - outputTokenFee);
                },
            }),
        };
    }

    beforeEach(() => {
        quoted = [];
        const quoteIt = (amount: bigint) => Promise.resolve(amount);
        quote = { icpswap: quoteIt, taco: quoteIt };
        agent = Object.create(DexesAgent.prototype);
        agent._poolsCache = {};
        // ICPSwap swaps any of its tokens from the wallet, TACO only ICP
        agent._swapIndexClients = {
            icpswap: indexClient("icpswap", [icpSwapPool], undefined),
            taco: indexClient("taco", tacoPools, new Set([ICP])),
        };
    });

    test("only pools which will swap the input token from the wallet are offered", async () => {
        expect(await agent.getSwapPools(ICP, new Set([CHAT]), BOTH)).toEqual([
            icpSwapPool,
            tacoPools[0],
        ]);
        expect(await agent.getSwapPools(CHAT, new Set([ICP, BTC]), BOTH)).toEqual([icpSwapPool]);
    });

    test("a token can be swapped if some DEX will swap it from the wallet", async () => {
        const tokens = new Set([ICP, CHAT, BTC]);

        expect(await agent.canSwap(tokens, ["taco"])).toEqual(new Set([ICP]));
        expect(await agent.canSwap(tokens, BOTH)).toEqual(new Set([ICP, CHAT]));
    });

    test("a DEX which won't swap the input token from the wallet isn't asked for a quote", async () => {
        expect(await agent.quoteSwap("taco", CHAT, ICP, 100n, 5n)).toEqual({ kind: "unsupported" });
        expect(await agent.quoteSwap("icpswap", CHAT, ICP, 100n, 5n)).toEqual({
            kind: "quoted",
            amountOut: 95n,
        });
        expect(quoted).toEqual(["icpswap"]);
    });

    test("a DEX with no pool for the pair doesn't support the swap", async () => {
        expect(await agent.quoteSwap("icpswap", ICP, BTC, 100n, 5n)).toEqual({
            kind: "unsupported",
        });
        expect(quoted).toEqual([]);
    });

    // A decline is the DEX's answer, while a failure is the DEX not answering
    test("a DEX declining to quote is told apart from one failing to", async () => {
        quote.taco = () => Promise.resolve(undefined);
        expect(await agent.quoteSwap("taco", ICP, CHAT, 100n, 5n)).toEqual({ kind: "declined" });

        quote.taco = () => Promise.reject(new Error("down"));
        await expect(agent.quoteSwap("taco", ICP, CHAT, 100n, 5n)).rejects.toThrow("down");
    });

    test("a DEX which fails to list its pools fails to quote, rather than not supporting the swap", async () => {
        agent._swapIndexClients.taco.getPools = () => Promise.reject(new Error("down"));

        await expect(agent.quoteSwap("taco", ICP, CHAT, 100n, 5n)).rejects.toThrow("down");
        // The pools of the other DEXes are still offered
        expect(await agent.getSwapPools(ICP, new Set([CHAT]), BOTH)).toEqual([icpSwapPool]);
    });
});
