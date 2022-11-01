import type { Tokens } from "openchat-shared";

export interface ILedgerClient {
    accountBalance(accountIdentifier: string): Promise<Tokens>;
}
