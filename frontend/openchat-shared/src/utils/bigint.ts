export function bigIntMax(...args: bigint[]): bigint {
    return args.reduce((m, e) => e > m ? e : m);
}

export function bigIntMin(...args: bigint[]): bigint {
    return args.reduce((m, e) => e < m ? e : m);
}

export function toBigInt32(value: string | bigint | number): bigint {
    return BigInt(value) % BigInt(4294967296);
}

export function toBigInt64(value: string | bigint | number): bigint {
    return BigInt(value) % BigInt("18446744073709551616");
}

export function numberToBigInt(value: number): bigint {
    return BigInt(Math.trunc(value));
}

const integerRegex = /^[0-9]+$/;
export function parseBigInt(value: string): bigint | undefined {
    if (value.length === 0) return BigInt(0);
    return integerRegex.test(value) ? BigInt(value) : undefined;
}
