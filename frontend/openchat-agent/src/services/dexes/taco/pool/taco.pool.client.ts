import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type TacoExchangePoolService } from "./candid/idl";
import { CandidCanisterAgent } from "../../../canisterAgent/candid";
import { batchMultiQuoteResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";
import { TACO_EXCHANGE_CANISTER_ID } from "../index/mappers";
import { NUM_FRACTIONS, STEP_BP, TOP_ROUTES_PER_FRACTION } from "./optimizer";

export class TacoPoolClient
    extends CandidCanisterAgent<TacoExchangePoolService>
    implements SwapPoolClient
{
    constructor(identity: Identity, agent: HttpAgent, _token0: string, _token1: string) {
        // TACO routes internally; the pool client doesn't need the token
        // ordering. Constructor signature is kept symmetric with ICPSwap's so
        // SwapIndexClient.getPoolClient remains polymorphic.
        super(identity, agent, TACO_EXCHANGE_CANISTER_ID, idlFactory, "TacoExchangePool");
    }

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        // Build the 10-fraction probe grid — same shape as the user_canister
        // backend's TacoExchangeClient. Each surviving probe carries its bp
        // forward in `bps` so the optimizer can label batch responses correctly
        // even when filter_map drops zero-amount entries.
        const probes: { tokenSell: string; tokenBuy: string; amountSell: bigint }[] = [];
        const bps: bigint[] = [];
        for (let i = 0; i < NUM_FRACTIONS; i++) {
            const bp = (BigInt(i) + 1n) * STEP_BP;
            const amt = (amountIn * bp) / 10000n;
            if (amt > 0n) {
                probes.push({
                    tokenSell: inputToken,
                    tokenBuy: outputToken,
                    amountSell: amt,
                });
                bps.push(bp);
            }
        }
        if (probes.length === 0) return Promise.resolve(0n);

        return this.handleQueryResponse(
            () =>
                this.service.getExpectedReceiveAmountBatchMulti(
                    probes,
                    TOP_ROUTES_PER_FRACTION,
                ),
            (resp) => batchMultiQuoteResponse(resp, bps),
            [probes, TOP_ROUTES_PER_FRACTION],
        );
    }
}
