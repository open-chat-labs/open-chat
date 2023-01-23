import type { Tokens } from "openchat-shared";

export interface ILedgerClient {
    accountBalance(principal: string): Promise<Tokens>;
}
