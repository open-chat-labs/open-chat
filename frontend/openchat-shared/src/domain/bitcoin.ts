export type PendingUtxo = {
    confirmations: number;
    value: bigint;
    outpoint: { txid: Uint8Array; vout: number };
};

export type UpdateBtcBalanceError =
    | { kind: "generic_error"; errorMessage: string; errorCode: bigint }
    | { kind: "temporarily_unavailable"; message: string }
    | { kind: "already_processing" }
    | {
          kind: "no_new_utxos";
          requiredConfirmations: number;
          pendingUtxos: PendingUtxo[];
          currentConfirmations: number | undefined;
      };

export type Utxo = {
    height: number;
    value: bigint;
    outpoint: {
        txid: Uint8Array;
        vout: number;
    };
};

export type UtxoStatus =
    | { kind: "value_too_small"; utxo: Utxo }
    | { kind: "tainted"; utxo: Utxo }
    | { kind: "minted"; mintedAmount: bigint; blockIndex: bigint; utxo: Utxo }
    | { kind: "checked"; utxo: Utxo };

export type UpdateBtcBalanceSuccess = {
    kind: "success";
    result: UtxoStatus[];
};

export type UpdateBtcBalanceResponse = UpdateBtcBalanceSuccess | UpdateBtcBalanceError;
