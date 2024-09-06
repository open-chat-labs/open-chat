// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { P2PSwapAccepted } from "./P2PSwapAccepted";
import type { P2PSwapCancelled } from "./P2PSwapCancelled";
import type { P2PSwapCompleted } from "./P2PSwapCompleted";
import type { P2PSwapReserved } from "./P2PSwapReserved";

export type P2PSwapStatus = "Open" | { "Cancelled": P2PSwapCancelled } | { "Expired": P2PSwapCancelled } | { "Reserved": P2PSwapReserved } | { "Accepted": P2PSwapAccepted } | { "Completed": P2PSwapCompleted };
