import type { SiwsMessage } from "@client";
import { buildSiwsMessage } from "./siws";

describe("the SIWS message", () => {
    test("is in the format the SIWS canister checks, with its times from nanoseconds", () => {
        const message = {
            domain: "oc.app",
            address: "addr",
            statement: "Sign in to OpenChat",
            uri: "https://oc.app",
            version: 1,
            chainId: "mainnet",
            nonce: "n1",
            issuedAt: 1_700_000_000_000_000_000n,
            expirationTime: 1_700_000_300_000_000_000n,
        } as unknown as SiwsMessage;
        expect(buildSiwsMessage(message)).toBe(
            [
                "oc.app wants you to sign in with your Solana account:",
                "addr",
                "",
                "Sign in to OpenChat",
                "",
                "URI: https://oc.app",
                "Version: 1",
                "Chain ID: mainnet",
                "Nonce: n1",
                "Issued At: 2023-11-14T22:13:20.000Z",
                "Expiration Time: 2023-11-14T22:18:20.000Z",
            ].join("\n"),
        );
    });
});
