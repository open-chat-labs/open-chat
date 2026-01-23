export function retain<T>(arr: T[], filter: (val: T) => boolean) {
    for (let i = arr.length - 1; i >= 0; i--) {
        const value = arr[i];
        if (!filter(value)) {
            arr.splice(i, 1);
        }
    }
}
