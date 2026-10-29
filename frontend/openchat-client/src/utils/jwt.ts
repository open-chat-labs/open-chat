// The claims of a JWT OpenChat signed, read without checking its signature: the services it's for
// check that
export function jwtClaims(token: string): Record<string, unknown> | undefined {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    try {
        const claims: unknown = JSON.parse(
            new TextDecoder().decode(
                Uint8Array.from(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")), (c) =>
                    c.charCodeAt(0),
                ),
            ),
        );
        return typeof claims === "object" && claims !== null
            ? (claims as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

export function jwtExpiryMs(token: string): number | undefined {
    const exp = jwtClaims(token)?.exp;
    return typeof exp === "number" ? exp * 1000 : undefined;
}
