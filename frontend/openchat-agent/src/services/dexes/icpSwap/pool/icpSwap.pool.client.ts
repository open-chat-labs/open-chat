import type { HttpAgent, Identity } from "@dfinity/agent";
import { idlFactory, type IcpSwapPoolService } from "./candid/idl";
import { CandidService } from "../../../candidService";
import { quoteResponse } from "./mappers";
import type { SwapPoolClient } from "../../index";

export class IcpSwapPoolClient extends CandidService implements SwapPoolClient {
    private service: IcpSwapPoolService;

    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
        private token0: string,
        private token1: string,
    ) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<IcpSwapPoolService>(idlFactory);
    }

    quote(inputToken: string, outputToken: string, amountIn: bigint): Promise<bigint> {
        const zeroForOne = this.zeroForOne(inputToken, outputToken);
        const args = {
            amountIn: amountIn.toString(),
            amountOutMinimum: "0",
            zeroForOne,
        };

        return this.handleQueryResponse(() => this.service.quoteForAll(args), quoteResponse, args);
    }

    private zeroForOne(inputToken: string, outputToken: string): boolean {
        if (inputToken === this.token0 && outputToken === this.token1) return true;

        if (inputToken === this.token1 && outputToken === this.token0) return false;

        throw new Error("ICPSwap pool does not match requested tokens");
    }
}
