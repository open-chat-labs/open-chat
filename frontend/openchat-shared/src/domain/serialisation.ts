export type Primitive = number | string | boolean;

export const identity = <P extends Primitive>(a: P) => a;

export function defaultSerialiser<T>(key: T): Primitive {
    return key as unknown as Primitive;
}

export function defaultDeserialiser<T>(key: Primitive): T {
    return key as unknown as T;
}
