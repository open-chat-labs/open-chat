import { describe, expect, test } from "vitest";
import { isSolanaAddressValid } from "./solanaAddress";

describe("isSolanaAddressValid", () => {
    test.each([
        ["an account's address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
        // 32 zero bytes, which base58 encodes with a "1" for each. Well-formed, though the minter refuses
        // it as an account reserved by the Solana runtime.
        ["the System Program's address", "11111111111111111111111111111111"],
    ])("accepts %s", (_, address) => {
        expect(isSolanaAddressValid(address)).toBe(true);
    });

    test.each([
        ["an empty string", ""],
        // "0", "O", "I" and "l" aren't base58 digits
        ["characters outside base58", "0WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
        ["too few bytes", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAW"],
        ["too many bytes", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWMAx"],
        ["a Bitcoin address", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"],
        ["an Ethereum address", "0x52908400098527886E0F7030069857D2E4169EE7"],
        ["an IC account", "ls5lp-lqaaa-aaaar-qb5oa-cai"],
        ["an address with surrounding spaces", " 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM "],
    ])("refuses %s", (_, address) => {
        expect(isSolanaAddressValid(address)).toBe(false);
    });
});
