use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, ChannelId, UserId};

use crate::c2c_invite_users_to_channel;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub channel_id: ChannelId,
    pub users: Vec<(UserId, Principal)>,
}

pub type Response = c2c_invite_users_to_channel::Response;
