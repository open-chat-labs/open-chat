import type { ApiGetPoolsResponse } from "./candid/idl";
import type { TokenSwapPool } from "openchat-shared";

export function getPoolsResponse(candid: ApiGetPoolsResponse): TokenSwapPool[] {
    if ("ok" in candid) {
        return candid.ok
            .filter(
                (p) =>
                    isStandardSupported(p.token0.standard) &&
                    isStandardSupported(p.token1.standard),
            )
            .map((p) => ({
                dex: "icpswap",
                dexName: "ICPSwap",
                canisterId: p.canisterId.toString(),
                token0: p.token0.address,
                token1: p.token1.address,
            }));
    }
    throw new Error("Unable to get pools from ICPSwap: " + JSON.stringify(candid));
}

function isStandardSupported(standard: string): boolean {
    return standard === "ICP" || standard.includes("ICRC");
}
