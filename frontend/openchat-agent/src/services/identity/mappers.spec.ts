import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { apiWebAuthnKey, authPrincipalsResponse } from "./mappers";

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

describe("apiWebAuthnKey", () => {
    const key = (aaguid: Uint8Array) => ({
        publicKey: new Uint8Array([1]),
        credentialId: new Uint8Array([2]),
        origin: "https://oc.app",
        crossPlatform: false,
        aaguid,
    });

    test("sends the AAGUID it has", () => {
        const aaguid = new Uint8Array(16).fill(0xbb);
        expect(apiWebAuthnKey(key(aaguid)).aaguid).toEqual([...aaguid]);
    });

    // Rollbar #32181: a cached key with a short AAGUID failed the 16 element tuple check and blocked sign-up
    test("sends the all-zero AAGUID for a key cached with a short one", () => {
        expect(apiWebAuthnKey(key(new Uint8Array(4))).aaguid).toEqual(new Array(16).fill(0));
    });
});
