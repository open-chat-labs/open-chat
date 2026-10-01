// A user migrated to a MultiUser canister is given a new id, but the events from before the
// migration, in their chats, groups and communities, still refer to them by their earlier id.

// Text the user wrote, which is left as it is even if it is exactly a user id
const USER_TEXT_KEYS = new Set(["text", "caption"]);

// Returns `value` with each user id which is a key of `latestUserIds` replaced by its value. Walks
// strings, arrays, Sets, Maps and plain objects, whose keys (eg. those of tips, keyed by tipper)
// are replaced too, leaving anything else, such as a Uint8Array or a class instance, as it is.
// Whatever holds no such id is returned as it was. Anything else is copied only once its first
// change is found, from the entries before it, so that walking data which holds no such id, which
// is most of it, allocates nothing.
//
// Where an earlier id and the id replacing it are both keys, eg. of the tips of a user who tipped a
// message before and after being migrated, their values are added together if they are bigints,
// else the later one is kept.
export function withLatestUserIds<T>(value: T, latestUserIds: ReadonlyMap<string, string>): T {
    return latestUserIds.size === 0 ? value : (replace(value, latestUserIds) as T);
}

function replace(value: unknown, latestUserIds: ReadonlyMap<string, string>): unknown {
    if (typeof value === "string") {
        return latestUserIds.get(value) ?? value;
    }
    if (value === null || typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        let replaced: unknown[] | undefined;
        for (let i = 0; i < value.length; i++) {
            const v = replace(value[i], latestUserIds);
            if (replaced === undefined && v !== value[i]) {
                replaced = value.slice(0, i);
            }
            replaced?.push(v);
        }
        return replaced ?? value;
    }
    if (value instanceof Set) {
        let replaced: Set<unknown> | undefined;
        let i = 0;
        for (const v of value) {
            const replacedValue = replace(v, latestUserIds);
            if (replaced === undefined && replacedValue !== v) {
                replaced = new Set(first(value, i));
            }
            replaced?.add(replacedValue);
            i++;
        }
        return replaced ?? value;
    }
    if (value instanceof Map) {
        let replaced: Map<unknown, unknown> | undefined;
        let i = 0;
        for (const [k, v] of value) {
            const key = replace(k, latestUserIds);
            const replacedValue = replace(v, latestUserIds);
            if (replaced === undefined && (key !== k || replacedValue !== v)) {
                replaced = new Map(first(value, i));
            }
            if (replaced !== undefined) {
                replaced.set(key, merge(replaced.get(key), replacedValue));
            }
            i++;
        }
        return replaced ?? value;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return value;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    let replaced: Record<string, unknown> | undefined;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = record[k];
        const key = latestUserIds.get(k) ?? k;
        const replacedValue = USER_TEXT_KEYS.has(k) ? v : replace(v, latestUserIds);
        if (replaced === undefined && (key !== k || replacedValue !== v)) {
            replaced = {};
            for (let j = 0; j < i; j++) {
                replaced[keys[j]] = record[keys[j]];
            }
        }
        if (replaced !== undefined) {
            replaced[key] = merge(replaced[key], replacedValue);
        }
    }
    return replaced ?? value;
}

// The first `count` items of `items`
function first<T>(items: Iterable<T>, count: number): T[] {
    const taken: T[] = [];
    for (const item of items) {
        if (taken.length === count) break;
        taken.push(item);
    }
    return taken;
}

// The only values keyed by user id which are bigints are tip amounts, keyed by tipper, so adding them
// together is right. Anything else keyed by user id would need its own rule here.
function merge(existing: unknown, value: unknown): unknown {
    return typeof existing === "bigint" && typeof value === "bigint" ? existing + value : value;
}
