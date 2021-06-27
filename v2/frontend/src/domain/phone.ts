import type { Principal } from "@dfinity/principal";

export type RegisterResponse = "success" | "taken" | "too_many_attempts";

export type ClaimResponse = ClaimSuccess | ClaimInvalid | ClaimExpired;

export type ClaimInvalid = {
    kind: "invalid";
};

export type ClaimExpired = {
    kind: "expired";
};

export type ClaimSuccess = {
    kind: "success";
    canisterId: Principal;
};
