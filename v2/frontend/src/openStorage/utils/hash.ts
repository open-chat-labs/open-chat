import { sha256 } from "js-sha256";

const TWO_TO_THE_128: bigint = BigInt(1) << BigInt(128);

export function hashBytes128(bytes: ArrayBuffer): bigint {
    const hash256 = hashBytes256(bytes);
    return hash256 % TWO_TO_THE_128;
}

export function hashBytes256(bytes: ArrayBuffer): bigint {
    const hash = sha256.create();
    hash.update(bytes);
    return BigInt("0x" + hash.hex());
}