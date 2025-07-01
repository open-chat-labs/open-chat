use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, MessageIndex, UnitResult};

#[ts_export(community, register_proposal_vote_v2)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub message_index: MessageIndex,
    pub adopt: bool,
}

pub type Response = UnitResult;
