import { describe, expect, test } from "vitest";
import { isSolanaAddressValid } from "./solanaAddress";

describe("isSolanaAddressValid", () => {
    test.each([
        ["an account's address", "GXVewvv6HehcLFYCmwpqh5CrMjqN9zJ8rqzGq3HEt9Ax"],
        // 32 zero bytes, which base58 encodes with a "1" for each
        ["the System Program's address", "11111111111111111111111111111111"],
    ])("accepts %s", (_, address) => {
        expect(isSolanaAddressValid(address)).toBe(true);
    });

    test.each([
        ["an empty string", ""],
        // "0", "O", "I" and "l" aren't base58 digits
        ["characters outside base58", "0XVewvv6HehcLFYCmwpqh5CrMjqN9zJ8rqzGq3HEt9Ax"],
        ["too few bytes", "GXVewvv6HehcLFYCmwpqh5CrMjqN9zJ8rqzGq3HEt9"],
        ["too many bytes", "GXVewvv6HehcLFYCmwpqh5CrMjqN9zJ8rqzGq3HEt9AxAx"],
        ["a Bitcoin address", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"],
        ["an Ethereum address", "0x52908400098527886E0F7030069857D2E4169EE7"],
        ["an IC account", "ls5lp-lqaaa-aaaar-qb5oa-cai"],
        ["an address with surrounding spaces", " GXVewvv6HehcLFYCmwpqh5CrMjqN9zJ8rqzGq3HEt9Ax "],
    ])("refuses %s", (_, address) => {
        expect(isSolanaAddressValid(address)).toBe(false);
    });
});
