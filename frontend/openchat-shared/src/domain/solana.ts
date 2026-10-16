import type { OCError } from "./error";
import type { Success } from "./response";

// What the ckSOL minter asks of deposits: it only sweeps a deposit address, crediting its SOL as
// ckSOL, once the address holds at least `minimumDepositAmount` lamports
export type CksolMinterDepositInfo = {
    minimumDepositAmount: bigint;
};

// What the ckSOL minter asks of withdrawals: it burns at least `minWithdrawalAmount` lamports of
// ckSOL, and sends that much SOL, less `withdrawalFee`, to the Solana address
export type CksolMinterWithdrawalInfo = {
    minWithdrawalAmount: bigint;
    withdrawalFee: bigint;
};

export type WithdrawSolResponse = Success | OCError;
