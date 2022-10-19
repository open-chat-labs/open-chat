export function enumFromStringValue<T>(enm: { [s: string]: T }, value: string, def: T): T {
    return (Object.values(enm) as unknown as string[]).includes(value)
        ? (value as unknown as T)
        : def;
}
