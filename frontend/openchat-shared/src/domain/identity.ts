import { Delegation } from "@dfinity/identity";
import type { Identity, Signature } from "@dfinity/agent";
import type { Address } from "openchat-agent/src/services/signInWithSolana/candid/types";
import type { OCError } from "./error";
import type { Success } from "./response";

export type HasIdentity = {
    id: string;
};

export type GetOpenChatIdentityResponse =
    | { kind: "success"; identity: Identity }
    | { kind: "auth_identity_not_found" }
    | { kind: "oc_identity_not_found" };

export type CreateIdentityResponse =
    | PrepareDelegationSuccess
    | { kind: "already_registered" }
    | { kind: "challenge_failed" }
    | { kind: "challenge_required" }
    | { kind: "public_key_invalid" }
    | { kind: "originating_canister_invalid" };

export type CheckAuthPrincipalResponse =
    | {
          kind: "success";
          userId: string | undefined;
          originatingCanister: string;
          webAuthnKey: WebAuthnKeyFull | undefined;
          isIIPrincipal: boolean;
      }
    | { kind: "not_found" };

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

export type ChallengeAttempt = { key: number; chars: string };
export type CreateOpenChatIdentityError =
    | "already_registered"
    | "challenge_failed"
    | "challenge_required"
    | "public_key_invalid"
    | "originating_canister_invalid";

export type GenerateChallengeResponse =
    | { kind: "throttled" }
    | { kind: "already_registered" }
    | { kind: "failed" }
    | ChallengeSuccess;

export type ChallengeSuccess = { kind: "success" } & Challenge;

export type Challenge = {
    key: number;
    pngBase64: string;
};

export type CreateOpenChatIdentityResponse = "success" | CreateOpenChatIdentityError;

export type InitiateIdentityLinkResponse =
    | "success"
    | "already_registered"
    | "already_linked_to_principal"
    | "target_user_not_found"
    | "public_key_invalid"
    | "originating_canister_invalid"
    | "linked_identities_limit_reached";

export type ApproveIdentityLinkResponse = Success | OCError;

export type LinkIdentitiesResponse =
    | InitiateIdentityLinkResponse
    | ApproveIdentityLinkResponse
    | "principal_mismatch";

export type AuthenticationPrincipal = {
    principal: string;
    originatingCanister: string;
    isIIPrincipal: boolean;
    isCurrentIdentity: boolean;
    webAuthnKey: WebAuthnKeyFull | undefined;
};

export type AuthenticationPrincipalsResponse = AuthenticationPrincipal[];

export type RemoveIdentityLinkResponse =
    | "success"
    | "cannot_unlink_active_principal"
    | "identity_link_not_found"
    | "user_not_found";

export type WebAuthnKey = {
    publicKey: Uint8Array;
    credentialId: Uint8Array;
};

export type WebAuthnKeyFull = WebAuthnKey & {
    origin: string;
    crossPlatform: boolean;
    aaguid: Uint8Array;
};
