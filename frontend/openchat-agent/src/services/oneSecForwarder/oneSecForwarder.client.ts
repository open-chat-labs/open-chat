import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";
import { idlFactory, type OneSecForwarderService } from "./candid/idl";
import { CandidCanisterAgent } from "../canisterAgent/candid";
import { identity, toVoid } from "../../utils/mapping";

export class OneSecForwarderClient extends CandidCanisterAgent<OneSecForwarderService> {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, idlFactory, "OneSecForwarder");
    }

    isForwarding(evmAddress: string): Promise<boolean> {
        const args = { evm_address: evmAddress };

        return this.handleQueryResponse(() => this.service.is_forwarding_address(args), identity, args);
    }

    enableForwarding(userId: string): Promise<void> {
        const args = {
            icp_account: {
                ICRC: {
                    owner: Principal.fromText(userId),
                    subaccount: [] as [] | [Uint8Array],
                }
            }
        };

        return this.handleResponse(
            this.service.enable_forwarding(args),
            toVoid,
            args,
        );
    }
}
