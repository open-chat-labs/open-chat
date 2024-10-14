// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { AccountICRC1 } from "./AccountICRC1";
import type { Cryptocurrency } from "./Cryptocurrency";
import type { TSBytes } from "./TSBytes";

export type PendingCryptoTransactionICRC1 = { ledger: TSBytes, token: Cryptocurrency, amount: bigint, to: AccountICRC1, fee: bigint, memo?: TSBytes | undefined, created: bigint, };
