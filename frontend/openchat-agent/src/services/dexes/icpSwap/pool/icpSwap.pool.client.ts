import type { Identity } from "@dfinity/agent";
import { idlFactory, type IcpSwapPoolService } from "./candid/idl";
import { CandidService } from "../../../candidService";
import type { AgentConfig } from "../../../../config";
import { quoteResponse } from "./mappers";

export class IcpSwapPoolClient extends CandidService {
    private service: IcpSwapPoolService;

    private constructor(
        identity: Identity,
        config: AgentConfig,
        canisterId: string,
        private token0: string,
        private token1: string,
    ) {
        super(identity);

        this.service = this.createServiceClient<IcpSwapPoolService>(idlFactory, canisterId, config);
    }

    static create(
        identity: Identity,
        config: AgentConfig,
        canisterId: string,
        token0: string,
        token1: string,
    ): IcpSwapPoolClient {
        return new IcpSwapPoolClient(identity, config, canisterId, token0, token1);
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
