export type Primitive = number | string | boolean;

export const identity = <P extends Primitive>(a: P) => a;
