import { CommunityMap, type OptionUpdate } from "@shared";
import { writable } from "../../utils/stores";
import { notEq } from "../utils";

export class CommunitySummaryUpdates {
    displayName: OptionUpdate<string> = undefined;
    rulesAccepted?: boolean;
    index?: number;
    /** Frozen or unfrozen by a platform moderator here, until the next sync brings it. */
    frozen?: boolean;

    isEmpty(): boolean {
        return Object.values(this).every((v) => v === undefined);
    }
}

export const communitySummaryLocalUpdates = writable<CommunityMap<CommunitySummaryUpdates>>(
    new CommunityMap(),
    undefined,
    notEq,
);
