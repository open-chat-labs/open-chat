import type { Tokens } from "../../domain/crypto";

export interface ILedgerClient {
    accountBalance(accountIdentifier: string): Promise<Tokens>;
}
