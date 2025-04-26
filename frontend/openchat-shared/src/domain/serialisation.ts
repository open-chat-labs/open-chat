export type Primitive = number | string | boolean;

export const identity = <P extends Primitive>(a: P) => a;

export function defaultSerialiser<T>(x: T): Primitive {
    switch (typeof x) {
        case "string":
        case "number":
        case "boolean":
            return x;
        default:
            return JSON.stringify(x);
    }
}
