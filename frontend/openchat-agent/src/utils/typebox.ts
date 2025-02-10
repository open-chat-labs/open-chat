import { Value } from "@sinclair/typebox/value";
import type { Static, TSchema } from "@sinclair/typebox";
import { deepRemoveNullishFields } from "./nullish";

export function typeboxValidate<T extends TSchema>(value: unknown, validator: T): Static<T> {
    return Value.Parse(["Default", "Convert", "Assert"], validator, deepRemoveNullishFields(value));
}