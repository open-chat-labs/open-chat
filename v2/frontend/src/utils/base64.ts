export function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), c => c.charCodeAt(0));
}
