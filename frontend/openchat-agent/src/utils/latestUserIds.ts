// A user migrated to a MultiUser canister is given a new id, but the events from before the
// migration, in their chats, groups and communities, still refer to them by their earlier id.

// Text the user wrote, which is left as it is even if it is exactly a user id
const USER_TEXT_KEYS = new Set(["text", "caption"]);

// Returns `value` with each user id which is a key of `latestUserIds` replaced by its value. Walks
// strings, arrays, Sets, Maps and plain objects, whose keys (eg. those of tips, keyed by tipper)
// are replaced too, leaving anything else, such as a Uint8Array or a class instance, as it is.
// Whatever holds no such id is returned as it was, rather than copied.
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
        const replaced = value.map((v) => replace(v, latestUserIds));
        return replaced.some((v, i) => v !== value[i]) ? replaced : value;
    }
    if (value instanceof Set) {
        const original = [...value];
        const replaced = original.map((v) => replace(v, latestUserIds));
        return replaced.some((v, i) => v !== original[i]) ? new Set(replaced) : value;
    }
    if (value instanceof Map) {
        const original = [...value];
        let changed = false;
        const replaced = new Map<unknown, unknown>();
        for (const [k, v] of original) {
            const key = replace(k, latestUserIds);
            const replacedValue = replace(v, latestUserIds);
            changed ||= key !== k || replacedValue !== v;
            replaced.set(key, merge(replaced.get(key), replacedValue));
        }
        return changed ? replaced : value;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return value;
    }
    let changed = false;
    const replaced: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
        const key = latestUserIds.get(k) ?? k;
        const replacedValue = USER_TEXT_KEYS.has(k) ? v : replace(v, latestUserIds);
        changed ||= key !== k || replacedValue !== v;
        replaced[key] = merge(replaced[key], replacedValue);
    }
    return changed ? replaced : value;
}

function merge(existing: unknown, value: unknown): unknown {
    return typeof existing === "bigint" && typeof value === "bigint" ? existing + value : value;
}
