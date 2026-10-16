//! Recognises the textual forms of the addresses a user can send tokens to from their wallet, so
//! that an address can be checked before it is saved and shown with the network it is for.

use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use sha3::{Digest, Keccak256};
use std::str::FromStr;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Network {
    /// An ICRC-1 textual account, which covers a bare principal as well as an account with a
    /// subaccount such as another user's wallet
    Icrc,
    /// An ICP ledger account identifier
    Icp,
    Btc,
    /// An EVM address, which is the same on Ethereum, Arbitrum and Base
    Eth,
    Sol,
}

// No address is anywhere near this long, and base58 decoding is quadratic in the length
const MAX_LENGTH: usize = 200;

/// The network an address is for, told from its form, or `None` if it isn't an address on any of
/// them. The website recognises the same forms (`addressNetwork` in cryptoAddress.ts).
pub fn detect_network(address: &str) -> Option<Network> {
    if address.len() > MAX_LENGTH {
        None
    } else if Account::from_str(address).is_ok() {
        Some(Network::Icrc)
    } else if AccountIdentifier::from_hex(address).is_ok() {
        Some(Network::Icp)
    } else if is_evm_address(address) {
        Some(Network::Eth)
    } else if is_bitcoin_address(address) {
        Some(Network::Btc)
    } else if is_solana_address(address) {
        Some(Network::Sol)
    } else {
        None
    }
}

// "0x" then 40 hex digits. Mixed case carries an EIP-55 checksum, which must match; all one case
// carries none.
fn is_evm_address(address: &str) -> bool {
    let Some(hex) = address.strip_prefix("0x") else {
        return false;
    };
    if hex.len() != 40 || !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return false;
    }
    let has_upper = hex.bytes().any(|b| b.is_ascii_uppercase());
    let has_lower = hex.bytes().any(|b| b.is_ascii_lowercase());
    if !(has_upper && has_lower) {
        return true;
    }
    // Each letter is uppercase iff the matching nibble of the hash of the lowercase hex is >= 8
    let hash = Keccak256::digest(hex.to_ascii_lowercase().as_bytes());
    hex.bytes().enumerate().all(|(i, b)| {
        if !b.is_ascii_alphabetic() {
            return true;
        }
        let nibble = if i % 2 == 0 { hash[i / 2] >> 4 } else { hash[i / 2] & 0x0f };
        b.is_ascii_uppercase() == (nibble >= 8)
    })
}

// A mainnet address in one of the forms the ckBTC minter can send to: base58check (P2PKH or
// P2SH), bech32 segwit v0 (P2WPKH or P2WSH) or bech32m segwit v1 (P2TR)
fn is_bitcoin_address(address: &str) -> bool {
    is_base58check_bitcoin_address(address) || is_segwit_bitcoin_address(address)
}

// A version byte of 0 (P2PKH) or 5 (P2SH), a 20 byte hash, then the first four bytes of the
// double SHA-256 of those
fn is_base58check_bitcoin_address(address: &str) -> bool {
    let Ok(bytes) = bs58::decode(address).into_vec() else {
        return false;
    };
    if bytes.len() != 25 || !matches!(bytes[0], 0x00 | 0x05) {
        return false;
    }
    let checksum = sha256::sha256(&sha256::sha256(&bytes[..21]));
    checksum[..4] == bytes[21..]
}

const BECH32_CHARSET: &[u8; 32] = b"qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_CONST: u32 = 1;
const BECH32M_CONST: u32 = 0x2bc830a3;
const BECH32_GENERATOR: [u32; 5] = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
// The human-readable part "bc" expanded for the checksum: each character's high bits, a zero,
// then each character's low bits
const BC_EXPANDED: [u8; 5] = [3, 3, 0, 2, 3];

// "bc1", the witness version, the witness program in 5-bit groups, then a six character checksum,
// as BIP-173 and BIP-350 define them
fn is_segwit_bitcoin_address(address: &str) -> bool {
    // The case can't be mixed, and the checksum is of the lowercase form
    let has_upper = address.bytes().any(|b| b.is_ascii_uppercase());
    let has_lower = address.bytes().any(|b| b.is_ascii_lowercase());
    if (has_upper && has_lower) || address.len() > 90 {
        return false;
    }
    let lower = address.to_ascii_lowercase();
    let Some(data_part) = lower.strip_prefix("bc1") else {
        return false;
    };
    let Some(values) = data_part
        .bytes()
        .map(|b| BECH32_CHARSET.iter().position(|c| *c == b).map(|v| v as u8))
        .collect::<Option<Vec<u8>>>()
    else {
        return false;
    };
    if values.len() < 7 {
        return false;
    }
    let checksum = bech32_polymod(&values);
    let (version, program) = values[..values.len() - 6].split_first().unwrap();
    let Some(program) = regroup_bits(program) else {
        return false;
    };
    match version {
        0 => checksum == BECH32_CONST && matches!(program.len(), 20 | 32),
        1 => checksum == BECH32M_CONST && program.len() == 32,
        _ => false,
    }
}

fn bech32_polymod(values: &[u8]) -> u32 {
    let mut chk: u32 = 1;
    for v in BC_EXPANDED.iter().chain(values) {
        let b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ (*v as u32);
        for (i, g) in BECH32_GENERATOR.iter().enumerate() {
            if (b >> i) & 1 == 1 {
                chk ^= g;
            }
        }
    }
    chk
}

// Regroups 5-bit values into bytes. Any bits left over must be fewer than five, and zero.
fn regroup_bits(values: &[u8]) -> Option<Vec<u8>> {
    let mut bytes = Vec::with_capacity(values.len() * 5 / 8);
    let mut acc: u32 = 0;
    let mut bits = 0;
    for v in values {
        acc = ((acc << 5) | (*v as u32)) & 0xfff;
        bits += 5;
        while bits >= 8 {
            bits -= 8;
            bytes.push(((acc >> bits) & 0xff) as u8);
        }
    }
    if bits >= 5 || acc & ((1 << bits) - 1) != 0 {
        return None;
    }
    Some(bytes)
}

// The base58 encoding of a 32 byte public key
fn is_solana_address(address: &str) -> bool {
    bs58::decode(address).into_vec().is_ok_and(|bytes| bytes.len() == 32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn icrc1_account_with_subaccount() -> String {
        let mut subaccount = [0; 32];
        subaccount[31] = 7;
        Account {
            owner: Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8, 1, 1]),
            subaccount: Some(subaccount),
        }
        .to_string()
    }

    fn icp_account_identifier() -> String {
        AccountIdentifier::new(&Principal::anonymous(), &ic_ledger_types::DEFAULT_SUBACCOUNT).to_hex()
    }

    #[test]
    fn recognises_each_network() {
        let icrc1_account = icrc1_account_with_subaccount();
        let account_identifier = icp_account_identifier();
        for (address, network) in [
            ("2vxsx-fae", Network::Icrc),
            ("ls5lp-lqaaa-aaaar-qb5oa-cai", Network::Icrc),
            (icrc1_account.as_str(), Network::Icrc),
            (account_identifier.as_str(), Network::Icp),
            // The EIP-55 examples: all lowercase, all uppercase, and checksummed
            ("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", Network::Eth),
            ("0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED", Network::Eth),
            ("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", Network::Eth),
            ("0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", Network::Eth),
            ("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", Network::Eth),
            ("0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", Network::Eth),
            // P2PKH and P2SH
            ("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", Network::Btc),
            ("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", Network::Btc),
            ("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", Network::Btc),
            // P2WPKH, in both cases, and P2WSH
            ("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", Network::Btc),
            ("BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4", Network::Btc),
            ("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", Network::Btc),
            ("bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", Network::Btc),
            // P2TR
            ("bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", Network::Btc),
            ("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", Network::Sol),
            // 32 zero bytes: the System Program
            ("11111111111111111111111111111111", Network::Sol),
        ] {
            assert_eq!(detect_network(address), Some(network), "{address}");
        }
    }

    #[test]
    fn refuses_what_is_on_no_network() {
        let account_identifier = icp_account_identifier();
        let account_identifier_typo = format!("{}0{}", &account_identifier[..40], &account_identifier[41..]);
        for address in [
            "",
            "not an account",
            "2vxsx-fae.zz",
            account_identifier_typo.as_str(),
            // Missing the prefix, too short, not hex, and a wrong EIP-55 checksum (the final D)
            "5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAe",
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeg",
            "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD",
            // Wrong base58check checksums
            "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3",
            "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLz",
            // Wrong bech32 checksum, bech32m where bech32 is due and vice versa, mixed case, and
            // a testnet address
            "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5",
            "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh",
            "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd",
            "bc1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4",
            "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
            // Well-formed segwit addresses of versions the minter can't send to: v2 and v16
            "bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs",
            "BC1SW50QGDZ25J",
            // A v1 address whose program isn't 32 bytes
            "bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y",
            // Too few and too many bytes for Solana, and a base58 digit it doesn't have
            "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAW",
            "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWMAx",
            "0WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
            " 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
        ] {
            assert_eq!(detect_network(address), None, "{address}");
        }
    }

    #[test]
    fn refuses_anything_too_long_to_be_an_address() {
        assert_eq!(detect_network(&"1".repeat(MAX_LENGTH + 1)), None);
    }
}
