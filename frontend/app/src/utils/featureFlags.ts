// Temporary build-time flag for the two-phase personhood verification
// rollout (#9072). Phase A ships the ability to *verify* with this flag off,
// so nothing new can *require* verification until the system is proven with
// real users. Phase B is a website rebuild with
// OC_UNIQUE_PERSON_REQUIREMENTS_ENABLED=true - no code change. Remove the
// flag once phase B has shipped.
//
// Controls: offering the unique-person access gate in the gate builder, and
// the unique-person restriction on prize messages. It does NOT control the
// verification flow itself, badges, or the evaluator shown when a user hits
// an existing unique-person gated group - those all ship in phase A.
export const uniquePersonRequirementsEnabled: boolean =
    import.meta.env.OC_UNIQUE_PERSON_REQUIREMENTS_ENABLED === "true";
