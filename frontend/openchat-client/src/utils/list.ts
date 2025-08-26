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
        [undefined, [[]]],
    );
    return grouped;
}

export function groupBy<T, K>(items: Iterable<T>, keySelector: (item: T) => K): Map<K, T[]> {
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

export function distinctBy<T, K>(things: T[], keyFn: (thing: T) => K): T[] {
    if (things.length == 0) return things;

    const set = new Set<K>();
    const output = [];

    for (const thing of things) {
        const key = keyFn(thing);
        if (!set.has(key)) {
            set.add(key);
            output.push(thing);
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

export function chunk<T>(array: T[], size: number): T[][] {
    const chunkCount = Math.floor((array.length - 1) / size) + 1;
    const chunks: T[][] = [];

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
        const start = chunkIndex * size;
        const end = start + size;
        chunks.push(array.slice(start, end));
    }

    return chunks;
}

export function toRecord<T, K extends string | number | symbol>(
    xs: T[],
    keyFn: (x: T) => K,
): Record<K, T> {
    return toRecord2(xs, keyFn, (x) => x);
}

export function toRecord2<T, K extends string | number | symbol, V>(
    xs: T[],
    keyFn: (x: T) => K,
    valFn: (x: T) => V,
): Record<K, V> {
    return toRecordFiltered(xs, keyFn, valFn, (_) => true);
}

export function toRecordFiltered<T, K extends string | number | symbol, V>(
    xs: T[],
    keyFn: (x: T) => K,
    valueFn: (x: T) => V,
    filterFn: (x: T) => boolean,
): Record<K, V> {
    return xs.reduce(
        (rec, x) => {
            if (filterFn(x)) {
                rec[keyFn(x)] = valueFn(x);
            }
            return rec;
        },
        {} as Record<K, V>,
    );
}

export function keepMax<T>(items: T[], keep: (item: T) => boolean, max: number) {
    let i = items.length;
    while (i--) {
        if (items.length <= max) {
            break;
        }

        if (!keep(items[i])) {
            items.splice(i, 1);
        }
    }
}

export function partition<T>(items: T[], fn: (item: T) => boolean): [T[], T[]] {
    return items.reduce(
        ([yes, no], thing) => {
            if (fn(thing)) {
                yes.push(thing);
            } else {
                no.push(thing);
            }
            return [yes, no];
        },
        [[] as T[], [] as T[]],
    );
}
