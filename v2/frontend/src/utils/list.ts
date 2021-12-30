export function groupWhile<T>(predicate: (a1: T, a2: T) => boolean, items: T[]): T[][] {
    if (items.length === 0) return [];
    const [, grouped] = items.reduce<[T | undefined, T[][]]>(
        ([prev, groups]: [T | undefined, T[][]], item: T) => {
            if (!prev) {
                return [item, [[item]]];
            }

            if (predicate(prev, item)) {
                const lastGroup = groups[groups.length - 1];
                lastGroup.push(item);
                return [item, groups];
            } else {
                groups.push([item]);
                return [item, groups];
            }
        },
        [undefined, [[]]]
    );
    return grouped;
}

export function groupBy<T, K>(items: T[], keySelector: (item: T) => K): Map<K, T[]> {
    const grouped = new Map<K, T[]>();
    for (const item of items) {
        const key = keySelector(item);
        const existing = grouped.get(key);
        if (existing !== undefined) {
            existing.push(item);
        } else {
            grouped.set(key, [item]);
        }
    }
    return grouped;
}

export function flatMap<A, B>(things: A[], fn: (thing: A) => B[]): B[] {
    return things.reduce((agg, thing) => {
        agg.push(...fn(thing));
        return agg;
    }, [] as B[]);
}

export function dedupe<A>(eq: (a: A, b: A) => boolean, things: A[]): A[] {
    if (things.length == 0) return things;

    const output = [];

    for (let i = 0; i < things.length; i++) {
        if (things[i + 1] === undefined || !eq(things[i], things[i + 1])) {
            output.push(things[i]);
        }
    }

    return output;
}

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
    const l = Math.min(a.length, b.length);
    const res: [A, B][] = [];
    for (let i = 0; i < l; i++) {
        res.push([a[i], b[i]]);
    }
    return res;
}
