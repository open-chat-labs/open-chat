// The operator console's sections (/admin/:section, the new web UI): its list panel, which takes
// the chat list's place as the wallet's tokens do, and the page each opens. Review comes first
// (what needs a person), then the operator functions by subject, the content and compliance.

export type AdminSectionId =
    | "proposals"
    | "reports"
    | "infrastructure"
    | "money"
    | "moderation"
    | "integrations"
    | "puzzle"
    | "danger"
    | "translations"
    | "vault";

export type AdminSection = {
    id: AdminSectionId;
    label: string;
    /** The library icon the row's tile shows. */
    icon: string;
    /** The row's line under the label, for a section with no live status. */
    hint: string;
    /** The page's line under its header. */
    intro: string;
};

export type AdminSectionGroup = { label: string; sections: AdminSection[] };

export const ADMIN_SECTION_GROUPS: AdminSectionGroup[] = [
    {
        label: "Review",
        sections: [
            {
                id: "proposals",
                label: "Pending proposals",
                icon: "check-double",
                hint: "Dual-authorised changes",
                intro: "These sensitive operations were proposed by one platform operator and take effect only when a different operator confirms them. Anyone can reject one, and they expire after 14 days.",
            },
            {
                id: "reports",
                label: "Authority reports",
                icon: "flag",
                hint: "NCA CSEA-IRP filings",
                intro: "The register of authority (NCA CSEA-IRP) filings: the compliance evidence that reporting duties were met. File from the moderation report card, not here.",
            },
        ],
    },
    {
        label: "Operator functions",
        sections: [
            {
                id: "infrastructure",
                label: "Infrastructure",
                icon: "layers",
                hint: "Upgrades, MultiUser canisters, polling",
                intro: "Upgrade concurrency, MultiUser canisters and this session's chat polling.",
            },
            {
                id: "money",
                label: "Money and fees",
                icon: "coins",
                hint: "Diamond fees, proposals neuron, tokens",
                intro: "Diamond membership prices, the neuron for submitting proposals and which tokens are enabled.",
            },
            {
                id: "moderation",
                label: "Moderation",
                icon: "shield",
                hint: "Referral thresholds, legal holds",
                intro: "When messages are referred for human review, and legal holds on vaulted evidence.",
            },
            {
                id: "integrations",
                label: "Integrations",
                icon: "link",
                hint: "Call push, keys, MiniApp, bridge bots",
                intro: "Native call push, the Alchemy key, the MiniApp service and the bridge bots.",
            },
            {
                id: "puzzle",
                label: "Daily puzzle",
                icon: "joystick",
                hint: "On or off, regenerate today",
                intro: "The daily puzzle for every user.",
            },
            {
                id: "danger",
                label: "Danger zone",
                icon: "warning",
                hint: "Changes that need two operators",
                intro: "Security and compliance settings that need two platform operators.",
            },
        ],
    },
    {
        label: "Content",
        sections: [
            {
                id: "translations",
                label: "Translations",
                icon: "lang",
                hint: "Suggested translations to review",
                intro: "Translations suggested by users, to approve or reject.",
            },
        ],
    },
    {
        label: "Compliance",
        sections: [
            {
                id: "vault",
                label: "Vault log",
                icon: "lock",
                hint: "Readable by vault reviewers only",
                intro: "The tamper-evident access log of a storage bucket's evidence vault: every quarantine, review, verdict and destruction, each entry chained to the one before by its hash.",
            },
        ],
    },
];

export const ADMIN_SECTIONS: AdminSection[] = ADMIN_SECTION_GROUPS.flatMap((g) => g.sections);

/** The console opens on Pending proposals: what needs another operator comes first. */
export const DEFAULT_ADMIN_SECTION: AdminSectionId = "proposals";

/** The section a URL names; none, or one that isn't a section, is the default. */
export function adminSection(id: string | undefined): AdminSection {
    const found = ADMIN_SECTIONS.find((s) => s.id === (id ?? DEFAULT_ADMIN_SECTION));
    // the default is the first section
    return found ?? ADMIN_SECTIONS[0];
}

/** A section's path. */
export function adminSectionPath(id: AdminSectionId): string {
    return `/admin/${id}`;
}

/** A row's status in the list panel: the line under its label and the count at its end. */
export type SectionStatus = {
    sub: string;
    subTone: "neutral" | "warning" | "danger";
    count?: number;
    countTone?: "neutral" | "warning" | "danger";
    countLabel?: string;
};

/**
 * Pending proposals' row: those awaiting you (another operator's, which you can confirm) and
 * yours (which only another operator can). Until they've loaded, the section's hint.
 */
export function proposalsStatus(
    counts: { awaitingYou: number; yours: number } | undefined,
): SectionStatus {
    if (counts === undefined) return { sub: adminSection("proposals").hint, subTone: "neutral" };
    const { awaitingYou, yours } = counts;
    if (awaitingYou + yours === 0)
        return { sub: "Nothing awaiting confirmation", subTone: "neutral" };
    const sub = [
        awaitingYou > 0 ? `${awaitingYou} awaiting you` : "",
        yours > 0 ? `${yours} yours` : "",
    ]
        .filter((s) => s !== "")
        .join(" · ");
    return awaitingYou > 0
        ? {
              sub,
              subTone: "warning",
              count: awaitingYou,
              countTone: "warning",
              countLabel: `${awaitingYou} awaiting your confirmation`,
          }
        : { sub, subTone: "neutral" };
}

/**
 * Authority reports' row: the due reports overdue and due soon against their SLA targets, and
 * how many were filed; the overdue ones counted in red. Until the register has loaded, the
 * section's hint.
 */
export function reportsStatus(
    counts: { overdue: number; soon: number; filed: number } | undefined,
): SectionStatus {
    if (counts === undefined) return { sub: adminSection("reports").hint, subTone: "neutral" };
    const { overdue, soon, filed } = counts;
    const sub = [
        overdue > 0 ? `${overdue} overdue` : "",
        soon > 0 ? `${soon} due soon` : "",
        `${filed} filed`,
    ]
        .filter((s) => s !== "")
        .join(" · ");
    const subTone = overdue > 0 ? "danger" : soon > 0 ? "warning" : "neutral";
    return overdue > 0
        ? { sub, subTone, count: overdue, countTone: "danger", countLabel: `${overdue} overdue` }
        : { sub, subTone };
}
