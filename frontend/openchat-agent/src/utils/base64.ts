export function toUint8Array(base64String: string): Uint8Array {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

export function base64ToBigint(b64: string): bigint {
    const bin = atob(b64);
    const hex: string[] = [];

    bin.split("").forEach(function (ch) {
        let h = ch.charCodeAt(0).toString(16);
        if (h.length % 2) {
            h = "0" + h;
        }
        hex.push(h);
    });

    return BigInt("0x" + hex.join(""));
}
