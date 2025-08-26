use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, GroupRole, UnitResult, UserId};

#[ts_export(community, change_channel_role)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub user_id: UserId,
    pub new_role: GroupRole,
}

pub type Response = UnitResult;
