import { AccountIdentifier } from "@icp-sdk/canisters/ledger/icp";
import { Principal } from "@icp-sdk/core/principal";
import { encodeIcrcAccount } from "@shared";
import { describe, expect, test } from "vitest";
import { addressNetwork } from "./cryptoAddress";

// The same cases as the canister's tests in backend/libraries/crypto_address
describe("addressNetwork", () => {
    const accountIdentifier = AccountIdentifier.fromPrincipal({
        principal: Principal.anonymous(),
    }).toHex();
    const subaccount = new Uint8Array(32);
    subaccount[31] = 7;
    const icrcAccountWithSubaccount = encodeIcrcAccount({
        owner: Principal.anonymous(),
        subaccount,
    });

    test.each([
        ["a principal", "2vxsx-fae", "icrc"],
        ["a canister id", "ls5lp-lqaaa-aaaar-qb5oa-cai", "icrc"],
        ["an ICRC-1 account with a subaccount", icrcAccountWithSubaccount, "icrc"],
        ["an ICP account identifier", accountIdentifier, "icp"],
        // The EIP-55 examples: all lowercase, all uppercase, and checksummed
        ["a lowercase EVM address", "0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", "eth"],
        ["an uppercase EVM address", "0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED", "eth"],
        ["a checksummed EVM address", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "eth"],
        ["another checksummed EVM address", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", "eth"],
        ["a third checksummed EVM address", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", "eth"],
        ["a fourth checksummed EVM address", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", "eth"],
        ["a P2PKH address", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "btc"],
        ["the genesis block's address", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "btc"],
        ["a P2SH address", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "btc"],
        ["a P2WPKH address", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", "btc"],
        ["an uppercase P2WPKH address", "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4", "btc"],
        ["another P2WPKH address", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "btc"],
        [
            "a P2WSH address",
            "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3",
            "btc",
        ],
        ["a P2TR address", "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", "btc"],
        ["a Solana address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", "sol"],
        ["the Solana System Program's address", "11111111111111111111111111111111", "sol"],
    ])("recognises %s", (_, address, network) => {
        expect(addressNetwork(address)).toBe(network);
    });

    test.each([
        ["an empty string", ""],
        ["words", "not an account"],
        ["a principal with a bad subaccount", "2vxsx-fae.zz"],
        [
            "an ICP account identifier with a typo",
            accountIdentifier.slice(0, 40) +
                (accountIdentifier[40] === "0" ? "1" : "0") +
                accountIdentifier.slice(41),
        ],
        ["an EVM address without its prefix", "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"],
        ["a short EVM address", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe"],
        ["a non-hex EVM address", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeg"],
        ["an EVM address with a wrong checksum", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD"],
        ["a P2PKH address with a wrong checksum", "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3"],
        ["a P2SH address with a wrong checksum", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLz"],
        ["a P2WPKH address with a wrong checksum", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5"],
        ["a v0 address with a bech32m checksum", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh"],
        [
            "a v1 address with a bech32 checksum",
            "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
        ],
        ["a mixed case segwit address", "bc1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4"],
        ["a testnet address", "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"],
        ["a segwit v2 address", "bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs"],
        ["a segwit v16 address", "BC1SW50QGDZ25J"],
        [
            "a v1 address whose program isn't 32 bytes",
            "bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y",
        ],
        ["a short Solana address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAW"],
        ["a long Solana address", "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWMAx"],
        [
            "a Solana address with a non-base58 digit",
            "0WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        ],
        ["an address with a leading space", " 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"],
    ])("refuses %s", (_, address) => {
        expect(addressNetwork(address)).toBeUndefined();
    });
});
