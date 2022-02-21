export function dataToBlobUrl(data: ArrayBuffer, type?: string): string {
    const options = type ? { type } : undefined;
    const blob = new Blob([data], options);
    return URL.createObjectURL(blob);
}
