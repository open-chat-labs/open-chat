export function dataToBlobUrl(data: Uint8Array, type: string): string {
    const blob = new Blob([data], { type });
    return URL.createObjectURL(blob);
}