export function nowNanos(): bigint {
    return BigInt(Date.now()) * BigInt(1_000_000);
}
