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

// What a reference back to an object still being redacted is replaced with
export const CIRCULAR = "[Circular]";

// The request, fit for logging, with the value of every secret key replaced with REDACTED. Pass the
// canister method a request is for, if it is one. Hardly any request holds a secret, so nothing is
// copied unless it has to be: only the objects on the way down to a secret are copied, and anything
// without a secret in it, the request itself included, is returned as it is.
export function redactSecrets(value: unknown, methodName?: string): unknown {
    const keys = methodName === "set_pin_number" ? setPinNumberSecretKeys : secretKeys;
    return redact(value, keys, new WeakSet());
}

function redact(value: unknown, keys: Set<string>, ancestors: WeakSet<object>): unknown {
    if (value === null || typeof value !== "object") return value;

    // Only arrays and plain objects are looked inside: requests hold secrets nowhere else, and
    // copying Uint8Arrays, Principals and the like field by field would mangle them in the log
    if (!Array.isArray(value)) {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) return value;
    }

    // Logging must never throw, so a cycle is cut rather than followed. It can't be pointed at the
    // original object instead: following it back up could reach a secret.
    if (ancestors.has(value)) return CIRCULAR;
    ancestors.add(value);
    const redacted = Array.isArray(value)
        ? redactArray(value, keys, ancestors)
        : redactObject(value as Record<string, unknown>, keys, ancestors);
    ancestors.delete(value);
    return redacted;
}

function redactArray(value: unknown[], keys: Set<string>, ancestors: WeakSet<object>): unknown[] {
    let copy: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
        const item = redact(value[i], keys, ancestors);
        if (item !== value[i]) {
            copy ??= [...value];
            copy[i] = item;
        }
    }
    return copy ?? value;
}

function redactObject(
    value: Record<string, unknown>,
    keys: Set<string>,
    ancestors: WeakSet<object>,
): Record<string, unknown> {
    let copy: Record<string, unknown> | undefined;
    for (const [key, item] of Object.entries(value)) {
        // An absent PIN is left as it is: it gives nothing away, and shows that none was sent
        const redacted = keys.has(key) && item != null ? REDACTED : redact(item, keys, ancestors);
        if (redacted !== item) {
            copy ??= { ...value };
            copy[key] = redacted;
        }
    }
    return copy ?? value;
}
