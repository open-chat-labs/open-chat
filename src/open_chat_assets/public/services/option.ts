import {Option} from "../model/common";

export function convertToOption<T>(value: T[]) : Option<T> {
    return Array.isArray(value) && value.length
        ? value[0]
        : null;
}

export function convertFromOption<T>(value: Option<T>) : T[] {
    return value ? [value] : [];
}
