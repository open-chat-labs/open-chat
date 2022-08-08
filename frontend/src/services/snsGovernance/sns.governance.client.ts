import type { Identity } from "@dfinity/agent";
import { idlFactory, SnsGovernanceService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { ISnsGovernanceClient } from "./sns.governance.client.interface";
import type { ListNervousSystemFunctionsResponse } from "../../domain/chat/chat";

export class SnsGovernanceClient extends CandidService implements ISnsGovernanceClient {
    private service: SnsGovernanceService;

    private constructor(identity: Identity, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<SnsGovernanceService>(idlFactory, canisterId);
    }

    static create(identity: Identity, canisterId: string): ISnsGovernanceClient {
        return new SnsGovernanceClient(identity, canisterId);
    }

    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse> {
        return this.handleResponse(
            this.service.list_nervous_system_functions(),
            nervousSystemFunctions
        );
    }
}
