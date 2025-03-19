export type Utxo = {
    height: number;
    value: bigint;
    outpoint: {
        txid: Uint8Array;
        vout: number;
    };
};

export type WithdrawBtcResponse =
    | { kind: "success" }
    | { kind: "failure", message: string };

export type CkbtcMinterDepositInfo = {
    minConfirmations: number;
    depositFee: bigint;
}

export type CkbtcMinterWithdrawalInfo = {
    minWithdrawalAmount: bigint;
    feeEstimate: bigint;
}
