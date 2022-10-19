export type OptionUpdate<T> = undefined | "set_to_none" | { value: T };

export type ApiOptionUpdate<T> = { NoChange: null } | { SetToNone: null } | { SetToSome: T };
