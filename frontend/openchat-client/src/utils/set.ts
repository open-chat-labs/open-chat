export function setsAreEqual(a: Set<unknown>, b: Set<unknown>): boolean {
    if (a.size !== b.size) {
        return false;
    }

    return Array.from(a).every((element) => {
        return b.has(element);
    });
}
