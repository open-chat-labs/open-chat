const max32 = Math.pow(2, 32) - 1;

export function generateUint64(): bigint {
    const rand1 = Math.floor(Math.random() * max32);
    const rand2 = Math.floor(Math.random() * max32);

    return (BigInt(rand1) << BigInt(32)) + BigInt(rand2);
}
