export type IntrinsicImageDimensions = Readonly<{ width: number; height: number }>;

function bytesView(input: Uint8Array | ArrayBuffer): Uint8Array {
    return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function positiveDimensions(width: number, height: number): boolean {
    return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function u16be(bytes: Uint8Array, offset: number): number {
    return bytes[offset] * 0x100 + bytes[offset + 1];
}

function u16le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] + bytes[offset + 1] * 0x100;
}

function u24le(bytes: Uint8Array, offset: number): number {
    return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x1_0000;
}

function u32be(bytes: Uint8Array, offset: number): number {
    return bytes[offset] * 0x1_000000 + bytes[offset + 1] * 0x1_0000 + u16be(bytes, offset + 2);
}

function i32le(bytes: Uint8Array, offset: number): number {
    const unsigned =
        bytes[offset] +
        bytes[offset + 1] * 0x100 +
        bytes[offset + 2] * 0x1_0000 +
        bytes[offset + 3] * 0x1_000000;
    return unsigned > 0x7fff_ffff ? unsigned - 0x1_0000_0000 : unsigned;
}

function jpegExifOrientation(
    bytes: Uint8Array,
    payloadOffset: number,
    payloadLength: number,
): number | undefined {
    if (
        payloadLength < 14 ||
        ascii(bytes, payloadOffset, 4) !== "Exif" ||
        bytes[payloadOffset + 4] !== 0 ||
        bytes[payloadOffset + 5] !== 0
    ) {
        return undefined;
    }
    const tiffOffset = payloadOffset + 6;
    const payloadEnd = payloadOffset + payloadLength;
    if (tiffOffset + 8 > payloadEnd) return undefined;
    const littleEndian =
        ascii(bytes, tiffOffset, 2) === "II"
            ? true
            : ascii(bytes, tiffOffset, 2) === "MM"
              ? false
              : undefined;
    if (littleEndian === undefined) return undefined;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(tiffOffset + 2, littleEndian) !== 42) return undefined;
    const ifdOffset = tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
    if (ifdOffset + 2 > payloadEnd) return undefined;
    const entries = Math.min(view.getUint16(ifdOffset, littleEndian), 256);
    for (let index = 0; index < entries; index++) {
        const entry = ifdOffset + 2 + index * 12;
        if (entry + 12 > payloadEnd) return undefined;
        if (
            view.getUint16(entry, littleEndian) === 0x0112 &&
            view.getUint16(entry + 2, littleEndian) === 3 &&
            view.getUint32(entry + 4, littleEndian) === 1
        ) {
            const value = view.getUint16(entry + 8, littleEndian);
            return value >= 1 && value <= 8 ? value : undefined;
        }
    }
    return undefined;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function jpegDimensions(bytes: Uint8Array): IntrinsicImageDimensions | undefined {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
    let offset = 2;
    let orientation: number | undefined;
    const scanLimit = Math.min(bytes.length, 1024 * 1024);
    while (offset + 3 < scanLimit) {
        while (offset < scanLimit && bytes[offset] !== 0xff) offset++;
        while (offset < scanLimit && bytes[offset] === 0xff) offset++;
        if (offset >= scanLimit) return undefined;
        const marker = bytes[offset++];
        if (marker === 0xd9 || marker === 0xda) return undefined;
        if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
        if (offset + 1 >= scanLimit) return undefined;
        const segmentLength = u16be(bytes, offset);
        if (segmentLength < 2 || offset + segmentLength > bytes.length) return undefined;
        if (marker === 0xe1) {
            orientation = jpegExifOrientation(bytes, offset + 2, segmentLength - 2) ?? orientation;
        }
        if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
            if (segmentLength < 7) return undefined;
            const width = u16be(bytes, offset + 5);
            const height = u16be(bytes, offset + 3);
            if (!positiveDimensions(width, height)) return undefined;
            // createImageBitmap applies EXIF orientation by default. Keep safety/layout dimensions
            // in the same display coordinate system as its decoded bitmap.
            return orientation !== undefined && orientation >= 5 && orientation <= 8
                ? { width: height, height: width }
                : { width, height };
        }
        offset += segmentLength;
    }
    return undefined;
}

function webpDimensions(bytes: Uint8Array): IntrinsicImageDimensions | undefined {
    if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
        return undefined;
    }
    const kind = ascii(bytes, 12, 4);
    if (kind === "VP8X") {
        return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
    }
    if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
        return { width: u16le(bytes, 26) & 0x3fff, height: u16le(bytes, 28) & 0x3fff };
    }
    if (kind === "VP8L" && bytes[20] === 0x2f) {
        return {
            width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
            height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
        };
    }
    return undefined;
}

/** Read display dimensions from bounded raster headers without decoding attacker-controlled pixels. */
export function intrinsicImageDimensions(
    input: Uint8Array | ArrayBuffer,
): IntrinsicImageDimensions | undefined {
    const bytes = bytesView(input);
    let dimensions: IntrinsicImageDimensions | undefined;
    if (
        bytes.length >= 24 &&
        bytes[0] === 0x89 &&
        ascii(bytes, 1, 3) === "PNG" &&
        ascii(bytes, 12, 4) === "IHDR"
    ) {
        dimensions = { width: u32be(bytes, 16), height: u32be(bytes, 20) };
    } else if (
        bytes.length >= 10 &&
        (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a")
    ) {
        dimensions = { width: u16le(bytes, 6), height: u16le(bytes, 8) };
    } else if (bytes.length >= 26 && ascii(bytes, 0, 2) === "BM") {
        const dibSize =
            bytes[14] + bytes[15] * 0x100 + bytes[16] * 0x1_0000 + bytes[17] * 0x1_000000;
        if (dibSize === 12) {
            dimensions = { width: u16le(bytes, 18), height: u16le(bytes, 20) };
        } else if (dibSize >= 40) {
            dimensions = {
                width: Math.abs(i32le(bytes, 18)),
                height: Math.abs(i32le(bytes, 22)),
            };
        }
    }
    dimensions ??= webpDimensions(bytes) ?? jpegDimensions(bytes);
    return dimensions !== undefined && positiveDimensions(dimensions.width, dimensions.height)
        ? dimensions
        : undefined;
}
