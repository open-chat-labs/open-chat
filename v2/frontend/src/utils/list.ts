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
