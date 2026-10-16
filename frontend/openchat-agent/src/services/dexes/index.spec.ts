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
                    return Promise.resolve(amountIn - outputTokenFee);
                },
            }),
        };
    }

    beforeEach(() => {
        quoted = [];
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
        expect(await agent.quoteSwap(CHAT, ICP, 100n, 5n, BOTH)).toEqual([["icpswap", 95n]]);
        expect(quoted).toEqual(["icpswap"]);
    });
});
