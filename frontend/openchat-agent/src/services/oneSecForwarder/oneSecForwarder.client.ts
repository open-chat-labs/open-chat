import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { idlFactory, type OneSecForwarderService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { identity, toVoid } from "../../utils/mapping";
import { userIdToApiIcrcAccount } from "../../utils/icrcAccount";

export class OneSecForwarderClient extends CandidCanisterAgent<OneSecForwarderService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "OneSecForwarder");
    }

    isForwarding(evmAddress: string): Promise<boolean> {
        const args = { evm_address: evmAddress };

        return this.handleQueryResponse(() => this.service.is_forwarding_address(args), identity, args);
    }

    enableForwarding(userId: string): Promise<void> {
        // Forwarded deposits are paid into this account, so it must be the user's wallet
        const args = { icp_account: { ICRC: userIdToApiIcrcAccount(userId) } };

        return this.handleResponse(
            this.service.enable_forwarding(args),
            toVoid,
            args,
        );
    }
}
