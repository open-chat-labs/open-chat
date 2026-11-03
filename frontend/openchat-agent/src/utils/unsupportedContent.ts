import { Kind, type TObject, type TSchema } from "@sinclair/typebox";
import { MessageContent } from "../typebox";

// The `Custom` kind a message's content is given when this build doesn't know its type, so that it
// shows as unsupported rather than failing the response it came in
export const UNSUPPORTED_CUSTOM_CONTENT_KIND = "oc_unsupported_content";

const knownContentVariants = new Set(
    (MessageContent.anyOf as TObject[]).flatMap((variant) => Object.keys(variant.properties)),
);

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        !ArrayBuffer.isView(value)
    );
}

/**
 * Replaces, in place, any message content within `value` whose type this build doesn't know with
 * `Custom` content of kind `UNSUPPORTED_CUSTOM_CONTENT_KIND`. Returns whether it replaced any.
 *
 * The backend is released before the website, so a new message type reaches clients that can't
 * read it. Without this, one such message fails validation for the whole response it is in, and a
 * summary updates response covers many chats: they all stopped updating, and after the cache was
 * cleared they didn't load at all.
 */
export function replaceUnsupportedContent(schema: TSchema, value: unknown): boolean {
    if (schema === MessageContent && isRecord(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && !knownContentVariants.has(keys[0])) {
            delete value[keys[0]];
            value.Custom = { kind: UNSUPPORTED_CUSTOM_CONTENT_KIND, data: new Uint8Array() };
            return true;
        }
    }

    switch (schema[Kind]) {
        case "Object": {
            if (!isRecord(value)) return false;
            const properties = schema.properties as Record<string, TSchema>;
            let replaced = false;
            for (const key of Object.keys(value)) {
                const propertySchema =
                    properties[key] ??
                    (typeof schema.additionalProperties === "object"
                        ? (schema.additionalProperties as TSchema)
                        : undefined);
                if (propertySchema !== undefined) {
                    replaced = replaceUnsupportedContent(propertySchema, value[key]) || replaced;
                }
            }
            return replaced;
        }
        case "Array": {
            if (!Array.isArray(value)) return false;
            let replaced = false;
            for (const item of value) {
                replaced = replaceUnsupportedContent(schema.items, item) || replaced;
            }
            return replaced;
        }
        case "Tuple": {
            if (!Array.isArray(value) || schema.items === undefined) return false;
            const items = schema.items as TSchema[];
            let replaced = false;
            for (let i = 0; i < items.length && i < value.length; i++) {
                replaced = replaceUnsupportedContent(items[i], value[i]) || replaced;
            }
            return replaced;
        }
        case "Record": {
            if (!isRecord(value)) return false;
            const valueSchema = Object.values(
                schema.patternProperties as Record<string, TSchema>,
            )[0];
            if (valueSchema === undefined) return false;
            let replaced = false;
            for (const item of Object.values(value)) {
                replaced = replaceUnsupportedContent(valueSchema, item) || replaced;
            }
            return replaced;
        }
        case "Union": {
            // Only into the variants the value could be. For an object, one with all of the
            // variant's required fields, which for the usual union of single-key objects is the
            // one whose key it has.
            let replaced = false;
            for (const variant of schema.anyOf as TSchema[]) {
                if (variant[Kind] === "Object") {
                    if (!isRecord(value)) continue;
                    const required = (variant.required ?? []) as string[];
                    if (!required.every((key) => key in value)) continue;
                }
                replaced = replaceUnsupportedContent(variant, value) || replaced;
            }
            return replaced;
        }
        default:
            return false;
    }
}
