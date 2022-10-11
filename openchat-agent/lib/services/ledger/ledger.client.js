import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { hexStringToBytes, identity } from "../../utils/mapping";
export class LedgerClient extends CandidService {
    constructor(identity, canisterId) {
        super(identity);
        this.service = this.createServiceClient(idlFactory, canisterId);
    }
    static create(identity, canisterId) {
        return new LedgerClient(identity, canisterId);
    }
    accountBalance(accountIdentifier) {
        return this.handleResponse(this.service.account_balance({ account: hexStringToBytes(accountIdentifier) }), identity);
    }
}
//# sourceMappingURL=ledger.client.js.map