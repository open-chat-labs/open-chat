// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { UserSwapTokensArgs } from "../swapTokens/UserSwapTokensArgs";

export type UserTokenSwapsTokenSwap = { args: UserSwapTokensArgs, started: bigint, icrc2: boolean, transfer_or_approval?: { Ok : bigint } | { Err : string } | undefined, notified_dex?: { Ok : null } | { Err : string } | undefined, amount_swapped?: { Ok : { Ok : bigint } | { Err : string } } | { Err : string } | undefined, withdrawn_from_dex?: { Ok : bigint } | { Err : string } | undefined, success?: boolean | undefined, };
