import base58 from "bs58";

// A Solana address is the base58 encoding of a 32 byte public key
export function isSolanaAddressValid(address: string): boolean {
    try {
        return base58.decode(address).length === 32;
    } catch {
        return false;
    }
}
