export type OptionUpdate<T> = undefined | "set_to_none" | { value: T };

export type ApiOptionUpdate<T> = { NoChange: null } | { SetToNone: null } | { SetToSome: T };
export type ApiOptionUpdateV2<T> = "NoChange" | "SetToNone" | { SetToSome: T };

export function applyOptionUpdate<T>(
    original: T | undefined,
    update: OptionUpdate<T>,
): T | undefined {
    if (update === undefined) return original;
    if (update === "set_to_none") return undefined;
    return update.value;
}

export function mapOptionUpdate<A, B>(
    original: OptionUpdate<A>,
    mapper: (a: A) => B,
): OptionUpdate<B> {
    if (original === undefined || original === "set_to_none") return original;
    return { value: mapper(original.value) };
}

export function updateFromOptions<T>(
    original: T | undefined,
    updated: T | undefined,
): OptionUpdate<T> {
    return original === updated
        ? undefined
        : updated === undefined
        ? "set_to_none"
        : { value: updated };
}
