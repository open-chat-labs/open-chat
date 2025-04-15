use candid::CandidType;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EmptySuccessOrError, UserId};

#[ts_export(community, remove_member_from_channel)]
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
}

pub type Response = EmptySuccessOrError;
