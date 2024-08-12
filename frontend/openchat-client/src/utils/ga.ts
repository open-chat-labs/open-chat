export type TrackingCategory = "registration" | "account_linking";

export function gaTrack(
    name: string,
    category: TrackingCategory,
    label: string = "",
    value?: number,
) {
    gtag("event", name, {
        category,
        label,
        value,
    });
}
