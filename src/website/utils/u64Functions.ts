export function toHex(n: bigint) : string {
    return BigInt(n).toString(16).padStart(32, "0");
}

export function fromHex(hex: string) : bigint {
    return BigInt("0x" + hex);
}
