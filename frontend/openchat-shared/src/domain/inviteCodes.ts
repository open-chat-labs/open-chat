import type { MultiUserChatIdentifier } from "./chat";

export function codeToText(code: bigint): string {
    return code.toString(16).padStart(16, "0");
}

export function textToCode(codeStr: string): bigint {
    // This also decodes potentially extant old-style base64 encoded invite codes
    return codeStr.length === 16 ? BigInt("0x" + codeStr) : base64ToBigint(codeStr);
}

export type GroupInvite = {
    chatId: MultiUserChatIdentifier;
    code: string;
};

function base64ToBigint(b64: string): bigint {
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
