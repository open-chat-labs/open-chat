import { zip } from "./list";

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function deepFreeze(obj: any): any {
    // there is no need to take the performance hit of doing this on prod
    if (import.meta.env.OC_NODE_ENV === "production") return obj;

    if (Object.isFrozen(obj)) return obj;

    if (obj instanceof Uint8Array) return obj;

    const propNames = Object.getOwnPropertyNames(obj);

    for (const name of propNames) {
        const value = obj[name];

        if (value && typeof value === "object") {
            deepFreeze(value);
        }
    }

    return Object.freeze(obj);
}

// Takes two objects of the same type and returns a partial object where each property
// takes the value of the second object if the values are different otherwise it is undefined
export function mergeKeepingOnlyChanged<T>(orig: T, updated: T): Partial<T> {
    if (orig == undefined) return updated;
    if (updated == undefined) return orig;
    return zip(Object.entries(orig), Object.entries(updated)).reduce(
        (maybe, [[ok, ov], [_, uv]]) => (ov !== uv ? { ...maybe, [ok]: uv } : maybe),
        {},
    );
}

export function isEmpty(obj: object) {
    for (const prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            return false;
        }
    }

    return true;
}
