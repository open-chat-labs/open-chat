import { CommunityMap, type OptionUpdate } from "openchat-shared";
import { writable } from "../../utils/stores";
import { notEq } from "../utils";

export class CommunitySummaryUpdates {
    displayName: OptionUpdate<string> = undefined;
    rulesAccepted?: boolean;
    index?: number;
}

export const communitySummaryLocalUpdates = writable<CommunityMap<CommunitySummaryUpdates>>(
    new CommunityMap(),
    undefined,
    notEq,
);
