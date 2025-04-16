use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, UnitResult, UserId};

#[ts_export(community, cancel_invites)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: Option<ChannelId>,
    pub user_ids: Vec<UserId>,
}

pub type Response = UnitResult;
