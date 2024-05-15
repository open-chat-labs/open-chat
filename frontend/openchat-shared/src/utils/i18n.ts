import type { Level } from "../domain";

export type InterpolationValues =
    | Record<string, string | number | boolean | Date | null | undefined>
    | undefined;

interface MessageObject {
    locale?: string;
    format?: string;
    default?: string;
    values?: InterpolationValues;
}
export type MessageFormatter = (id: string, options?: MessageObject) => string;

export type ResourceKey = {
    kind: "resource_key";
    key: string;
    level?: Level;
    lowercase: boolean;
    params?: InterpolationValues;
};