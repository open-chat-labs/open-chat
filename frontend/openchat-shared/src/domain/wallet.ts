export type Verification = NoVerification | PinVerification | Reauthenticated;

export type NoVerification = { kind: "no_verification" };
export type PinVerification = { kind: "pin_verification"; pin: string };
export type Reauthenticated = { kind: "reauthenticated"; signInProofJwt: string };
