export type Feature = "swap";

const featureRestrictions: Record<string, Set<Feature>> = {
    gb: new Set(["swap"]),
};

export function featureRestricted(jurisdiction: string | undefined, feature: Feature): boolean {
    return (
        jurisdiction === undefined ||
        (featureRestrictions[jurisdiction.toLowerCase()]?.has(feature) ?? false)
    );
}
