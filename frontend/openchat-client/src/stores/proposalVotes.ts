import { notEq } from "../state/utils";
import { writable } from "../utils/stores";
import { createMapStore } from "./mapStore";

export type ProposalVoteStatus = "adopting" | "rejecting" | "adopted" | "rejected";

/** This session's votes on proposals, keyed by message id, until the proposal content shows them */
export const proposalVotesStore = createMapStore(
    writable(new Map<bigint, ProposalVoteStatus>(), undefined, notEq),
);
