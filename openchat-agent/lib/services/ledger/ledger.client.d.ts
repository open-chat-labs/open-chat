import type { Identity } from "@dfinity/agent";
import { CandidService } from "../candidService";
import type { ILedgerClient } from "./ledger.client.interface";
import type { Tokens } from "../../domain/crypto";
export declare class LedgerClient extends CandidService implements ILedgerClient {
    private service;
    private constructor();
    static create(identity: Identity, canisterId: string): ILedgerClient;
    accountBalance(accountIdentifier: string): Promise<Tokens>;
}
