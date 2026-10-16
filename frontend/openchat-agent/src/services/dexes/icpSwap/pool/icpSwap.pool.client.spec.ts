import { beforeEach, describe, expect, test } from "vitest";
import { IcpSwapPoolClient } from "./icpSwap.pool.client";

const ICP = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const CHAT = "2ouva-viaaa-aaaaq-aaamq-cai";
const ICP_FEE = 10_000n;
const CHAT_FEE = 100_000n;

// The pool's amounts out are before the output token's fee for sending it to the wallet, while the
// client's are what reaches the wallet, after it
describe("IcpSwapPoolClient", () => {
    let calls: unknown[][];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let client: any;

    beforeEach(() => {
        calls = [];
        client = Object.create(IcpSwapPoolClient.prototype);
        client.token0 = ICP;
        client.token1 = CHAT;
        client.service = {
            quoteForAll: (args: unknown) => {
                calls.push(["quote", args]);
                return Promise.resolve({ ok: 2_000_000n });
            },
            depositFromAndSwap: (args: unknown) => {
                calls.push(["swap", args]);
                return Promise.resolve({ ok: 2_000_000n });
            },
        };
    });

    test("quotes what reaches the wallet, after the output token's fee", async () => {
        expect(await client.quote(ICP, CHAT, 1_000_000n, CHAT_FEE)).toBe(1_900_000n);
        expect(calls).toEqual([
            ["quote", { amountIn: "1000000", amountOutMinimum: "0", zeroForOne: true }],
        ]);
    });

    test("gives the pool the minimum that must reach the wallet, plus the output token's fee", async () => {
        expect(
            await client.swapFromWallet(ICP, CHAT, 1_000_000n, 1_800_000n, ICP_FEE, CHAT_FEE),
        ).toEqual({
            kind: "success",
            amountOut: 1_900_000n,
        });
        expect(calls).toEqual([
            [
                "swap",
                {
                    amountIn: "1000000",
                    amountOutMinimum: "1900000",
                    zeroForOne: true,
                    tokenInFee: ICP_FEE,
                    tokenOutFee: CHAT_FEE,
                },
            ],
        ]);
    });
});
