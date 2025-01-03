// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { Cryptocurrency } from "./Cryptocurrency";
import type { TSBytes } from "./TSBytes";
import type { Tokens } from "./Tokens";
import type { UserOrAccount } from "./UserOrAccount";

export type PendingCryptoTransactionNNS = { ledger: TSBytes, token: Cryptocurrency, amount: Tokens, to: UserOrAccount, fee?: Tokens | undefined, memo?: bigint | undefined, created: bigint, };
