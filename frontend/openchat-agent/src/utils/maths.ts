export function mean(arr: (number | undefined)[]): number {
    let total = 0;
    let count = 0;

    for (const value of arr) {
        if (value !== undefined) {
            total += value;
            count++;
        }
    }

    return count > 0 ? total / count : 0;
}
