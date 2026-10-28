// The expiry, in milliseconds, of a JWT we've been issued, read without verifying it. Undefined if
// it isn't a JWT or has no numeric `exp`.
export function jwtExpiryMs(token: string): number | undefined {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    try {
        const payload = JSON.parse(
            new TextDecoder().decode(
                Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")), (c) =>
                    c.charCodeAt(0),
                ),
            ),
        );
        return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
    } catch {
        return undefined;
    }
}
