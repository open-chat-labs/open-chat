export function compareBigints(a: bigint, b: bigint): number {
    return a < b ? -1 : a > b ? 1 : 0;
}