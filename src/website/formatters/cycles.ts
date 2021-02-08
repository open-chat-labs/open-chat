import * as cycleFunctions from "../utils/cycleFunctions";

export function formatCycles(amount: bigint) : string {
    const cycles = cycleFunctions.toT(amount);
    const pounds = cycleFunctions.toCurrency(amount, "GBP").toFixed(2);
    return `${cycles}T (£${pounds})`;
}
