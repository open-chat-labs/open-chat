type Locale = string;
type TranslationKey = string;
export type TranslationCorrection = {
    id: bigint;
    locale: string;
    key: string;
    value: string;
    proposedBy: string;
    proposedAt: bigint;
};

export type Translation = {
    locale: string;
    key: string;
    value: string;
};

export type CandidateTranslation = {
    id: bigint;
    value: string;
    proposedAt: bigint;
    proposedBy: string;
};

export type RejectReason = "too_long" | "incorrect_meaning";

export type CandidateTranslations = {
    locale: string;
    key: string;
    deploymentCount: number;
    candidates: CandidateTranslation[];
};

/**
 * This is a flattened version of what gets stored in the i18n translation dictionaries. These corrections
 * will get merged with the default translations at runtime
 */
export type TranslationCorrections = Record<Locale, Record<TranslationKey, TranslationCorrection>>;

export type ProposeResponse = "already_proposed" | "success" | "failure";

export type ApproveResponse = "success" | "failure";

export type MarkDeployedResponse = "success" | "failure";

export type RejectResponse = "success" | "failure";

export type ProposedResponse =
    | { kind: "failure" }
    | { kind: "success"; proposed: CandidateTranslations[] };

export type PendingDeploymentResponse =
    | { kind: "failure" }
    | {
          kind: "success";
          latestApproval: bigint;
          translations: Translation[];
      };
