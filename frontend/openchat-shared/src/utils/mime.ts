// Common MIME type mappings
// TODO i18n
const mimeMap: Record<string, string> = {
    // Images
    "image/jpeg": "JPEG Image",
    "image/jpg": "JPEG Image",
    "image/png": "PNG Image",
    "image/gif": "GIF Image",
    "image/webp": "WebP Image",
    "image/svg+xml": "SVG Image",
    "image/bmp": "BMP Image",
    "image/tiff": "TIFF Image",
    "image/heic": "HEIC Image",
    "image/heif": "HEIF Image",
    "image/avif": "AVIF Image",

    // Documents
    "application/pdf": "PDF Document",
    "application/msword": "Word Document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Document",
    "application/vnd.ms-excel": "Excel Spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel Spreadsheet",
    "application/vnd.ms-powerpoint": "PowerPoint Presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "PowerPoint Presentation",
    "text/plain": "Text File",
    "text/markdown": "Markdown Document",
    "text/html": "HTML Document",
    "application/rtf": "Rich Text Format",

    // Archives
    "application/zip": "ZIP Archive",
    "application/x-zip-compressed": "ZIP Archive",
    "application/x-rar-compressed": "RAR Archive",
    "application/x-7z-compressed": "7-Zip Archive",
    "application/gzip": "GZIP Archive",
    "application/x-tar": "TAR Archive",

    // Audio
    "audio/mpeg": "MP3 Audio",
    "audio/wav": "WAV Audio",
    "audio/ogg": "OGG Audio",
    "audio/webm": "WebM Audio",
    "audio/aac": "AAC Audio",
    "audio/flac": "FLAC Audio",

    // Video
    "video/mp4": "MP4 Video",
    "video/webm": "WebM Video",
    "video/quicktime": "QuickTime Video",
    "video/x-msvideo": "AVI Video",
    "video/x-matroska": "Matroska Video (MKV)",
    "video/ogg": "OGG Video",

    // Fonts
    "font/ttf": "TrueType Font",
    "font/otf": "OpenType Font",
    "font/woff": "WOFF Font",
    "font/woff2": "WOFF2 Font",

    // Others
    "application/json": "JSON File",
    "application/xml": "XML File",
    "text/csv": "CSV File",
    "application/javascript": "JavaScript File",
    "text/css": "CSS File",
};

/**
 * Converts a MIME type to a human-readable string
 * @param mimeType - The MIME type string (e.g., "image/jpeg", "application/pdf")
 * @returns A human-readable description of the file type
 */
export function mimeTypeToHumanReadable(mimeType: string | null | undefined): string {
    if (!mimeType || typeof mimeType !== "string") {
        return "Unknown file";
    }

    // Normalize the MIME type (trim and lowercase)
    const normalized = mimeType.trim().toLowerCase();

    // Direct match
    if (mimeMap[normalized]) {
        return mimeMap[normalized];
    }

    // Fallback: Try to generate a readable name from the MIME type
    const [type, subtype] = normalized.split("/");

    if (!type || !subtype) {
        // TODO i18n
        return "Unknown file";
    }

    // Special cases for common patterns
    if (subtype === "octet-stream") {
        return "Binary File";
    }

    if (type === "application") {
        // Clean up common application subtypes
        let name = subtype.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        // Remove "x-" or "vnd." prefixes
        name = name.replace(/^x-|^vnd\./i, "");

        return `${name} File`;
    }

    if (type === "text") {
        return `${subtype.toUpperCase()} File`;
    }

    if (type === "image" || type === "video" || type === "audio") {
        return `${subtype.toUpperCase()} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }

    // Generic fallback
    return `${subtype.toUpperCase()} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
}
