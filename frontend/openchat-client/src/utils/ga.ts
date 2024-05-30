export type TrackingCategory = "registration";

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
