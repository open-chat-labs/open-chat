import { Option } from "../../domain/model/common";

export function fromCandid<T>(value: T[]) : Option<T> {
    return Array.isArray(value) && value.length
        ? value[0]
        : null;
}

export function toCandid<T>(value: Option<T>) : [] | [T] {
    return value ? [value] : [];
}
