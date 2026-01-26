export function retain<T>(arr: T[], filter: (val: T) => boolean) {
    for (let i = arr.length - 1; i >= 0; i--) {
        const value = arr[i];
        if (!filter(value)) {
            arr.splice(i, 1);
        }
    }
}

export function max<T>(arr: T[], mapper: (val: T) => number): number {
    let max = 0;
    for (const item of arr) {
        const value = mapper(item);
        if (value > max) {
            max = value;
        }
    }
    return max;
}
