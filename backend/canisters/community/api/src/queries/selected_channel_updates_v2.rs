use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, SelectedGroupUpdates, TimestampMillis};

#[ts_export(community, selected_channel_updates)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub updates_since: TimestampMillis,
}

#[ts_export(community, selected_channel_updates)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SelectedGroupUpdates),
    SuccessNoUpdates(TimestampMillis),
    PrivateCommunity,
    ChannelNotFound,
    PrivateChannel,
}
