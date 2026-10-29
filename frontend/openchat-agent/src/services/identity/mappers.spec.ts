import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { authPrincipalsResponse } from "./mappers";

describe("authPrincipalsResponse", () => {
    const principal = Principal.fromText("2vxsx-fae");
    const linked = (lastUsed: bigint) => ({
        principal: principal.toUint8Array(),
        originating_canister: principal.toUint8Array(),
        is_ii_principal: true,
        last_used: lastUsed,
    });

    test("a principal keeps when it was last used", () => {
        const [p] = authPrincipalsResponse({ Success: [linked(1_700_000_000_000n)] }, "");
        expect(p.lastUsed).toBe(1_700_000_000_000n);
    });

    // last_used is 0 for a principal not used since the identity canister started recording it
    test("a principal with no record of being used has no last used", () => {
        const [p] = authPrincipalsResponse({ Success: [linked(0n)] }, "");
        expect(p.lastUsed).toBeUndefined();
    });
});
