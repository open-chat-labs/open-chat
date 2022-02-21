import type { ICP } from "../../domain/crypto/crypto";

export interface ILedgerClient {
    accountBalance(accountIdentifier: string): Promise<ICP>;
}
