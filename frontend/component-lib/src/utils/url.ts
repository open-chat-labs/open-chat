// Functions to operate over URLs and paths

export function isAbsoluteUrl(value: string): boolean {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

export function isDataUrl(value: string): boolean {
    return value.startsWith("data:image/");
}

export function isPath(value: string): boolean {
    return value.startsWith("/") || value.startsWith("./") || value.startsWith("../");
}

export function isValueUrlOrPath(value?: string): boolean {
    return !!value && (isAbsoluteUrl(value) || isDataUrl(value) || isPath(value));
}
