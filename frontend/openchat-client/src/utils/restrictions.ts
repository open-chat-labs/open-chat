// This is just for example - nothing definitive
// actually we probably want a store so that this can be reactive and just contains a Set<RestrictedFeature> for the given user
type RestrictedFeature = "offensive_content" | "token_swap" | "peer_to_peer_trade";

type Restrictions = Record<RestrictedFeature, Set<string>>;

const gbeu = new Set([
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GB",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
]);

const restrictions: Restrictions = {
    offensive_content: gbeu,
    token_swap: new Set<string>(),
    peer_to_peer_trade: new Set<string>(),
};

// this means that if we cannot determine your location at all - all features are allowed (might want it the other way round)
export function featureIsRestricted(countryCode: string | undefined, feature: RestrictedFeature) {
    return countryCode !== undefined && restrictions[feature].has(countryCode.toUpperCase());
}
