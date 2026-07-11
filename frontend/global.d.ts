// Global ambient declarations shared across the whole frontend. Previously these
// lived in per-package src/types.d.ts files, each loaded only by that package's
// own `tsc` run. With the packages collapsed into a single project there is one
// global scope, so the declarations are consolidated here (and loaded via the
// tsconfig `include`). `gtag` is intentionally omitted — it is declared in
// app/src/types.d.ts.

// The experimental Network Information API (navigator.connection) is not part of
// the standard DOM lib.
type NetworkType = "slow-2g" | "2g" | "3g" | "4g";

interface NetworkInformation {
    readonly downlink: number;
    readonly effectiveType: NetworkType;
    readonly rtt: number;
    readonly saveData: boolean;
    addEventListener: (ev: string, cb: () => void) => void;
    removeEventListener: (ev: string, cb: () => void) => void;
}

interface Navigator {
    connection?: NetworkInformation;
}

// borc ships no type declarations.
declare module "borc";
