export function calculateDollarAmount(
    e8s: bigint,
    exchangeRate: number | undefined,
    decimals: number,
): string {
    if (exchangeRate === undefined) return "???";

    const tokens = Number(e8s) / Math.pow(10, decimals);
    const dollar = tokens * exchangeRate;
    return dollar.toFixed(2);
}
