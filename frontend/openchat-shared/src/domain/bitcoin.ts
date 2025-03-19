export type Utxo = {
    height: number;
    value: bigint;
    outpoint: {
        txid: Uint8Array;
        vout: number;
    };
};

export type CkbtcMinterDepositInfo = {
    minConfirmations: number;
    depositFee: bigint;
}
