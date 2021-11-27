import { sha256 } from "js-sha256";

export function hashBytes(bytes: ArrayBuffer): bigint {
    const hash = sha256.create();
    hash.update(bytes);
    return BigInt("0x" + hash.hex());
}