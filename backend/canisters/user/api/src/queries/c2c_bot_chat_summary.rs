use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChatSummaryDirect, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
}

#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(ChatSummaryDirect),
    Error(OCError),
}
