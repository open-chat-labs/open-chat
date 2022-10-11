import { idlFactory } from "./candid/idl";
import { CandidService } from "../candidService";
import { toVoid } from "../../utils/mapping";
export class OnlineClient extends CandidService {
    constructor(identity) {
        super(identity);
        this.service = this.createServiceClient(idlFactory, "process.env.ONLINE_CANISTER");
    }
    static create(identity) {
        return new OnlineClient(identity);
    }
    markAsOnline() {
        return this.handleResponse(this.service.mark_as_online({}), toVoid);
    }
}
//# sourceMappingURL=online.client.js.map