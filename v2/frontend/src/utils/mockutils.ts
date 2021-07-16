export function randomNum(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function fill<T>(
    len: number,
    fn: (i: number) => T,
    indexMapper?: (i: number) => number
): T[] {
    return Array(len)
        .fill(0)
        .map((_, i) => (indexMapper ? fn(indexMapper(i)) : fn(i)));
}

export function randomPara(numWords?: number): string {
    return fill(numWords ?? randomNum(1, 50), () => {
        return randomWord(randomNum(3, 12));
    }).join(" ");
}

export function randomWord(len: number): string {
    return fill(len, () => String.fromCharCode(randomNum(97, 122))).join("");
}
