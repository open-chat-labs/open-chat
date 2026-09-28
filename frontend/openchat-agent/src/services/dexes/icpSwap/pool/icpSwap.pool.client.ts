import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
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
    // The output is sent back to the wallet less `outputTokenFee`. If the swap fails the pool
    // refunds the input, and should that refund fail the input is left in the pool as an unused
    // balance, which `withdraw` recovers. The fees must match the pool's cached ledger fees, else
    // the pool rejects the swap.
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

        return this.handleResponse(this.service.depositFromAndSwap(args), swapResponse, args);
    }

    // The caller's balances held by the pool, keyed by token ledger
    unusedBalances(principal: string): Promise<Record<string, bigint>> {
        return this.handleQueryResponse(
            () => this.service.getUserUnusedBalance(Principal.fromText(principal)),
            (resp) => unusedBalancesResponse(resp, this.token0, this.token1),
            principal,
        );
    }

    // Sends `amount` of the caller's unused balance back to their wallet, less `fee`
    withdraw(token: string, amount: bigint, fee: bigint): Promise<bigint> {
        const args = { token, amount, fee };

        return this.handleResponse(this.service.withdraw(args), withdrawResponse, args);
    }

    private zeroForOne(inputToken: string, outputToken: string): boolean {
        if (inputToken === this.token0 && outputToken === this.token1) return true;

        if (inputToken === this.token1 && outputToken === this.token0) return false;

        throw new Error("ICPSwap pool does not match requested tokens");
    }
}
