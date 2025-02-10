export function deepRemoveNullishFields(value: unknown, depth = 0): unknown {
    if (depth >= 100) throw new Error("Failed to remove null fields after 100 loops");
    if (value == null) return undefined;

    if (typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
            if (v == null) {
                delete (value as Record<string, unknown>)[k];
            } else {
                deepRemoveNullishFields(v, depth + 1);
            }
        }
    } else if (Array.isArray(value)) {
        for (const v of value) {
            deepRemoveNullishFields(v, depth + 1);
        }
    }

    return value;
}