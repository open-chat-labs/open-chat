import type { Identity } from "@dfinity/agent";
import { idlFactory, ICPLedgerService } from "./candid/idl";
import { CandidService } from "../../candidService";
import type { ILedgerClient } from "../ledger.client.interface";
import type { Tokens } from "openchat-shared";
import { hexStringToBytes, identity } from "../../../utils/mapping";
import type { AgentConfig } from "../../../config";

export class ICPLedgerClient extends CandidService implements ILedgerClient {
    private service: ICPLedgerService;

    private constructor(identity: Identity, config: AgentConfig, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<ICPLedgerService>(idlFactory, canisterId, config);
    }

    static create(identity: Identity, config: AgentConfig, canisterId: string): ILedgerClient {
        return new ICPLedgerClient(identity, config, canisterId);
    }

    accountBalance(accountIdentifier: string): Promise<Tokens> {
        return this.handleResponse(
            this.service.account_balance({ account: hexStringToBytes(accountIdentifier) }),
            identity
        );
    }
}
