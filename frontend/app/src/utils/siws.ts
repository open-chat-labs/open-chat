import type { SiwsMessage } from "@client";

/**
 * The message a Solana wallet signs to sign in, in the format the SIWS canister checks. Every UI
 * signs with this one, so a change to the format is made once.
 */
export function buildSiwsMessage(siwsMessage: SiwsMessage): string {
    // expiration_time and issued_at are in nanoseconds, convert to milliseconds.
    const expMilliseconds = Number(siwsMessage.expirationTime / BigInt(1000000));
    const issuedAtMilliseconds = Number(siwsMessage.issuedAt / BigInt(1000000));

    let request = `${siwsMessage.domain} wants you to sign in with your Solana account:\n${siwsMessage.address}\n\n`;
    request += `${siwsMessage.statement}\n\n`;
    request += `URI: ${siwsMessage.uri}\n`;
    request += `Version: ${siwsMessage.version}\n`;
    request += `Chain ID: ${siwsMessage.chainId}\n`;
    request += `Nonce: ${siwsMessage.nonce}\n`;
    request += `Issued At: ${new Date(issuedAtMilliseconds).toISOString()}\n`;
    request += `Expiration Time: ${new Date(expMilliseconds).toISOString()}`;
    return request;
}
