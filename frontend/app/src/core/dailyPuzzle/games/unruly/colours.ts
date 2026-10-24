import { LocalStorageStore } from "@client";
import { configKeys } from "@shared";

export type DiscPair = { a: string; b: string };

// Pairs a player cycles through. Each pair differs mainly in lightness, which survives every
// common kind of colour blindness, and none is near the violation red or the hint blue. The
// second is Paul Tol's high-contrast yellow and blue.
export const discPairs: DiscPair[] = [
    { a: "#f08c00", b: "#6b21a8" },
    { a: "#ddaa33", b: "#004488" },
    { a: "#ffffff", b: "#1f1f1f" },
];

export const discPairIndex = new LocalStorageStore(
    configKeys.unrulyColours,
    0,
    (i) => i.toString(),
    (s) => {
        const i = Number(s);
        return Number.isInteger(i) && i >= 0 && i < discPairs.length ? i : 0;
    },
);
