use candid::CandidType;
use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, CommunityCanisterChannelSummary, CommunityCanisterChannelSummaryUpdates, TimestampMillis};

#[ts_export(community, channel_summary_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub invite_code: Option<u64>,
    pub updates_since: TimestampMillis,
}

// Allow the large size difference because essentially all responses are the large variant anyway
#[ts_export(community, channel_summary_updates)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessAdded(CommunityCanisterChannelSummary),
    SuccessUpdated(CommunityCanisterChannelSummaryUpdates),
    SuccessNoUpdates,
    PrivateCommunity,
    ChannelNotFound,
    PrivateChannel,
    Error(OCError),
}
