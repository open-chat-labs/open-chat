export function random128(): bigint {
    const bytes = new BigUint64Array(2);
    crypto.getRandomValues(bytes);
    return (bytes[0] << BigInt(64)) + bytes[1];
}
