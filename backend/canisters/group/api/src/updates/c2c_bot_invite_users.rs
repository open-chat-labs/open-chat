use ic_principal::Principal;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, UserId};

use crate::c2c_invite_users;

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub users: Vec<(UserId, Principal)>,
}

pub type Response = c2c_invite_users::Response;
