import type { Identity } from "@dfinity/agent";
import { idlFactory, LedgerService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { ILedgerClient } from "./ledger.client.interface";
import type { Tokens } from "../../domain/crypto";
import { hexStringToBytes, identity } from "../../utils/mapping";

export class LedgerClient extends CandidService implements ILedgerClient {
    private service: LedgerService;

    private constructor(identity: Identity, canisterId: string) {
        super(identity);

        this.service = this.createServiceClient<LedgerService>(idlFactory, canisterId);
    }

    static create(identity: Identity, canisterId: string): ILedgerClient {
        return new LedgerClient(identity, canisterId);
    }

    accountBalance(accountIdentifier: string): Promise<Tokens> {
        return this.handleResponse(
            this.service.account_balance({ account: hexStringToBytes(accountIdentifier) }),
            identity
        );
    }
}
