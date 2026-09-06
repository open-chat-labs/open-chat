import { Value } from "@sinclair/typebox/value";
import { Kind, type Static, type TSchema } from "@sinclair/typebox";
import { deepRemoveNullishFields } from "./nullish";
import { TypeboxValidationError } from "@shared/domain/error";

// Whether a schema or anything beneath it carries a `default` annotation. Value.Default is
// deep-identity on a subtree with no defaults, so such subtrees can be skipped entirely.
const hasDefaultsCache = new WeakMap<TSchema, boolean>();

function hasDefaults(schema: TSchema): boolean {
    const cached = hasDefaultsCache.get(schema);
    if (cached !== undefined) return cached;
    hasDefaultsCache.set(schema, true); // guard against cycles; overwritten below
    let result = "default" in schema;
    if (!result) {
        switch (schema[Kind]) {
            case "Object":
                result = Object.values(schema.properties as Record<string, TSchema>).some(
                    hasDefaults,
                );
                break;
            case "Array":
                result = hasDefaults(schema.items);
                break;
            case "Tuple":
                result = ((schema.items ?? []) as TSchema[]).some(hasDefaults);
                break;
            case "Union":
                result = (schema.anyOf as TSchema[]).some(hasDefaults);
                break;
            case "Record":
                result =
                    Object.values(schema.patternProperties as Record<string, TSchema>).some(
                        hasDefaults,
                    ) ||
                    (typeof schema.additionalProperties === "object" &&
                        hasDefaults(schema.additionalProperties));
                break;
            default:
                // Literal, String, Number, BigInt, Boolean, Null, Uint8Array, Never: leaves
                result = false;
        }
    }
    hasDefaultsCache.set(schema, result);
    return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object";
}

function isArray(value: unknown): value is unknown[] {
    return Array.isArray(value) && !ArrayBuffer.isView(value);
}

// Mirrors typebox's internal ValueOrDefault.
function valueOrDefault(schema: TSchema, value: unknown): unknown {
    const defaultValue = "default" in schema ? schema.default : undefined;
    const clone = typeof defaultValue === "function" ? defaultValue() : Value.Clone(defaultValue);
    return value === undefined
        ? clone
        : isObject(value) && isObject(clone)
          ? Object.assign(clone, value)
          : value;
}

// Same result as Value.Default(schema, value), but subtrees without any `default`
// annotation are returned as-is instead of being cloned and re-checked per union
// variant (which is where Value.Default spends almost all of its time on large event
// pages). Kinds not handled here fall through to Value.Default itself.
function applyDefaults(schema: TSchema, value: unknown): unknown {
    if (!hasDefaults(schema)) return value;
    switch (schema[Kind]) {
        case "Object": {
            if (typeof schema.additionalProperties === "object") {
                return Value.Default(schema, value);
            }
            const defaulted = valueOrDefault(schema, value);
            if (!isObject(defaulted)) return defaulted;
            const properties = schema.properties as Record<string, TSchema>;
            for (const key of Object.getOwnPropertyNames(properties)) {
                const propertyValue = applyDefaults(properties[key], defaulted[key]);
                if (propertyValue === undefined) continue;
                defaulted[key] = propertyValue;
            }
            return defaulted;
        }
        case "Array": {
            const defaulted = isArray(value) ? value : valueOrDefault(schema, value);
            if (!isArray(defaulted)) return defaulted;
            for (let i = 0; i < defaulted.length; i++) {
                defaulted[i] = applyDefaults(schema.items, defaulted[i]);
            }
            return defaulted;
        }
        case "Tuple": {
            const defaulted = valueOrDefault(schema, value);
            if (!isArray(defaulted) || schema.items === undefined) return defaulted;
            const items = schema.items as TSchema[];
            for (let i = 0; i < items.length; i++) {
                defaulted[i] = applyDefaults(items[i], defaulted[i]);
            }
            return defaulted;
        }
        case "Union": {
            const defaulted = valueOrDefault(schema, value);
            for (const inner of schema.anyOf as TSchema[]) {
                // Value.Default clones, defaults and checks every variant; when the variant
                // has no defaults the clone would be unchanged, so check the value directly.
                const result = hasDefaults(inner)
                    ? applyDefaults(inner, Value.Clone(defaulted))
                    : defaulted;
                if (Value.Check(inner, result)) return result;
            }
            return defaulted;
        }
        default:
            return Value.Default(schema, value);
    }
}

// Equivalent to Value.Parse(["Default", "Convert", "Assert"], schema, value), with the
// Default step replaced by applyDefaults above. Convert is kept as-is (it is what turns
// msgpack numbers/strings into bigints) and Value.Assert is the Parse "Assert" step.
export function typeboxValidate<T extends TSchema>(value: unknown, validator: T): Static<T> {
    try {
        const converted = Value.Convert(
            validator,
            applyDefaults(validator, deepRemoveNullishFields(value)),
        );
        Value.Assert(validator, converted);
        return converted as Static<T>;
    } catch (err) {
        console.error("Typebox validation failed: ", value, err);
        throw new TypeboxValidationError(err instanceof Error ? err : undefined);
    }
}
