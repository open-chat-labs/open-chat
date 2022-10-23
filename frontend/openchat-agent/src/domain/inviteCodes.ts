import { base64ToBigint } from "../utils/base64";

export function codeToText(code: bigint): string {
    return code.toString(16).padStart(16, "0");
}

export function textToCode(codeStr: string): bigint {
    // This also decodes potentially extant old-style base64 encoded invite codes
    return codeStr.length === 16 ? BigInt("0x" + codeStr) : base64ToBigint(codeStr);
}
