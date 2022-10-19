import { createMapStore } from "openchat-client";
import { writable } from "svelte/store";

export type ProposalVoteStatus = "adopting" | "rejecting" | "adopted" | "rejected";

export const proposalVotes = createMapStore(writable(new Map<bigint, ProposalVoteStatus>()));
