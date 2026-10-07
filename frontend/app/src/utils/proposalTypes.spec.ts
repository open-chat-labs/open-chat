import { describe, expect, it } from "vitest";
import { CHAT_ONLY_PROPOSAL_TYPES, proposalTypesFor } from "./proposalTypes";

describe("proposalTypesFor", () => {
    /** Invariant: an SNS other than CHAT is never offered a CHAT-only proposal type. */
    it.each(["DKP", "GHOST", "chat", ""])("offers no CHAT-only type for %s", (symbol) => {
        const offered = proposalTypesFor(symbol);

        expect(offered).toEqual(["motion", "transfer_sns_funds", "advance_sns_target_version"]);
        for (const type of CHAT_ONLY_PROPOSAL_TYPES) {
            expect(offered).not.toContain(type);
        }
    });

    it("offers the CHAT SNS every type", () => {
        expect(proposalTypesFor("CHAT")).toEqual([
            "motion",
            "transfer_sns_funds",
            "advance_sns_target_version",
            ...CHAT_ONLY_PROPOSAL_TYPES,
        ]);
    });
});
