export type GenerateMagicLinkResponse =
    | { kind: "success"; userKey: Uint8Array; code: string; expiration: bigint }
    | { kind: "email_invalid" }
    | { kind: "blocked"; duration: number }
    | { kind: "failed_to_send_email"; error: string };

export type HandleMagicLinkResponse =
    | { kind: "success" }
    | { kind: "session_not_found" }
    | { kind: "link_invalid" }
    | { kind: "link_expired" };
