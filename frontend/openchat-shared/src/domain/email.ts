export type GenerateMagicLinkResponse =
    | { kind: "success"; userKey: Uint8Array; expiration: bigint }
    | { kind: "email_invalid" }
    | { kind: "blocked"; duration: number }
    | { kind: "failed_to_send_email"; error: string };
