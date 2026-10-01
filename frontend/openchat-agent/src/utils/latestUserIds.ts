// A user migrated to a MultiUser canister is given a new id, but the events from before the
// migration, in their chats, groups and communities, still refer to them by their earlier id.

// Returns `value` with each user id which is a key of `latestUserIds` replaced by its value. Walks
// strings, arrays, Sets, Maps and plain objects, whose keys (eg. those of tips, keyed by tipper)
// are replaced too, leaving anything else, such as a Uint8Array or a class instance, as it is.
// Whatever holds no such id is returned as it was, rather than copied.
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
        const replaced = [...value].map((v) => replace(v, latestUserIds));
        return replaced.some((v) => !value.has(v)) ? new Set(replaced) : value;
    }
    if (value instanceof Map) {
        const replaced = [...value].map(([k, v]) => [
            replace(k, latestUserIds),
            replace(v, latestUserIds),
        ]);
        return replaced.some(([k, v]) => !value.has(k) || value.get(k) !== v)
            ? new Map(replaced as [unknown, unknown][])
            : value;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        return value;
    }
    let changed = false;
    const replaced: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
        const key = latestUserIds.get(k) ?? k;
        const replacedValue = replace(v, latestUserIds);
        changed ||= key !== k || replacedValue !== v;
        replaced[key] = replacedValue;
    }
    return changed ? replaced : value;
}
