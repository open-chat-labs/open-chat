export function deepRemoveNullishFields(value: unknown, depth = 0): unknown {
    if (depth >= 100) throw new Error("Failed to remove nullish fields after 100 loops");
    if (value == null) return value;

    if (Array.isArray(value)) {
        for (const v of value) {
            deepRemoveNullishFields(v, depth + 1);
        }
    } else if (typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
            if (v == null) {
                // Delete the key if it is a field (lower case name), else set it to
                // undefined if it is a variant name (upper case name).
                if (k[0].toUpperCase() !== k[0]) {
                    delete (value as Record<string, unknown>)[k];
                } else {
                    (value as Record<string, unknown>)[k] = null;
                }
            } else {
                deepRemoveNullishFields(v, depth + 1);
            }
        }
    }

    return value;
}
