import type { OCError } from "../domain";

export function isError(value: unknown): value is OCError {
    return value != null && typeof value === "object" && "kind" in value && value.kind === "error";
}
