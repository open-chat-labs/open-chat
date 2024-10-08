// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CommunityCanisterCommunitySummary } from "../../shared/CommunityCanisterCommunitySummary";
import type { CommunityCanisterCommunitySummaryUpdates } from "../../shared/CommunityCanisterCommunitySummaryUpdates";
import type { GroupCanisterGroupChatSummary } from "../../shared/GroupCanisterGroupChatSummary";
import type { GroupCanisterGroupChatSummaryUpdates } from "../../shared/GroupCanisterGroupChatSummaryUpdates";

export type LocalUserIndexGroupAndCommunitySummaryUpdatesSummaryUpdatesResponse = { "SuccessGroup": GroupCanisterGroupChatSummary } | { "SuccessCommunity": CommunityCanisterCommunitySummary } | { "SuccessGroupUpdates": GroupCanisterGroupChatSummaryUpdates } | { "SuccessCommunityUpdates": CommunityCanisterCommunitySummaryUpdates } | "SuccessNoUpdates" | "NotFound" | { "InternalError": string };
