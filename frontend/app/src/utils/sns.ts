import { Principal } from "@dfinity/principal";

export const OC_GOVERNANCE_CANISTER_ID = "2jvtu-yqaaa-aaaaq-aaama-cai";

export function isPrincipalValid(text: string): boolean {
    try {
        Principal.fromText(text);
        return true;
    } catch (_e) {
        return false;
    }
}

const SUB_ACCOUNT_REGEX = new RegExp("^[A-Fa-f0-9]+$");

export function isSubAccountValid(text: string): boolean {
    return text.length <= 64 && SUB_ACCOUNT_REGEX.test(text);
}