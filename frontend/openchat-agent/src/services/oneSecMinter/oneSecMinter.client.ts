import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type { EvmChain, OneSecForwardingStatus, OneSecTransferFees } from "openchat-shared";
import { idlFactory, type OneSecMinterService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { apiForwardEvmToIcpArgs, forwardingResponse, transferFeesResponse } from "./mappers";

export class OneSecMinterClient extends CandidCanisterAgent<OneSecMinterService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "OneSecMinter");
    }

    forwardEvmToIcp(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: string,
    ): Promise<OneSecForwardingStatus> {
        const args = apiForwardEvmToIcpArgs(tokenSymbol, chain, address, receiver);

        return this.handleResponse(this.service.forward_evm_to_icp(args), forwardingResponse, args);
    }

    getForwardingStatus(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: string,
    ): Promise<OneSecForwardingStatus> {
        const args = apiForwardEvmToIcpArgs(tokenSymbol, chain, address, receiver);

        return this.handleQueryResponse(
            () => this.service.get_forwarding_status(args),
            forwardingResponse,
            args,
        );
    }

    getTransferFees(): Promise<OneSecTransferFees[]> {
        return this.handleQueryResponse(
            () => this.service.get_transfer_fees(),
            transferFeesResponse,
        );
    }
}
