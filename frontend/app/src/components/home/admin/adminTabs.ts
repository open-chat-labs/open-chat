export type AdminTab = "translations" | "operator" | "proposals" | "authority" | "vaultlog";

/**
 * The admin area's tabs, in display order. Every operator lever, the daily puzzle's included,
 * lives under Operator functions; a lever never gets a tab of its own (#9368 invariant 1).
 */
export const adminTabs: { id: AdminTab; label: string }[] = [
    { id: "translations", label: "Translation Corrections" },
    { id: "operator", label: "Operator functions" },
    { id: "proposals", label: "Pending operator proposals" },
    { id: "authority", label: "Authority reports" },
    { id: "vaultlog", label: "Vault log" },
];
