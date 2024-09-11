// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CryptoAccountICRC1 } from "./CryptoAccountICRC1";
import type { Cryptocurrency } from "./Cryptocurrency";
import type { PrincipalTS } from "./PrincipalTS";

export type CompletedCryptoTransactionICRC1 = { ledger: PrincipalTS, token: Cryptocurrency, amount: bigint, from: CryptoAccountICRC1, to: CryptoAccountICRC1, fee: bigint, memo?: Array<number>, created: bigint, block_index: bigint, };
