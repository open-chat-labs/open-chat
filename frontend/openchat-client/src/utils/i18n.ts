export function getDecimalSeparator(locale: string | null | undefined): string {
    if (!locale) {
        return defaultDecimalSeparator;
    }
    const numberWithDecimalSeparator = 1.1;
    return (
        Intl.NumberFormat(locale)
            .formatToParts(numberWithDecimalSeparator)
            .find((part) => part.type === "decimal")?.value ?? defaultDecimalSeparator
    );
}

const defaultDecimalSeparator = ".";

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
