import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
import { describe, expect, test } from "vitest";
import { isAccountIdentifierValid } from "./string";

// ICP ledger account identifiers carry a big-endian CRC32 of the hash in their first four bytes.
// The canister checks it (AccountIdentifier::from_slice); a client that only checked length and
// hex let a typo through to be rejected after the user had been told the address was fine.
describe("isAccountIdentifierValid", () => {
    const valid = AccountIdentifier.fromPrincipal({ principal: Principal.anonymous() }).toHex();

    test("accepts an identifier whose checksum matches", () => {
        expect(valid.length).toBe(64);
        expect(isAccountIdentifierValid(valid)).toBe(true);
    });

    test("rejects a single-character typo", () => {
        const typo = valid.slice(0, 40) + (valid[40] === "0" ? "1" : "0") + valid.slice(41);
        expect(isAccountIdentifierValid(typo)).toBe(false);
    });

    test("still rejects the wrong length or non-hex", () => {
        expect(isAccountIdentifierValid(valid.slice(1))).toBe(false);
        expect(isAccountIdentifierValid("zz" + valid.slice(2))).toBe(false);
    });
});
