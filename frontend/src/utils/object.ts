/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function deepFreeze(obj: any): any {
    // there is no need to take the performance hit of doing this on prod
    if (process.env.NODE_ENV === "production") return obj;

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
