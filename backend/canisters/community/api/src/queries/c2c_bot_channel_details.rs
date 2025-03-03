use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{BotInitiator, ChannelId, ChatDetails, UserId};

#[ts_export(community, channel_summary)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
}

#[ts_export(community, channel_summary)]
#[allow(clippy::large_enum_variant)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ChatDetails),
    NotAuthorized,
}
