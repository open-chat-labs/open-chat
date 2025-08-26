import { Principal } from "@icp-sdk/core/principal";

export const HEX_REGEX = new RegExp("^[A-Fa-f0-9]+$");

export function toTitleCase(str: string): string {
    return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
    );
}

export function isPrincipalValid(text: string): boolean {
    try {
        Principal.fromText(text);
        return true;
    } catch (_e) {
        return false;
    }
}

export function isSubAccountValid(text: string): boolean {
    return text.length <= 64 && isHexString(text);
}

export function isAccountIdentifierValid(text: string): boolean {
    return text.length === 64 && isHexString(text);
}

export function isHexString(text: string): boolean {
    return HEX_REGEX.test(text);
}

export function isUrl(text: string): boolean {
    try {
        new URL(text);
        return true;
    } catch {
        return false;
    }
}
