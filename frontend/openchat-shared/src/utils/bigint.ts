export function bigIntMax(...args: bigint[]): bigint {
    return args.reduce((m, e) => e > m ? e : m);
}

export function bigIntMin(...args: bigint[]): bigint {
    return args.reduce((m, e) => e < m ? e : m);
}

export function toBigInt32(value: string | bigint | number): bigint {
    return BigInt(value) % BigInt(4294967296);
}