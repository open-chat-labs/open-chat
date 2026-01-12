use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, ChatSummaryGroup, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
}

#[expect(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ChatSummaryGroup),
    Error(OCError),
}
