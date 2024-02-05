export function round2(num: number): number {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function sum(numbers: number[]): number {
    return numbers.reduce((a, b) => a + b, 0);
}