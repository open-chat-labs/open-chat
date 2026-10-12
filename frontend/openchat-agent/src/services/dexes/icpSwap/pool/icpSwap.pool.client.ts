import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { Principal } from "@icp-sdk/core/principal";
import type { DexSwapResult } from "@shared";
import { idlFactory, type IcpSwapPoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { quoteResponse, swapResponse, unusedBalancesResponse, withdrawResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";

export class IcpSwapPoolClient
    extends CandidCanisterAgent<IcpSwapPoolService>
    implements SwapPoolClient
{
    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        private token0: string,
        private token1: string,
    ) {
        super(identity, agent, canisterId, idlFactory, "IcpSwapPool");
    }

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint | undefined> {
        const zeroForOne = this.zeroForOne(inputToken, outputToken);
        const args = {
            amountIn: amountIn.toString(),
            amountOutMinimum: "0",
            zeroForOne,
        };

        return this.handleQueryResponse(() => this.service.quoteForAll(args), quoteResponse, args);
    }

    // Swaps straight from the caller's wallet in a single call. The pool pulls `amountIn` from the
    // wallet via ICRC2, so the caller must first approve the pool for `amountIn + inputTokenFee`.
    // `minAmountOut` is on the same basis as `quote`, ie. before the output token's fee is taken.
    // The pool queues the transfer of the output back to the wallet, so it lands shortly after this
    // returns. Any input the swap didn't use, which is all of it if the swap fails, is refunded the
    // same way, less another `inputTokenFee`. The fees must match the pool's cached ledger fees,
    // else the pool rejects the swap before pulling anything.
    swapFromWallet(
        inputToken: string,
        outputToken: string,
        amountIn: bigint,
        minAmountOut: bigint,
        inputTokenFee: bigint,
        outputTokenFee: bigint,
    ): Promise<DexSwapResult> {
        const args = {
            amountIn: amountIn.toString(),
            amountOutMinimum: minAmountOut.toString(),
            zeroForOne: this.zeroForOne(inputToken, outputToken),
            tokenInFee: inputTokenFee,
            tokenOutFee: outputTokenFee,
        };

        return this.handleResponse(
            this.service.depositFromAndSwap(args),
            (resp) => swapResponse(resp, outputTokenFee),
            args,
        );
    }

    // What the pool holds for `principal` which it hasn't swapped or paid out, eg. the input of a
    // swap made from the wallet whose refund failed, by the ledger of each of the pool's tokens
    unusedBalances(principal: Principal): Promise<{ ledger: string; balance: bigint }[]> {
        return this.handleQueryResponse(
            () => this.service.getUserUnusedBalance(principal),
            (resp) => unusedBalancesResponse(resp, this.token0, this.token1),
            principal,
        );
    }

    // Withdraws `amount` of `ledger`'s token held for the caller. The pool queues its transfer to
    // the caller's wallet, which arrives shortly after this returns, less `fee`.
    withdraw(ledger: string, amount: bigint, fee: bigint): Promise<boolean> {
        const args = { token: ledger, amount, fee };
        return this.handleResponse(this.service.withdraw(args), withdrawResponse, args);
    }

    private zeroForOne(inputToken: string, outputToken: string): boolean {
        if (inputToken === this.token0 && outputToken === this.token1) return true;

        if (inputToken === this.token1 && outputToken === this.token0) return false;

        throw new Error("ICPSwap pool does not match requested tokens");
    }
}
