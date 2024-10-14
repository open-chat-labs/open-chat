// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { TokenInfo } from "../../shared/TokenInfo";
import type { UserSwapTokensExchangeArgs } from "./UserSwapTokensExchangeArgs";

export type UserSwapTokensArgs = { swap_id: bigint, input_token: TokenInfo, output_token: TokenInfo, input_amount: bigint, exchange_args: UserSwapTokensExchangeArgs, min_output_amount: bigint, pin?: string | undefined, };
