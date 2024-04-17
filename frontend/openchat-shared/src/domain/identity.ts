import { Delegation } from "@dfinity/identity";
import type { Signature } from "@dfinity/agent";
import type { Address } from "openchat-agent/src/services/signInWithSolana/candid/types";

export type HasIdentity = {
    id: string;
};

export type CreateIdentityResponse =
    | PrepareDelegationSuccess
    | { kind: "already_registered" }
    | { kind: "challenge_failed" }
    | { kind: "challenge_required" }
    | { kind: "public_key_invalid" };

export type CheckAuthPrincipalResponse =
    | { kind: "success" }
    | { kind: "legacy" }
    | { kind: "not_found" };

export type MigrateLegacyPrincipalResponse =
    | { kind: "success"; newPrincipal: string }
    | { kind: "already_migrated" }
    | { kind: "not_found" }
    | { kind: "internal_error"; error: string };

export type PrepareDelegationResponse =
    | PrepareDelegationSuccess
    | { kind: "not_found" }
    | { kind: "error"; error: string };

export type PrepareDelegationSuccess = {
    kind: "success";
    userKey: Uint8Array;
    expiration: bigint;
};

export type GetDelegationResponse =
    | {
          kind: "success";
          delegation: Delegation;
          signature: Signature;
      }
    | { kind: "not_found" }
    | { kind: "error"; error: string };

export type SiwePrepareLoginResponse =
    | { kind: "success"; siweMessage: string }
    | { kind: "error"; error: string };

export type SiwsPrepareLoginResponse =
    | { kind: "success"; siwsMessage: SiwsMessage }
    | { kind: "error"; error: string };

export type SiwsMessage = {
    uri: string;
    issuedAt: bigint;
    domain: string;
    statement: string;
    version: number;
    chainId: string;
    address: Address;
    nonce: string;
    expirationTime: bigint;
};
