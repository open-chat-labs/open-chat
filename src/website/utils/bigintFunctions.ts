// Assumes positive bigint
export function toHex(n: bigint) : string {
    let hex = BigInt(n).toString(16);
    if (hex.length % 2) {
      hex = '0' + hex;
    }
    return hex;    
}

// Assumes positive bigint
export function fromHex(hex: string) : bigint {
    return BigInt("0x" + hex);
}
