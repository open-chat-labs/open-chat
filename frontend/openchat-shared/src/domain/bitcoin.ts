import type { OCError } from "./error";
import type { Success } from "./response";

export type Utxo = {
    height: number;
    value: bigint;
    outpoint: {
        txid: Uint8Array;
        vout: number;
    };
};

export type WithdrawBtcResponse = Success | OCError;

export type CkbtcMinterDepositInfo = {
    minConfirmations: number;
    depositFee: bigint;
}

export type CkbtcMinterWithdrawalInfo = {
    minWithdrawalAmount: bigint;
    feeEstimate: bigint;
}
