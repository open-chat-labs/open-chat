// takes a type of the form [] | [A] and a mapper from A -> B and returns a B or undefined
export function optional<A, B>(candid: [] | [A], mapper: (a: A) => B): B | undefined {
    if (candid === []) {
        return undefined;
    }
    return candid[0] ? mapper(candid[0]) : undefined;
}

export function identity<T>(x: T): T {
    return x;
}

// todo - this maps *any* response to void and should only be used temporarily
export function toVoid(_x: unknown): void {
    return;
}
