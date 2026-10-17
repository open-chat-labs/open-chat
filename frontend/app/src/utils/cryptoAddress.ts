import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { isAccountIdentifierValid, isICRCAddressValid } from "@shared";
import base58 from "bs58";
import { isSolanaAddressValid } from "./solanaAddress";

/** The networks an address can be for, told from its form */
export type AddressNetwork = "icrc" | "icp" | "btc" | "eth" | "sol";

/**
 * The network an address is for, or undefined if it isn't an address on any of them. The same forms
 * `crypto_address::detect_network` recognises in the canister, which refuses anything else: an ICRC-1
 * textual account (which covers a bare principal), an ICP ledger account identifier, an EVM address
 * (the same on Ethereum, Arbitrum and Base), a Bitcoin address or a Solana address.
 */
export function addressNetwork(address: string): AddressNetwork | undefined {
    if (isICRCAddressValid(address)) return "icrc";
    if (isAccountIdentifierValid(address)) return "icp";
    if (isEvmAddressValid(address)) return "eth";
    if (isBitcoinAddressValid(address)) return "btc";
    if (isSolanaAddressValid(address)) return "sol";
    return undefined;
}

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

// "0x" then 40 hex digits. Mixed case carries an EIP-55 checksum, which must match; all one case
// carries none.
export function isEvmAddressValid(address: string): boolean {
    if (!EVM_ADDRESS_REGEX.test(address)) return false;
    const hex = address.slice(2);
    if (hex === hex.toLowerCase() || hex === hex.toUpperCase()) return true;
    // Each letter is uppercase iff the matching nibble of the hash of the lowercase hex is >= 8
    const hash = bytesToHex(keccak_256(utf8ToBytes(hex.toLowerCase())));
    for (let i = 0; i < hex.length; i++) {
        const c = hex[i];
        if (c >= "0" && c <= "9") continue;
        if ((c === c.toUpperCase()) !== parseInt(hash[i], 16) >= 8) return false;
    }
    return true;
}

// A mainnet address in one of the forms the ckBTC minter can send to: base58check (P2PKH or P2SH),
// bech32 segwit v0 (P2WPKH or P2WSH) or bech32m segwit v1 (P2TR)
export function isBitcoinAddressValid(address: string): boolean {
    return isBase58CheckBitcoinAddress(address) || isSegwitBitcoinAddress(address);
}

// A version byte of 0 (P2PKH) or 5 (P2SH), a 20 byte hash, then the first four bytes of the double
// SHA-256 of those
function isBase58CheckBitcoinAddress(address: string): boolean {
    let bytes: Uint8Array;
    try {
        bytes = base58.decode(address);
    } catch {
        return false;
    }
    if (bytes.length !== 25 || (bytes[0] !== 0x00 && bytes[0] !== 0x05)) return false;
    const checksum = sha256(sha256(bytes.subarray(0, 21)));
    return bytes.subarray(21).every((b, i) => b === checksum[i]);
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;
const BECH32_GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
// The human-readable part "bc" expanded for the checksum: each character's high bits, a zero, then
// each character's low bits
const BC_EXPANDED = [3, 3, 0, 2, 3];

// "bc1", the witness version, the witness program in 5-bit groups, then a six character checksum, as
// BIP-173 and BIP-350 define them
function isSegwitBitcoinAddress(address: string): boolean {
    // The case can't be mixed, and the checksum is of the lowercase form
    if (address !== address.toLowerCase() && address !== address.toUpperCase()) return false;
    const lower = address.toLowerCase();
    if (lower.length > 90 || !lower.startsWith("bc1")) return false;
    const values: number[] = [];
    for (const c of lower.slice(3)) {
        const v = BECH32_CHARSET.indexOf(c);
        if (v < 0) return false;
        values.push(v);
    }
    if (values.length < 7) return false;
    const checksum = bech32Polymod(values);
    const version = values[0];
    const program = regroupBits(values.slice(1, -6));
    if (program === undefined) return false;
    switch (version) {
        case 0:
            return checksum === BECH32_CONST && (program.length === 20 || program.length === 32);
        case 1:
            return checksum === BECH32M_CONST && program.length === 32;
        default:
            return false;
    }
}

// Every intermediate value stays below 2^30, so plain bitwise operations are safe
function bech32Polymod(values: number[]): number {
    let chk = 1;
    for (const v of [...BC_EXPANDED, ...values]) {
        const b = chk >> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        for (let i = 0; i < 5; i++) {
            if ((b >> i) & 1) chk ^= BECH32_GENERATOR[i];
        }
    }
    return chk;
}

// Regroups 5-bit values into bytes. Any bits left over must be fewer than five, and zero.
function regroupBits(values: number[]): number[] | undefined {
    const bytes: number[] = [];
    let acc = 0;
    let bits = 0;
    for (const v of values) {
        acc = ((acc << 5) | v) & 0xfff;
        bits += 5;
        while (bits >= 8) {
            bits -= 8;
            bytes.push((acc >> bits) & 0xff);
        }
    }
    if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) return undefined;
    return bytes;
}
