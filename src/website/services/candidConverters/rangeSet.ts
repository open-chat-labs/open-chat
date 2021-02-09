export function toArray(rangeSet: number[][]) : number[] {
    const array = [];
    for (const range of rangeSet) {
        for (let i = range[0]; i <= range[1]; i++) {
            array.push(i);
        }
    }
    return array;
}