use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EmptySuccessOrError, MessageIndex};

#[ts_export(community, register_proposal_vote)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
    pub adopt: bool,
}

pub type Response = EmptySuccessOrError;
