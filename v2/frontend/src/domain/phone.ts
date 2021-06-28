import type { Principal } from "@dfinity/principal";

export type RegisterResponse = "success" | "taken" | "too_many_attempts";

export type ClaimResponse =
    | ClaimSuccess
    | ClaimInvalid
    | ClaimExpired
    | UserExists
    | UserLimitReached;

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

export type UserLimitReached = {
    kind: "user_limit_reached";
};

export type UserExists = {
    kind: "user_exists";
};
