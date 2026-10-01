const NANOS_PER_MILLISECOND = 1_000_000n;

// What a spender may still pull from an account, and when that lapses, if ever
export type Allowance = {
    allowance: bigint;
    expiresAt: bigint | undefined;
};

// The args of an `icrc2_approve` call which change an allowance
export type Approval = {
    amount: bigint;
    expectedAllowance: bigint;
    expiresAt: bigint | undefined;
};

// The approval which lets a spender pull `amount` more than it may already. An approval replaces
// the spender's allowance rather than adding to it, and all of a user's payments through a
// canister share the one allowance (see `ledger_utils::spender_subaccount`), so approving only
// `amount` would cancel whatever the user had approved before: another payment still in flight, or
// the standing approval a recurring payment relies on. So `amount` is added to the current
// allowance, which is given as the `expectedAllowance` so that the ledger rejects the approval if
// the allowance has changed since it was read.
//
// An approval made here lasts just long enough for its payment to be pulled (`validityMs` from
// `nowNanos`), but never cuts the current allowance short: one which lapses later, or never, is
// left to.
export function approvalToAdd(
    current: Allowance,
    amount: bigint,
    nowNanos: bigint,
    validityMs: number,
): Approval {
    const expiresAt = nowNanos + BigInt(validityMs) * NANOS_PER_MILLISECOND;

    if (current.allowance === 0n) {
        return { amount, expectedAllowance: 0n, expiresAt };
    }

    return {
        amount: current.allowance + amount,
        expectedAllowance: current.allowance,
        expiresAt:
            current.expiresAt === undefined || current.expiresAt > expiresAt
                ? current.expiresAt
                : expiresAt,
    };
}
