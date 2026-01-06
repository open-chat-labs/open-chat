use crate::change_channel_role;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, GroupRole, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
    pub user_ids: Vec<UserId>,
    pub new_role: GroupRole,
}

impl From<Args> for change_channel_role::Args {
    fn from(value: Args) -> Self {
        change_channel_role::Args {
            channel_id: value.channel_id,
            user_id: value.user_ids[0],
            user_ids: value.user_ids,
            new_role: value.new_role,
        }
    }
}

pub type Response = change_channel_role::Response;
