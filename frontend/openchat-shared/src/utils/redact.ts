// What a secret is replaced with when logged, as `PinNumberWrapper`'s Debug impl does in the backend
export const REDACTED = "******";

// Keys whose values must never reach a log: they end up in the browser console whenever the user
// turns on diagnostic logging, and in Rollbar when an error is reported. The PIN, plus the proof of
// a recent sign-in which stands in for the PIN when setting a new one.
export const SECRET_KEYS: readonly string[] = [
    // Canister args (send_message_v2, withdraw_crypto_v2, accept_p2p_swap, ...) and worker requests
    "pin",
    // set_pin_number's `verification`
    "PIN",
    "Reauthenticated",
    // The setPinNumber worker request
    "newPin",
    "signInProofJwt",
    // claim_prize, and the claimPrize worker request
    "sign_in_proof_jwt",
    "signInProof",
];

const secretKeys = new Set(SECRET_KEYS);
// set_pin_number's new PIN goes in a field with a name too generic to redact everywhere
const setPinNumberSecretKeys = new Set([...SECRET_KEYS, "new"]);

// A copy of a request, fit for logging, in which the value of every secret key is replaced with
// REDACTED. Pass the canister method a request is for, if it is one.
export function redactSecrets(value: unknown, methodName?: string): unknown {
    const keys = methodName === "set_pin_number" ? setPinNumberSecretKeys : secretKeys;
    return redact(value, keys, new WeakMap());
}

function redact(value: unknown, keys: Set<string>, copies: WeakMap<object, unknown>): unknown {
    if (value === null || typeof value !== "object") return value;
    // Logging must never throw, so a cycle gets the copy already being built rather than recursing
    const existing = copies.get(value);
    if (existing !== undefined) return existing;

    if (Array.isArray(value)) {
        const copy: unknown[] = [];
        copies.set(value, copy);
        for (const item of value) {
            copy.push(redact(item, keys, copies));
        }
        return copy;
    }

    // Only plain objects are copied: requests hold secrets nowhere else, and copying Uint8Arrays,
    // Principals and the like field by field would mangle them in the log
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;

    const copy: Record<string, unknown> = {};
    copies.set(value, copy);
    for (const [key, item] of Object.entries(value)) {
        // An absent PIN is left as it is: it gives nothing away, and shows that none was sent
        copy[key] = keys.has(key) && item != null ? REDACTED : redact(item, keys, copies);
    }
    return copy;
}
