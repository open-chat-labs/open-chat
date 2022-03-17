export function getDecimalSeparator(locale: string | null) {
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
