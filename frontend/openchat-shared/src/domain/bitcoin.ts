export type Utxo = {
    height: number;
    value: bigint;
    outpoint: {
        txid: Uint8Array;
        vout: number;
    };
};
