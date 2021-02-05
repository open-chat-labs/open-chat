export const INCREMENT_BALANCE = "INCREMENT_BALANCE";
export const DECREMENT_BALANCE = "DECREMENT_BALANCE";

export function incrementBalance(amount: bigint) : IncrementBalanceEvent {
    return {
        type: INCREMENT_BALANCE,
        payload: amount
    };
}

export function decrementBalance(amount: bigint) : DecrementBalanceEvent {
    return {
        type: DECREMENT_BALANCE,
        payload: amount
    };
}

export type IncrementBalanceEvent = {
    type: typeof INCREMENT_BALANCE,
    payload: bigint
}

export type DecrementBalanceEvent = {
    type: typeof DECREMENT_BALANCE,
    payload: bigint
}
