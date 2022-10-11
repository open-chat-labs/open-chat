import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { nervousSystemFunctions } from "../common/chatMappers";
export class SnsGovernanceClient extends CandidService {
    constructor(identity, canisterId) {
        super(identity);
        this.service = this.createServiceClient(idlFactory, canisterId);
    }
    static create(identity, canisterId) {
        return new SnsGovernanceClient(identity, canisterId);
    }
    listNervousSystemFunctions() {
        return this.handleResponse(this.service.list_nervous_system_functions(), nervousSystemFunctions);
    }
}
//# sourceMappingURL=sns.governance.client.js.map