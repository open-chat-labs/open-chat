import type { Identity } from "@dfinity/agent";
import { idlFactory } from "./candid/idl";
import type { LedgerService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { ILedgerClient } from "./ledger.client.interface";
import type { ICP } from "../../domain/crypto/crypto";
import { hexStringToBytes, identity } from "../../utils/mapping";

export class LedgerClient extends CandidService implements ILedgerClient {
    private service: LedgerService;

    private constructor(identity: Identity) {
        super(identity);

        this.service = this.createServiceClient<LedgerService>(
            idlFactory,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            process.env.LEDGER_CANISTER!
        );
    }

    static create(identity: Identity): ILedgerClient {
        return new LedgerClient(identity);
    }

    accountBalance(accountIdentifier: string): Promise<ICP> {
        return this.handleResponse(
            this.service.account_balance({ account: hexStringToBytes(accountIdentifier) }),
            identity
        );
    }
}
