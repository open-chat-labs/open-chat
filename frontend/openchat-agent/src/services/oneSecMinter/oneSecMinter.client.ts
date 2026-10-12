import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    EvmChain,
    IcrcAccount,
    OneSecForwardingStatus,
    OneSecTransferFees,
    WithdrawViaOneSecResponse,
} from "@shared";
import { idlFactory, type OneSecMinterService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import {
    apiForwardEvmToIcpArgs,
    apiTransferIcpToEvmArgs,
    forwardingResponse,
    transferFeesResponse,
    transferIcpToEvmResponse,
} from "./mappers";

export class OneSecMinterClient extends CandidCanisterAgent<OneSecMinterService> {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        readonly canisterId: string,
    ) {
        super(identity, agent, canisterId, idlFactory, "OneSecMinter");
    }

    // Has the minter take `amount` of the token from `sender`, which has to be the caller's account
    // and to have approved the minter to take it, and send it on to `address` on `chain`, less the
    // minter's fees
    transferIcpToEvm(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        sender: IcrcAccount,
        amount: bigint,
    ): Promise<WithdrawViaOneSecResponse> {
        const args = apiTransferIcpToEvmArgs(tokenSymbol, chain, address, sender, amount);

        return this.handleResponse(
            this.service.transfer_icp_to_evm(args),
            transferIcpToEvmResponse,
            args,
        );
    }

    forwardEvmToIcp(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: IcrcAccount,
    ): Promise<OneSecForwardingStatus> {
        const args = apiForwardEvmToIcpArgs(tokenSymbol, chain, address, receiver);

        return this.handleResponse(this.service.forward_evm_to_icp(args), forwardingResponse, args);
    }

    getForwardingStatus(
        tokenSymbol: string,
        chain: EvmChain,
        address: string,
        receiver: IcrcAccount,
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
