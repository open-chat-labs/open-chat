use crate::change_role;
use serde::{Deserialize, Serialize};
use types::{BotInitiator, GroupRole, UserId};

#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub bot_id: UserId,
    pub initiator: BotInitiator,
    pub user_ids: Vec<UserId>,
    pub new_role: GroupRole,
}

impl From<Args> for change_role::Args {
    fn from(value: Args) -> Self {
        change_role::Args {
            user_id: value.user_ids[0],
            user_ids: value.user_ids,
            new_role: value.new_role,
        }
    }
}

pub type Response = change_role::Response;
