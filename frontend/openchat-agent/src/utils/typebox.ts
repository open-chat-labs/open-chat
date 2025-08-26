import { Value } from "@sinclair/typebox/value";
import type { Static, TSchema } from "@sinclair/typebox";
import { deepRemoveNullishFields } from "./nullish";
import { TypeboxValidationError } from "openchat-shared";

export function typeboxValidate<T extends TSchema>(value: unknown, validator: T): Static<T> {
    try {
        return Value.Parse(["Default", "Convert", "Assert"], validator, deepRemoveNullishFields(value));
    } catch (err) {
        console.error("Typebox validation failed: ", value, err);
        throw new TypeboxValidationError(err instanceof Error ? err : undefined);
    }
}